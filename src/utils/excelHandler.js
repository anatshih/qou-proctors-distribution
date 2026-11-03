import * as XLSX from 'xlsx';

/**
 * Parse an uploaded exam room schedule Excel file
 */
export function parseUploadedSchedule(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

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
          if (joinedRow.includes('اليوم والتاريخ') || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(joinedRow)) {
            // Find date and day name
            let dateMatch = joinedRow.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
            let dateStr = dateMatch ? dateMatch[0] : '';
            
            // Look for Arabic day name
            let dayNameMatch = joinedRow.match(/(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)/);
            let dayName = dayNameMatch ? dayNameMatch[0] : (c3 || c2 || 'يوم امتحان');

            currentDayObj = {
              dayName: dayName,
              date: dateStr || `يوم_${days.length + 1}`,
              sessions: []
            };
            days.push(currentDayObj);
            continue;
          }

          // Check if this row is a room row (where session is a number and room is a number/text)
          // In the standard template: col 1 is session number, col 2 is room number, col 4 is proctor name
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
                date: '1/1/2026',
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
  rows.push(['جامعة القدس المفتوحة']);
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

    rows.push([]); // Empty row separator between days
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // رقم الجلسة
    { wch: 15 }, // القاعة
    { wch: 38 }, // اسم المراقب
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

  // Header 1: Main Title
  rows.push(['جامعة القدس المفتوحة - مصفوفة تفريغ ومتابعة أنصبة المراقبين']);
  rows.push([`الفصل الدراسي: ${semesterCode} - الامتحان: ${examType}`]);
  rows.push([]);

  // Build columns for days and sessions
  // Day row
  const dayRow = ['اسم المراقب', 'الحالة', 'النصاب المطلوب', 'المنفذ', 'الفرق'];
  // Session row
  const sessionRow = ['', '', '', '', ''];

  days.forEach((day, dIdx) => {
    (day.sessions || []).forEach(sess => {
      dayRow.push(`${day.dayName} (${day.date})`);
      sessionRow.push(`جلسة ${sess.sessionNumber}`);
    });
  });

  rows.push(dayRow);
  rows.push(sessionRow);

  // Populate proctor rows
  proctorStats.forEach(p => {
    const pRow = [
      p.name,
      p.isActive ? 'نشط' : 'مجمّد',
      p.quota,
      p.assignedCount,
      p.difference
    ];

    // For each day & session column, check if this proctor is assigned
    days.forEach(day => {
      (day.sessions || []).forEach(sess => {
        const foundRoom = (sess.rooms || []).find(r => r.proctor === p.name);
        if (foundRoom) {
          pRow.push(`قاعة ${foundRoom.room}`);
        } else {
          pRow.push('-');
        }
      });
    });

    rows.push(pRow);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  
  // Set widths
  ws['!cols'] = [
    { wch: 35 }, // name
    { wch: 10 }, // status
    { wch: 14 }, // quota
    { wch: 12 }, // assigned
    { wch: 10 }, // diff
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'مصفوفة التفريغ');
  XLSX.writeFile(wb, `مصفوفة_تفريغ_المراقبين_${semesterCode}_${examType}.xlsx`);
}
