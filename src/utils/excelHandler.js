import * as XLSX from 'xlsx';

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
        dateStr = `${cell.getMonth() + 1}/${cell.getDate()}/${cell.getFullYear()}`;
      } else if (typeof cell === 'number' && cell > 30000 && cell < 60000) {
        // Excel serial date number
        const d = new Date(Math.round((cell - 25569) * 86400 * 1000));
        dateStr = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
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
 */
export function exportProctorsMatrixExcel(proctorStats, days, semesterCode, examType) {
  const wb = XLSX.utils.book_new();
  const rows = [];

  rows.push(['جامعة القدس المفتوحة — فرع الخليل']);
  rows.push(['قسم الامتحانات — مصفوفة تفريغ ومتابعة أنصبة المراقبين']);
  rows.push([`الفصل الدراسي: ${semesterCode} - الامتحان: ${examType}`]);
  rows.push([]);

  const dayRow = ['اسم المراقب', 'الحالة', 'النصاب المطلوب', 'المنفذ', 'الفرق'];
  const sessionRow = ['', '', '', '', ''];

  days.forEach((day) => {
    (day.sessions || []).forEach(sess => {
      dayRow.push(`${day.dayName} (${day.date})`);
      sessionRow.push(`جلسة ${sess.sessionNumber}`);
    });
  });

  rows.push(dayRow);
  rows.push(sessionRow);

  proctorStats.forEach(p => {
    const pRow = [
      p.name,
      p.isActive ? 'نشط' : 'مجمّد',
      p.quota,
      p.assignedCount,
      p.difference
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
          pRow.push(cap > 1 ? `قاعة ${foundRoom.room} (مشترك)` : `قاعة ${foundRoom.room}`);
        } else {
          pRow.push('-');
        }
      });
    });

    rows.push(pRow);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  ws['!cols'] = [
    { wch: 35 },
    { wch: 10 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'مصفوفة التفريغ');
  XLSX.writeFile(wb, `مصفوفة_تفريغ_المراقبين_${semesterCode}_${examType}.xlsx`);
}
