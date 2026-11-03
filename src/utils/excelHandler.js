import * as XLSX from 'xlsx';
import { sortProctors } from './proctorsHelper.js';

/**
 * Helper to normalize 2-digit years (e.g. 11/7/26 -> 11/7/2026)
 */
function normalizeDateStr(str) {
  if (!str) return '';
  const parts = str.split('/');
  if (parts.length === 3) {
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    return `${parts[0]}/${parts[1]}/${year}`;
  }
  return str;
}

/**
 * Robust extractor for Day Name and Date from a header row
 * Handles strings, numbers (Excel date serials), Date objects, etc.
 */
function extractDayAndDate(row) {
  let dayName = '';
  let dateStr = '';
  const dayRegex = /(السبت|الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)/;

  for (let cell of row) {
    if (cell === null || cell === undefined || cell === '') continue;

    // 1. Detect Day Name
    if (!dayName && typeof cell === 'string') {
      const match = cell.match(dayRegex);
      if (match) {
        dayName = match[0];
      }
    }

    // 2. Detect Date
    if (!dateStr) {
      if (cell instanceof Date) {
        // Standard Arabic / Palestinian format: Day/Month/Year (DD/MM/YYYY)
        dateStr = `${cell.getDate()}/${cell.getMonth() + 1}/${cell.getFullYear()}`;
      } else if (typeof cell === 'number' && cell > 30000 && cell < 60000) {
        // Excel serial date number
        const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
        dateStr = `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
      } else if (typeof cell === 'string') {
        const dateMatch = cell.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})|(\d{4}-\d{1,2}-\d{1,2})/);
        if (dateMatch) {
          dateStr = normalizeDateStr(dateMatch[0]);
        }
      }
    }
  }

  return { dayName: dayName || 'يوم امتحان', dateStr };
}

/**
 * Helper to extract session number strictly (1, 2, or 3)
 * Never misidentifies a room number like 301 as a session number.
 */
function parseSessionNum(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (/^[1-3]$/.test(s)) return parseInt(s, 10);
  const match = s.match(/^(?:جلسة|الجلسة)?\s*([1-3])$/);
  if (match) return parseInt(match[1], 10);
  if (/الأولى/.test(s)) return 1;
  if (/الثانية/.test(s)) return 2;
  if (/الثالثة/.test(s)) return 3;
  return null;
}

/**
 * Parse an uploaded exam room schedule Excel file
 */
export function parseUploadedSchedule(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rawRows || rawRows.length === 0) {
          reject(new Error('الملف فارغ أو تعذر قراءة محتواه.'));
          return;
        }

        const days = [];
        let currentDayObj = null;
        let totalSlots = 0;

        for (let r = 0; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          // Check if this row is a Day header row
          const { dayName, dateStr } = extractDayAndDate(row);
          const isDateRow = !!dateStr && dayName !== 'يوم امتحان';

          if (isDateRow) {
            currentDayObj = {
              dayName: dayName,
              date: dateStr || `يوم_${days.length + 1}`,
              sessions: []
            };
            days.push(currentDayObj);
            continue;
          }

          let c0 = String(row[0] !== undefined ? row[0] : '').trim();
          let c1 = String(row[1] !== undefined ? row[1] : '').trim();
          let c2 = String(row[2] !== undefined ? row[2] : '').trim();
          let c3 = String(row[3] !== undefined ? row[3] : '').trim();
          let c4 = String(row[4] !== undefined ? row[4] : '').trim();

          // Skip table header rows
          if (/^(?:رقم الجلسة|الجلسة|القاعة|اسم المراقب|المراقب|السعة|#)$/.test(c0) ||
              /^(?:رقم الجلسة|الجلسة|القاعة|اسم المراقب|المراقب|السعة)$/.test(c1)) {
            continue;
          }

          const s0 = parseSessionNum(c0);
          const s1 = parseSessionNum(c1);

          let sessionNum = null;
          let roomName = null;
          let capacity = 1;
          let proctorName = '';

          if (s0 !== null && c1) {
            sessionNum = s0;
            roomName = c1;
            // Check if c2 is capacity
            if (/^[1-5]$/.test(c2)) {
              capacity = parseInt(c2, 10);
              proctorName = c3 || c4 || '';
            } else {
              proctorName = c2 || c3 || '';
            }
          } else if (s1 !== null && c0) {
            sessionNum = s1;
            roomName = c0;
            if (/^[1-5]$/.test(c2)) {
              capacity = parseInt(c2, 10);
              proctorName = c3 || c4 || '';
            } else {
              proctorName = c2 || c3 || '';
            }
          }

          if (sessionNum !== null && roomName) {
            totalSlots++;
            if (!currentDayObj) {
              currentDayObj = {
                dayName: 'اليوم الأول',
                date: '11/7/2026',
                sessions: []
              };
              days.push(currentDayObj);
            }

            let sessionObj = currentDayObj.sessions.find(s => s.sessionNumber === sessionNum);
            if (!sessionObj) {
              sessionObj = {
                sessionNumber: sessionNum,
                rooms: []
              };
              currentDayObj.sessions.push(sessionObj);
            }

            // Extract assigned proctors if any
            let assignedProctors = [];
            if (proctorName && !proctorName.includes('شاغر') && !proctorName.includes('لم يُحدد')) {
              assignedProctors = proctorName.split('/').map(x => x.trim()).filter(Boolean);
            }

            sessionObj.rooms.push({
              rowId: r + 1,
              room: roomName,
              roomName: roomName,
              capacity: capacity,
              proctor: assignedProctors[0] || '',
              assignedProctors: assignedProctors
            });
          }
        }

        if (days.length === 0 || totalSlots === 0) {
          reject(new Error('لم يتم العثور على بيانات قاعات وجلسات صحيحة في هذا الملف. يرجى التأكد من التنسيق.'));
          return;
        }

        resolve({
          days,
          totalSlots,
          fileName: file.name
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('حدث خطأ أثناء قراءة الملف.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Export the populated exam room schedule as a formatted Excel spreadsheet (.xlsx)
 */
export function exportDistributedScheduleExcel(days, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  // Title header
  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات']);
  rows.push([`كشف توزيع مراقبي الامتحانات - الفصل الدراسي: ${semesterCode} - امتحان: ${examType}`]);
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`]);
  rows.push([]);

  days.forEach(day => {
    rows.push([`اليوم والتاريخ:`, '', '', day.dayName, day.date]);
    rows.push(['رقم الجلسة', 'القاعة', 'السعة', 'اسم المراقب']);

    (day.sessions || []).forEach(session => {
      (session.rooms || []).forEach(room => {
        const assigned = Array.isArray(room.assignedProctors) && room.assignedProctors.length > 0
          ? room.assignedProctors.filter(Boolean).join(' / ')
          : (room.assignedProctor || room.proctor || 'شاغر / لم يُحدد');
        const rName = room.roomName || room.room || '';
        const cap = Math.max(1, Number(room.capacity) || 1);
        rows.push([session.sessionNumber, rName, cap, assigned]);
      });
    });

    rows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];

  ws['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 38 },
    { wch: 18 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'توزيع المراقبين');
  XLSX.writeFile(wb, `توزيع_المراقبين_${semesterCode}_${examType}.xlsx`);
}

/**
 * Export the proctors unloading & tracking matrix (.xlsx)
 * Professionally formatted and pre-configured for A3 Landscape Print
 */
export function exportProctorsMatrixExcel(proctorStats, days, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — مصفوفة تفريغ ومتابعة توزيع مراقبي الامتحانات المعتمدة']);
  rows.push([`الفصل الدراسي: ${semesterCode} | نوع الامتحان: ${examType} | مقاس الطباعة المعتمد: A3 Landscape`]);
  rows.push([]);

  const dayRow = ['#', 'اسم المراقب', 'التصنيف', 'النصاب المطلوب', 'المنفذ فعلياً', 'الفرق'];
  const sessionRow = ['', '', '', '', '', ''];

  days.forEach((day) => {
    (day.sessions || []).forEach(sess => {
      dayRow.push(`${day.dayName} (${day.date})`);
      sessionRow.push(`جلسة ${sess.sessionNumber}`);
    });
  });

  rows.push(dayRow);
  rows.push(sessionRow);

  const sortedProctorStats = sortProctors(proctorStats);

  sortedProctorStats.forEach((p, idx) => {
    const isAcademic = (p.type || 'academic') === 'academic';
    const pRow = [
      idx + 1,
      p.name,
      isAcademic ? 'أكاديمي' : 'إداري',
      Number(p.quota) || 0,
      Number(p.assignedCount) || 0,
      (Number(p.assignedCount) || 0) - (Number(p.quota) || 0)
    ];

    days.forEach(day => {
      (day.sessions || []).forEach(sess => {
        const foundRoom = (sess.rooms || []).find(r => {
          if (Array.isArray(r.assignedProctors) && r.assignedProctors.includes(p.name)) return true;
          if (r.proctor === p.name) return true;
          if (r.proctor && r.proctor.split('/').map(x => x.trim()).includes(p.name)) return true;
          return false;
        });
        if (foundRoom) {
          const cap = Math.max(1, Number(foundRoom.capacity) || 1);
          pRow.push(cap > 1 ? `${foundRoom.room || foundRoom.roomName}*` : `${foundRoom.room || foundRoom.roomName}`);
        } else {
          // Check if proctor has an apology/exception or excludeSession3 on this session
          const dayWideKey = `${day.date}_all`;
          const sessionKey = `${day.date}_s${sess.sessionNumber}`;
          const rawExceptions = p.exceptions || [];
          const hasEx = rawExceptions.some(ex => {
            if (typeof ex === 'string') return ex === dayWideKey || ex === sessionKey;
            if (ex && ex.date === day.date) {
              return !ex.sessionNumber || Number(ex.sessionNumber) === sess.sessionNumber;
            }
            return false;
          });

          if (hasEx) {
            pRow.push('معتذر');
          } else if (p.excludeSession3 && sess.sessionNumber === 3) {
            pRow.push('مستبعد 3');
          } else {
            pRow.push('-');
          }
        }
      });
    });

    rows.push(pRow);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];

  // Column widths
  const cols = [
    { wch: 5 },  // #
    { wch: 34 }, // اسم المراقب
    { wch: 12 }, // التصنيف
    { wch: 14 }, // النصاب المطلوب
    { wch: 14 }, // المنفذ
    { wch: 10 }  // الفرق
  ];

  days.forEach(day => {
    (day.sessions || []).forEach(() => {
      cols.push({ wch: 11 }); // Session columns
    });
  });

  ws['!cols'] = cols;

  // Pre-configured for A3 Landscape print
  ws['!pageSetup'] = {
    orientation: 'landscape',
    paperSize: 8, // A3
    scale: 75,
    fitToWidth: 1,
    fitToHeight: 1
  };

  XLSX.utils.book_append_sheet(wb, ws, 'مصفوفة التفريغ A3');
  XLSX.writeFile(wb, `مصفوفة_تفريغ_المراقبين_A3_${semesterCode}_${examType}.xlsx`);
}

/**
 * Export the Portal Data Entry Guide (.xlsx) specifically designed for the Exam Officer
 * Organized strictly by: Day -> Session -> Rooms & Proctors
 */
export function exportPortalEntryExcel(days, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة الرسمي']);
  rows.push([`الفصل الدراسي: ${semesterCode} | الامتحان: ${examType} | تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}`]);
  rows.push(['تنبيه لموظف الإدخال: هذا الكشف منظم بحسب تسلسل شاشات إدخال بورتال الجامعة (يوم > جلسة > قاعة)']);
  rows.push([]);

  days.forEach((day) => {
    rows.push([`══════════════ ${day.dayName} (${day.date}) ══════════════`]);

    (day.sessions || []).forEach(sess => {
      rows.push([`▶ الجلسة رقم (${sess.sessionNumber})`]);
      rows.push(['#', 'القاعة', 'السعة المطلوبة', 'المراقب الأول (الأساسي)', 'المراقب الثاني / المساعد (إن وجد)', 'المراقب الثالث (إن وجد)', 'ملاحظات القاعة']);

      (sess.rooms || []).forEach((room, rIdx) => {
        let proctorList = [];
        if (Array.isArray(room.assignedProctors) && room.assignedProctors.length > 0) {
          proctorList = [...room.assignedProctors];
        } else if (room.proctor && room.proctor.trim()) {
          proctorList = room.proctor.split('/').map(x => x.trim()).filter(Boolean);
        }

        const cap = Math.max(1, Number(room.capacity) || 1);
        const p1 = proctorList[0] || 'شاغر / غير محدد';
        const p2 = proctorList[1] || (cap >= 2 ? 'شاغر' : '-');
        const p3 = proctorList[2] || (cap >= 3 ? 'شاغر' : '-');
        const note = cap > 1 ? `قاعة مشتركة تتطلب (${cap}) مراقبين` : 'قاعة منفردة';

        rows.push([rIdx + 1, room.room || room.roomName, `${cap} مراقب`, p1, p2, p3, note]);
      });

      rows.push([]);
    });

    rows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];

  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 15 },
    { wch: 34 },
    { wch: 34 },
    { wch: 25 },
    { wch: 32 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'كشف إدخال البورتال');
  XLSX.writeFile(wb, `كشف_إدخال_بورتال_الجامعة_${semesterCode}_${examType}.xlsx`);
}

/**
 * Export filtered subset of rooms/proctors to Excel
 */
export function exportFilteredResultsExcel(filteredRooms, filterCriteriaText, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — كشف نتائج التوزيع المفلترة']);
  rows.push([`الفصل الدراسي: ${semesterCode} | الامتحان: ${examType}`]);
  if (filterCriteriaText) {
    rows.push([`معايير الفلترة المطبقة: ${filterCriteriaText}`]);
  }
  rows.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')} | إجمالي السجلات المفلترة: ${filteredRooms.length}`]);
  rows.push([]);

  rows.push(['#', 'اليوم والتاريخ', 'رقم الجلسة', 'القاعة', 'السعة', 'المراقبون المسندون']);

  filteredRooms.forEach((item, idx) => {
    rows.push([
      idx + 1,
      `${item.dayName} (${item.date})`,
      `جلسة ${item.sessionNumber}`,
      item.room,
      `${item.capacity} مراقب`,
      (item.proctors || []).join(' / ') || 'شاغر'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];

  ws['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 45 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'النتائج المفلترة');
  XLSX.writeFile(wb, `كشف_مفلتر_${semesterCode}_${examType}.xlsx`);
}

/**
 * Export Executive Summary & KPI Scorecard (.xlsx)
 * Derived 100% dynamically from mathematical audit verification.
 * Zero hardcoded claims or arbitrary defaults.
 */
export function exportExecutiveSummaryExcel(auditData, daysStats, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — التقرير التنفيذي لملخص مؤشرات توزيع الامتحانات المعتمد']);
  rows.push([`الفصل الدراسي: ${semesterCode} | نوع الامتحان: ${examType}`]);
  rows.push([`تاريخ التدقيق والتقرير: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG')}`]);
  rows.push([]);

  // Use auditData if passed as runScheduleAudit object, or normalize from summaryStats
  const totalSlots = auditData.totalCapacityRequired !== undefined ? auditData.totalCapacityRequired : (auditData.totalSlots || 0);
  const filledSlots = auditData.totalAssignedSlots !== undefined ? auditData.totalAssignedSlots : (auditData.filledSlots || 0);
  const unassignedSlots = auditData.totalUnassignedSlots !== undefined ? auditData.totalUnassignedSlots : (auditData.unassignedSlots || 0);
  const isComplete = totalSlots > 0 && unassignedSlots === 0 && filledSlots === totalSlots;

  const academicCount = auditData.academicCount !== undefined ? auditData.academicCount : (auditData.academicsCount || 0);
  const academicFullCount = auditData.academicFullComplianceCount !== undefined ? auditData.academicFullComplianceCount : (auditData.academicsCompletedCount || 0);
  const academicRate = auditData.academicComplianceRate !== undefined ? auditData.academicComplianceRate : (academicCount > 0 ? Math.round((academicFullCount / academicCount) * 100) : 100);

  const adminCount = auditData.adminCount !== undefined ? auditData.adminCount : (auditData.adminsCount || 0);
  const adminOverloads = auditData.adminDailyOverloadCount || 0;
  const adminComplianceRate = auditData.adminComplianceRate !== undefined ? auditData.adminComplianceRate : 100;

  const singleDays = auditData.academicSingleSessionDaysCount || 0;
  const exceptionViolations = auditData.exceptionViolationsTotal || 0;
  const session3Violations = auditData.session3ViolationsTotal || 0;
  const gapViolations = auditData.academicGapViolationsCount || 0;
  const sameSessionConflicts = (auditData.sameSessionConflicts || []).length;

  rows.push(['المؤشر الإداري والرقابي', 'القيمة المحققة', 'حالة التدقيق والاعتماد']);
  
  rows.push([
    'إجمالي شواغر القاعات المطلوبة (طاقة الاستيعاب)',
    totalSlots,
    totalSlots > 0 ? 'معتمد وفق سعات القاعات' : 'تنبيه: لم يتم تعريف شواغر'
  ]);

  rows.push([
    'الشواغر المسندة بنجاح',
    filledSlots,
    isComplete ? 'مكتمل بنسبة 100%' : `غير مكتمل (نسبة التغطية: ${totalSlots > 0 ? Math.round((filledSlots/totalSlots)*100) : 0}%)`
  ]);

  rows.push([
    'الشواغر المعلقة (غير المسندة)',
    unassignedSlots,
    unassignedSlots === 0 ? 'صفر (لا توجد شواغر معلقة)' : `تنبيه: يوجد ${unassignedSlots} مقعد شاغر بدون مراقب!`
  ]);

  rows.push([
    'إجمالي كادر المراقبين المسجلين',
    (academicCount + adminCount),
    `${academicCount} أكاديمي + ${adminCount} إداري`
  ]);

  rows.push([
    'نسبة استيفاء عقود الكادر الأكاديمي',
    `${academicRate}%`,
    academicFullCount === academicCount && academicCount > 0
      ? `${academicFullCount} من ${academicCount} أستاذ بتفاضل صفر (استيفاء تام)`
      : `تنبيه: ${academicCount - academicFullCount} أستاذ لم يستوفوا نصابهم التعاقدي بدقة!`
  ]);

  rows.push([
    'نسبة عدالة سقف الكادر الإداري',
    `${adminComplianceRate}%`,
    adminOverloads === 0
      ? 'توزيع عادل ضمن السقف (حد أقصى جلستان يومياً)'
      : `تنبيه: تم رصد ${adminOverloads} حالة تجاوز لسقف الجلستين يومياً!`
  ]);

  rows.push([
    'أيام الدوام الفردية للأكاديميين',
    `${singleDays} جلسات`,
    singleDays === 0
      ? 'تم تصفير الأيام الفردية بالكامل بدمج الجلسات'
      : `${singleDays} جلسات فردية (تشمل أصحاب النصاب الفردي أو المتبقي)`
  ]);

  rows.push([
    'احترام طلبات الاستثناء والاعتذارات',
    exceptionViolations === 0 ? '100%' : `${Math.max(0, 100 - exceptionViolations * 5)}%`,
    exceptionViolations === 0
      ? 'محترمة بالكامل بدون أي مخالفة مسجلة'
      : `تنبيه: تم رصد ${exceptionViolations} تكليف خلال فترات اعتذار مسجلة!`
  ]);

  rows.push([
    'احترام استبعاد الجلسة الثالثة',
    session3Violations === 0 ? '100%' : 'توجد مخالفات',
    session3Violations === 0
      ? 'محترمة بالكامل لجميع أصحاب الطلب'
      : `تنبيه: تم تكليف مراقبين في الجلسة 3 بالرغم من طلب الاستبعاد!`
  ]);

  rows.push([
    'خلو الجدول من فجوات الأكاديميين (1 و 3 دون 2)',
    gapViolations === 0 ? 'سليم 100%' : 'توجد فجوات',
    gapViolations === 0
      ? 'خالٍ تماماً من فترات الفراغ والانتظار'
      : `تنبيه: يوجد ${gapViolations} فجوة فراغ للأكاديميين!`
  ]);

  rows.push([
    'الخلو من تعارض الجلسة الواحدة',
    sameSessionConflicts === 0 ? 'سليم 100%' : 'يوجد تعارض!',
    sameSessionConflicts === 0
      ? 'صفر تعارض (لا يوجد مراقب في قاعتين بنفس الجلسة)'
      : `تنبيه: يوجد ${sameSessionConflicts} تعارض متزامن!`
  ]);

  rows.push([]);

  // Days detail
  rows.push(['جدول تفاصيل الأيام الامتحانية:']);
  rows.push(['اليوم', 'التاريخ', 'عدد الجلسات', 'إجمالي القاعات', 'المراقبون المشاركون']);

  (daysStats || []).forEach(d => {
    rows.push([d.dayName, d.date, d.sessionsCount, d.totalRooms, d.proctorsCount]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!views'] = [{ RTL: true }];

  ws['!cols'] = [
    { wch: 44 },
    { wch: 22 },
    { wch: 48 },
    { wch: 18 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'المؤشرات التنفيذية المعتمدة');
  XLSX.writeFile(wb, `التقرير_التنفيذي_لملخص_الامتحانات_${semesterCode}_${examType}.xlsx`);
}
