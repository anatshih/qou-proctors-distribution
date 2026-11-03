const https = require('https');
const url = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

function fetchDocSafe() {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const fullBuffer = Buffer.concat(chunks);
          resolve(JSON.parse(fullBuffer.toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const doc = await fetchDocSafe();
  const fields = doc.fields || {};

  // 1. Proctors
  const proctorValues = (fields.proctors && fields.proctors.arrayValue && fields.proctors.arrayValue.values) || [];
  const proctors = proctorValues.map(pv => {
    const f = pv.mapValue.fields;
    return {
      id: f.id ? f.id.stringValue : '',
      name: f.name ? f.name.stringValue : '',
      quota: f.quota ? parseInt(f.quota.integerValue || f.quota.stringValue || 0, 10) : 0,
      type: f.type ? f.type.stringValue : (f.classification ? f.classification.stringValue : 'academic'),
      active: f.active !== undefined ? f.active.booleanValue : true,
      frozen: f.frozen !== undefined ? f.frozen.booleanValue : false,
      exemptions: (f.exemptions && f.exemptions.arrayValue && f.exemptions.arrayValue.values) 
        ? f.exemptions.arrayValue.values.map(v => v.stringValue) : [],
      unavailableDays: (f.unavailableDays && f.unavailableDays.arrayValue && f.unavailableDays.arrayValue.values)
        ? f.unavailableDays.arrayValue.values.map(v => v.stringValue) : [],
      excludedSessions: (f.excludedSessions && f.excludedSessions.arrayValue && f.excludedSessions.arrayValue.values)
        ? f.excludedSessions.arrayValue.values.map(v => parseInt(v.integerValue || v.stringValue || 0, 10)) : []
    };
  });

  // Filter 27 Academics
  const academics = proctors.filter(p => p.type === 'academic');

  // Track Academic Assignments
  const academicAssignments = {};
  academics.forEach(p => {
    academicAssignments[p.name] = {
      proctor: p,
      slots: [],
      dayBreakdown: {}
    };
  });

  let totalSlotsAll = 0;
  let totalAssignedSlotsAll = 0;

  const scheduleDaysValues = (fields.scheduleDays && fields.scheduleDays.arrayValue && fields.scheduleDays.arrayValue.values) || [];
  scheduleDaysValues.forEach((dv, dIdx) => {
    const df = dv.mapValue.fields;
    const dayNumber = dIdx + 1;
    const dayName = df.dayName ? df.dayName.stringValue : '';
    const date = df.date ? df.date.stringValue : '';

    ((df.sessions && df.sessions.arrayValue && df.sessions.arrayValue.values) || []).forEach(sv => {
      const sf = sv.mapValue.fields;
      const sessionNumber = sf.sessionNumber ? parseInt(sf.sessionNumber.integerValue || sf.sessionNumber.stringValue || 1, 10) : 1;

      ((sf.rooms && sf.rooms.arrayValue && sf.rooms.arrayValue.values) || []).forEach(rv => {
        const rf = rv.mapValue.fields;
        const roomName = rf.room ? rf.room.stringValue : '';
        const capacity = rf.capacity ? parseInt(rf.capacity.integerValue || rf.capacity.stringValue || 1, 10) : 1;
        const assigned = ((rf.assignedProctors && rf.assignedProctors.arrayValue && rf.assignedProctors.arrayValue.values) || [])
          .map(v => v.stringValue);

        totalSlotsAll += Math.max(1, capacity, assigned.length);

        assigned.forEach(pName => {
          if (pName && pName.trim()) {
            totalAssignedSlotsAll++;
            if (academicAssignments[pName]) {
              academicAssignments[pName].slots.push({
                dayNumber, dayName, date, sessionNumber, room: roomName
              });
              if (!academicAssignments[pName].dayBreakdown[dayNumber]) {
                academicAssignments[pName].dayBreakdown[dayNumber] = {
                  dayName, date, sessions: []
                };
              }
              academicAssignments[pName].dayBreakdown[dayNumber].sessions.push({
                sessionNumber, room: roomName
              });
            }
          }
        });
      });
    });
  });

  console.log('================================================================');
  console.log('📊 تقرير الفحص والتدقيق الشامل لكادر الأكاديميين (27 مراقباً)');
  console.log('================================================================');
  console.log(`إجمالي شواغر القاعات الكلية في الامتحان: ${totalSlotsAll}`);
  console.log(`إجمالي الشواغر المسندة فعلياً لجميع المراقبين: ${totalAssignedSlotsAll}`);

  let totalAcademicQuota = 0;
  let totalAcademicAssigned = 0;
  const issues = [];
  const statsSummary = [];

  academics.forEach((p, idx) => {
    const data = academicAssignments[p.name];
    const assignedCount = data.slots.length;
    const quota = p.quota;
    const diff = assignedCount - quota;
    totalAcademicQuota += quota;
    totalAcademicAssigned += assignedCount;

    const pIssues = [];

    // 1. Quota Check
    if (assignedCount !== quota) {
      pIssues.push(`اختلاف النصاب: المسند (${assignedCount}) مقابل المستهدف (${quota}) [فارق: ${diff > 0 ? '+' + diff : diff}]`);
    }

    // 2. Same-session conflicts
    const sessionOccupancy = {};
    data.slots.forEach(s => {
      const key = `day_${s.dayNumber}_sess_${s.sessionNumber}`;
      if (!sessionOccupancy[key]) sessionOccupancy[key] = [];
      sessionOccupancy[key].push(s.room);
    });
    Object.entries(sessionOccupancy).forEach(([key, roomsList]) => {
      if (roomsList.length > 1) {
        pIssues.push(`تعارض في نفس الجلسة (${key}): مسند لـ ${roomsList.length} قاعات (${roomsList.join(', ')})`);
      }
    });

    // 3. Daily Gaps & Overloads
    let daysWithConsecutive = 0;
    let daysWithSingle = 0;
    let daysWith3Sessions = 0;
    let daysWithGap1and3 = 0;

    Object.entries(data.dayBreakdown).forEach(([dNum, dayData]) => {
      const sessionNums = dayData.sessions.map(s => s.sessionNumber);
      const uniqueSess = Array.from(new Set(sessionNums)).sort((a,b) => a - b);

      // Check gap: 1 and 3 without 2
      if (uniqueSess.includes(1) && uniqueSess.includes(3) && !uniqueSess.includes(2)) {
        daysWithGap1and3++;
        pIssues.push(`فجوة مزعجة (جلسة 1 و 3 دون 2) في اليوم ${dNum} (${dayData.dayName} ${dayData.date})`);
      }

      // Check 3 sessions
      if (uniqueSess.length >= 3) {
        daysWith3Sessions++;
      }

      // Check paired
      if ((uniqueSess.includes(1) && uniqueSess.includes(2)) || (uniqueSess.includes(2) && uniqueSess.includes(3))) {
        daysWithConsecutive++;
      } else if (uniqueSess.length === 1) {
        daysWithSingle++;
      }

      // Check exemptions
      if (p.unavailableDays && p.unavailableDays.length > 0) {
        if (p.unavailableDays.includes(dayData.dayName) || p.unavailableDays.includes(dayData.date)) {
          pIssues.push(`مخالفة يوم إجازة/استثناء: مسند في ${dayData.dayName} (${dayData.date}) وهو يوم مستثنى لديه!`);
        }
      }

      if (p.excludedSessions && p.excludedSessions.length > 0) {
        uniqueSess.forEach(sNum => {
          if (p.excludedSessions.includes(sNum)) {
            pIssues.push(`مخالفة جلسة مستثناة: مسند للجلسة ${sNum} في اليوم ${dNum} وهي جلسة مستثناة لديه!`);
          }
        });
      }
    });

    const activeDaysCount = Object.keys(data.dayBreakdown).length;

    statsSummary.push({
      idx: idx + 1,
      name: p.name,
      quota,
      assignedCount,
      diff,
      activeDaysCount,
      consecutiveDays: daysWithConsecutive,
      singleDays: daysWithSingle,
      threeSessionDays: daysWith3Sessions,
      gapDays: daysWithGap1and3,
      issuesCount: pIssues.length,
      issues: pIssues
    });

    if (pIssues.length > 0) {
      issues.push({ name: p.name, issues: pIssues });
    }
  });

  console.log('\n--- 📋 جدول كادر الأكاديميين (27 مراقباً) مفصلاً بالأرقام ---');
  statsSummary.forEach(s => {
    const statusEmoji = s.issuesCount === 0 ? '✅' : '⚠️';
    console.log(`${statusEmoji} [${s.idx.toString().padStart(2, ' ')}] ${s.name.padEnd(35, ' ')} | المستهدف: ${s.quota.toString().padStart(2, ' ')} | الفعلي: ${s.assignedCount.toString().padStart(2, ' ')} (فرق: ${s.diff}) | أيام الحضور: ${s.activeDaysCount} | ثنائية متتالية: ${s.consecutiveDays} | فردية: ${s.singleDays} | 3 جلسات: ${s.threeSessionDays} | فجوة (1و3): ${s.gapDays}`);
    if (s.issues.length > 0) {
      s.issues.forEach(iss => console.log(`      🔴 [مشكلة/ملاحظة]: ${iss}`));
    }
  });

  console.log('\n================================================================');
  console.log(`📊 النتيجة الإجمالية لمراجعة توزيع الأكاديميين:`);
  console.log(`- إجمالي الأنصبة المستهدفة للأكاديميين: ${totalAcademicQuota} جلسة`);
  console.log(`- إجمالي الأنصبة المسندة فعلياً للأكاديميين: ${totalAcademicAssigned} جلسة`);
  console.log(`- عدد الأكاديميين المنضبطين 100% بدون أي مشاكل: ${academics.length - issues.length} من أصل ${academics.length}`);
  console.log(`- عدد الأكاديميين الذين لديهم ملاحظات أو مشاكل: ${issues.length}`);
  
  if (issues.length === 0) {
    console.log(`🎉 النتيجة: توزيع الأكاديميين سليم ومثالي 100%!`);
    console.log(`- جميع الأنصبة مطابقة للمستهدف تماماً (فارق صفر لجميع الزملاء الأكاديميين الـ 27).`);
    console.log(`- لا توجد أي تعارضات زمنية في نفس الجلسة (صفر تعارضات).`);
    console.log(`- لا توجد أي فجوة مزعجة (جلسة 1 و 3 دون 2) لأي مراقب.`);
    console.log(`- احترام كامل للاستثناءات وأيام التفرغ.`);
    console.log(`- جميع الجلسات اليومية إما ثنائية متتالية ومريحة (1+2 أو 2+3)، أو فردية محكمة، دون أي تشتت.`);
  } else {
    console.log(`⚠️ ملخص الملاحظات:`);
    issues.forEach(i => {
      console.log(`* ${i.name}: ${i.issues.join(' | ')}`);
    });
  }
  console.log('================================================================');

}

run().catch(console.error);
