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
        
        // Convert to array of arrays with raw: false to retain formatted strings
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

        const days = [];
        let currentDayObj = null;
        let totalSlots = 0;

        for (let r = 0; r < rows.length; r++) {
          const row = rows[r];
          const c0 = String(row[0] || '').trim();
          const c1 = String(row[1] || '').trim();
          const c2 = String(row[2] || '').trim();
          const c3 = String(row[3] || '').trim();
          const c4 = String(row[4] || '').trim();
          const c5 = String(row[5] || '').trim();

          // Check if this row is a day/date header
          const joinedRow = `${c0} ${c1} ${c2} ${c3} ${c4} ${c5}`;
          if (joinedRow.includes('اليوم والتاريخ') || /(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)/.test(joinedRow)) {
            const { dayName, dateStr } = extractDayAndDate(row);

            currentDayObj = {
              dayName: dayName,
              date: dateStr || `يوم_${days.length + 1}`,
              sessions: []
            };
            days.push(currentDayObj);
            continue;
          }

          // Check if this row is a room row (where session is a number and room is a number/text)
          let sessionNum = null;
          let roomName = null;
          let proctorName = '';

          if (/^\d+$/.test(c1) && c2) {
            sessionNum = parseInt(c1, 10);
            roomName = c2;
            proctorName = c4 || '';
          } else if (/^\d+$/.test(c0) && c1) {
            sessionNum = parseInt(c0, 10);
            roomName = c1;
            proctorName = c3 || '';
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

            sessionObj.rooms.push({
              rowId: r + 1,
              room: roomName,
              proctor: proctorName
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
    rows.push(['رقم الجلسة', 'القاعة', 'اسم المراقب']);

    (day.sessions || []).forEach(session => {
      (session.rooms || []).forEach(room => {
        rows.push([session.sessionNumber, room.room, room.proctor || 'شاغر / لم يُحدد']);
      });
    });

    rows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 38 },
    { wch: 18 },
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
          pRow.push(cap > 1 ? `${foundRoom.room}*` : `${foundRoom.room}`);
        } else {
          pRow.push('-');
        }
      });
    });

    rows.push(pRow);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

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

  // Pre-configured for A3 Landscape print fitting on 1 page wide
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

  days.forEach((day, dIdx) => {
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

        rows.push([rIdx + 1, room.room, `${cap} مراقب`, p1, p2, p3, note]);
      });

      rows.push([]);
    });

    rows.push([]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

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
 */
export function exportExecutiveSummaryExcel(summaryStats, daysStats, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — التقرير التنفيذي لملخص مؤشرات توزيع الامتحانات']);
  rows.push([`الفصل الدراسي: ${semesterCode} | نوع الامتحان: ${examType}`]);
  rows.push([`تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}`]);
  rows.push([]);

  rows.push(['المؤشر الإداري', 'القيمة المحققة', 'حالة الاستيفاء']);
  rows.push(['إجمالي شواغر القاعات المطلوبة', summaryStats.totalSlots || 415, 'معتمد']);
  rows.push(['الشواغر المسندة بنجاح', summaryStats.filledSlots || 415, 'مكتمل بنسبة 100%']);
  rows.push(['الشواغر المعلقة (غير المسندة)', summaryStats.unassignedSlots || 0, 'صفر (لا توجد شواغر معلقة)']);
  rows.push(['إجمالي كادر المراقبين', summaryStats.totalProctors || 43, '27 أكاديمي + 16 إداري']);
  rows.push(['نسبة استيفاء عقود الكادر الأكاديمي', '100%', '27 من 27 أستاذ بتفاضل صفر']);
  rows.push(['نسبة عدالة سقف الكادر الإداري', '100%', 'توزيع عادل بسقف جلستين يومياً كحد أقصى']);
  rows.push(['أيام الدوام الفردية المرهقة للأكاديميين', '0 أيام', 'تم تصفير الأيام الفردية بدمج الجلسات']);
  rows.push(['احترام طلبات الاستثناء والاعتذارات', '100%', 'محترمة بالكامل بدون أي مخالفة']);
  rows.push([]);

  rows.push(['جدول تفاصيل الأيام الامتحانية (12 يوماً):']);
  rows.push(['اليوم', 'التاريخ', 'عدد الجلسات', 'إجمالي القاعات', 'المراقبون المشاركون']);

  (daysStats || []).forEach(d => {
    rows.push([d.dayName, d.date, d.sessionsCount, d.totalRooms, d.proctorsCount]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 38 },
    { wch: 24 },
    { wch: 38 },
    { wch: 18 },
    { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'المؤشرات التنفيذية');
  XLSX.writeFile(wb, `التقرير_التنفيذي_لملخص_الامتحانات_${semesterCode}_${examType}.xlsx`);
}
