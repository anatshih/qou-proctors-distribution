// scratch/run_live_distribution.cjs
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

async function main() {
  const filePathSchedule = path.resolve(__dirname, '../توزيع المراقبين  1261.xlsx');
  const filePathQuotas = path.resolve(__dirname, '../نسخة من تفريغ المراقبات-نصفي 1261.xls');

  // 1. Extract Proctors and Quotas from File 2
  const wbQuotas = XLSX.readFile(filePathQuotas);
  const wsQuotas = wbQuotas.Sheets[wbQuotas.SheetNames[0]];
  const quotaRows = XLSX.utils.sheet_to_json(wsQuotas, { header: 1, raw: false, defval: '' });

  const proctorsWithQuotas = [];
  for (let r = 5; r < quotaRows.length; r++) {
    const row = quotaRows[r];
    const name = String(row[0] || '').trim();
    const quotaVal = parseInt(row[1], 10);
    if (name && !isNaN(quotaVal) && quotaVal > 0) {
      proctorsWithQuotas.push({
        id: `proc_${proctorsWithQuotas.length + 1}`,
        name,
        quota: quotaVal,
        isActive: true,
        type: 'academic',
        excludeSession3: false,
        preferredPair: 'any',
        exceptions: []
      });
    }
  }

  // 2. Parse Schedule from File 1
  const wbSched = XLSX.readFile(filePathSchedule, { cellDates: true });
  const wsSched = wbSched.Sheets[wbSched.SheetNames[0]];
  const schedRows = XLSX.utils.sheet_to_json(wsSched, { header: 1, raw: false, defval: '' });

  const days = [];
  let currentDay = null;
  let totalSlots = 0;

  for (let r = 0; r < schedRows.length; r++) {
    const row = schedRows[r];
    const c0 = String(row[0] || '').trim();
    const c1 = String(row[1] || '').trim();
    const c2 = String(row[2] || '').trim();
    const c3 = String(row[3] || '').trim();
    const c4 = String(row[4] || '').trim();

    const joined = `${c0} ${c1} ${c2} ${c3} ${c4}`;

    if (joined.includes('اليوم والتاريخ') || /(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)/.test(joined)) {
      // Find day and date in row
      let dayName = '';
      let dateStr = '';
      for (let cell of row) {
        const str = String(cell || '').trim();
        if (/(السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)/.test(str)) {
          dayName = str;
        } else if (/\d+\/\d+\/\d+/.test(str)) {
          dateStr = str;
        }
      }

      currentDay = {
        dayName: dayName || 'يوم امتحان',
        date: dateStr || `يوم_${days.length + 1}`,
        sessions: []
      };
      days.push(currentDay);
      continue;
    }

    // Room row
    let sessionNum = null;
    let roomName = null;

    if (/^\d+$/.test(c1) && c2) {
      sessionNum = parseInt(c1, 10);
      roomName = c2;
    } else if (/^\d+$/.test(c0) && c1) {
      sessionNum = parseInt(c0, 10);
      roomName = c1;
    }

    if (sessionNum !== null && roomName && !roomName.includes('القاعة')) {
      totalSlots++;
      if (!currentDay) {
        currentDay = { dayName: 'اليوم الأول', date: '11/7/2026', sessions: [] };
        days.push(currentDay);
      }

      let sessionObj = currentDay.sessions.find(s => s.sessionNumber === sessionNum);
      if (!sessionObj) {
        sessionObj = { sessionNumber: sessionNum, rooms: [] };
        currentDay.sessions.push(sessionObj);
      }

      sessionObj.rooms.push({
        room: roomName,
        capacity: 1,
        assignedProctors: []
      });
    }
  }

  // 3. Run Proctor Distribution
  const enginePath = path.resolve(__dirname, '../src/utils/distributionEngine.js');
  const { runProctorDistribution } = await import('file:///' + enginePath.replace(/\\/g, '/'));

  const result = runProctorDistribution(days, proctorsWithQuotas);

  console.log('=== REAL UNIVERSITY EXAM SCHEDULE EXECUTION RESULT ===');
  console.log(`Exam Days: ${days.length}`);
  console.log(`Total Room Slots: ${result.summary.totalSlots}`);
  console.log(`Active Proctors in Roster: ${result.summary.activeProctorsCount}`);
  console.log(`Total Quotas Sum: ${result.summary.totalQuota}`);
  console.log(`Filled Slots: ${result.summary.filledSlots}`);
  console.log(`Unassigned Slots: ${result.summary.unassignedSlotsCount}`);
  console.log(`Coverage Rate: ${result.summary.coverageRate}%`);
  console.log(`Consecutive Session Pairings (1+2 or 2+3): ${result.summary.consecutivePairsCount}`);
  console.log(`Gap Violations (1 and 3): ${result.summary.gapViolationCount}`);
  console.log(`3-Session Days (emergency only): ${result.summary.threeSessionDaysCount}`);

  // Summary of days
  console.log('\n--- Day by Day Breakdown ---');
  result.schedule.forEach((day, idx) => {
    let dayRooms = 0;
    day.sessions.forEach(s => dayRooms += s.rooms.length);
    console.log(`يوم ${idx + 1}: ${day.dayName} (${day.date}) - ${day.sessions.length} جلسات - ${dayRooms} قاعة`);
    day.sessions.forEach(s => {
      console.log(`   جلسة ${s.sessionNumber}: ${s.rooms.length} قاعات -> [${s.rooms.map(r => `${r.room}: ${r.proctor}`).slice(0, 4).join(', ')}${s.rooms.length > 4 ? '...' : ''}]`);
    });
  });

  // Proctor Quota Fulfillment
  console.log('\n--- Proctor Quota Fulfillment Sample (First 15) ---');
  result.proctorStats.slice(0, 15).forEach(p => {
    console.log(`${p.name} | المطلوب: ${p.quota} | المنفذ: ${p.assignedCount} (${p.completionRate}%) | فرق: ${p.difference}`);
  });
}

main().catch(console.error);
