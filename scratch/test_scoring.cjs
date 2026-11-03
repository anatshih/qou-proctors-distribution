const https = require('https');

function simulateWithScoring(scoringFn, scheduleDays, proctorsList) {
  const days = JSON.parse(JSON.stringify(scheduleDays));
  const activeProctors = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      type: p.type === 'administrative' ? 'administrative' : 'academic',
      excludeSession3: Boolean(p.excludeSession3),
      preferredPair: p.preferredPair || 'any',
      quota: Number(p.quota),
      assignedCount: 0,
      exceptions: new Set(p.exceptions || []),
      assignments: [],
      daysWorked: new Set(),
      dailySessionCount: {},
      dailySessions: {}
    }));

  let totalSlots = 0;
  let filledSlots = 0;
  const unassignedSlots = [];

  days.forEach((day, dayIndex) => {
    const dayDate = day.date;
    const dayName = day.dayName;

    (day.sessions || []).forEach(session => {
      const sessionNum = Number(session.sessionNumber) || 1;
      const proctorsInThisSession = new Set();

      (session.rooms || []).forEach(roomObj => {
        const capacity = Math.max(1, Number(roomObj.capacity) || 1);
        roomObj.capacity = capacity;
        roomObj.assignedProctors = [];

        for (let slot = 0; slot < capacity; slot++) {
          totalSlots++;

          const eligibleCandidates = activeProctors.filter(proctor => {
            if (proctor.assignedCount >= proctor.quota) return false;
            if (proctorsInThisSession.has(proctor.id)) return false;

            const dayWideKey = dayDate + '_all';
            const sessionKey = dayDate + '_s' + sessionNum;
            if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) return false;

            if (sessionNum === 3 && proctor.excludeSession3) return false;

            // Strict No 1+3 Gap Rule for ACADEMICS ONLY
            if (sessionNum === 3 && proctor.type === 'academic') {
              const todaySessions = proctor.dailySessions[dayDate];
              if (todaySessions && todaySessions.has(1) && !todaySessions.has(2)) {
                return false;
              }
            }

            // Administrative staff daily ceiling: Max 2
            const todayCount = proctor.dailySessionCount[dayDate] || 0;
            if (proctor.type === 'administrative' && todayCount >= 2) return false;

            return true;
          });

          if (eligibleCandidates.length === 0) {
            unassignedSlots.push({ date: dayDate, dayName, session: sessionNum, room: roomObj.room });
            continue;
          }

          const normalCandidates = eligibleCandidates.filter(p => (p.dailySessionCount[dayDate] || 0) < 2);
          const candidatesToRank = normalCandidates.length > 0 ? normalCandidates : eligibleCandidates;

          candidatesToRank.sort((a, b) => {
            const scoreA = scoringFn(a, dayDate, sessionNum);
            const scoreB = scoringFn(b, dayDate, sessionNum);
            if (scoreB !== scoreA) return scoreB - scoreA;
            const remA = a.quota - a.assignedCount;
            const remB = b.quota - b.assignedCount;
            if (remB !== remA) return remB - remA;
            return Math.random() - 0.5;
          });

          const selected = candidatesToRank[0];
          roomObj.assignedProctors.push(selected.name);
          selected.assignedCount++;
          proctorsInThisSession.add(selected.id);
          selected.daysWorked.add(dayDate);
          selected.dailySessionCount[dayDate] = (selected.dailySessionCount[dayDate] || 0) + 1;
          if (!selected.dailySessions[dayDate]) selected.dailySessions[dayDate] = new Set();
          selected.dailySessions[dayDate].add(sessionNum);
          filledSlots++;
        }
      });
    });
  });

  return { totalSlots, filledSlots, unassignedCount: unassignedSlots.length, unassignedSlots, activeProctors };
}

const url = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const doc = JSON.parse(data);
    const fields = doc.fields;
    const proctors = fields.proctors.arrayValue.values.map((v, i) => {
      const m = v.mapValue.fields;
      return {
        id: m.id ? (m.id.stringValue || m.id.integerValue) : ('proc_' + (i + 1)),
        name: m.name ? m.name.stringValue : 'Unknown',
        quota: parseInt((m.quota ? (m.quota.integerValue || m.quota.stringValue) : 0), 10),
        type: m.type ? m.type.stringValue : (m.classification ? (m.classification.stringValue === 'academic' ? 'academic' : 'administrative') : 'academic'),
        isActive: m.isActive !== undefined ? m.isActive.booleanValue : (m.active !== undefined ? m.active.booleanValue : true),
        excludeSession3: m.excludeSession3 ? m.excludeSession3.booleanValue : false,
        preferredPair: m.preferredPair ? m.preferredPair.stringValue : 'any',
        exceptions: []
      };
    });

    const scheduleDays = fields.scheduleDays.arrayValue.values.map((dVal, dIdx) => {
      const dMap = dVal.mapValue.fields;
      const dayNumber = dIdx + 1;
      const dayName = dMap.dayName ? dMap.dayName.stringValue : '';
      const date = dMap.date ? dMap.date.stringValue : '';
      const sessions = (dMap.sessions.arrayValue ? dMap.sessions.arrayValue.values : []).map(sVal => {
        const sMap = sVal.mapValue.fields;
        const sessionNumber = parseInt((sMap.sessionNumber ? (sMap.sessionNumber.integerValue || sMap.sessionNumber.stringValue) : 1), 10);
        const time = sMap.time ? sMap.time.stringValue : '';
        let rooms = [];
        if (sMap.rooms && sMap.rooms.arrayValue && sMap.rooms.arrayValue.values) {
          rooms = sMap.rooms.arrayValue.values.map((rVal, rIdx) => {
            const rMap = rVal.mapValue ? rVal.mapValue.fields : {};
            const rName = rMap.name ? (rMap.name.stringValue || rMap.name.integerValue) : ('Room ' + (rIdx + 1));
            const rCapacity = rMap.capacity ? parseInt(rMap.capacity.integerValue || 1, 10) : 1;
            return { id: 'r_' + dIdx + '_' + sessionNumber + '_' + rIdx, room: String(rName), name: String(rName), capacity: rCapacity };
          });
        }
        return { sessionNumber, time, rooms };
      });
      return { dayNumber, dayName, date, sessions };
    });

    function strictAcademicObligationScore(candidate, dayDate, sessionNum) {
      let score = 0;
      const todaySessions = candidate.dailySessions[dayDate] || new Set();
      const todayCount = candidate.dailySessionCount[dayDate] || 0;
      const remainingQuota = candidate.quota - candidate.assignedCount;
      const progressRatio = candidate.quota > 0 ? (candidate.assignedCount / candidate.quota) : 1;

      // 1. Mandatory Academic Contract Obligation (+30,000 pts)
      // Academics MUST fulfill 100% of their teaching contract quota first
      if (candidate.type === 'academic') {
        score += 30000;
        score += (1 - progressRatio) * 15000;
        score += remainingQuota * 150;
        if (sessionNum === 2 && todaySessions.has(1)) score += 12000;
        if (sessionNum === 3 && todaySessions.has(2)) score += 12000;
      } else {
        // Administrative: Ceiling only. Distributed fairly among all admins.
        score += (1 - progressRatio) * 18000;
        score += remainingQuota * 120;
        if (todayCount === 0) score += 2000;
        if (sessionNum === 3 && todaySessions.has(1)) score += 5000;
      }

      // Emergency 3rd session demotion
      if (todayCount >= 2) score -= 40000;

      return score;
    }

    const res = simulateWithScoring(strictAcademicObligationScore, scheduleDays, proctors);
    console.log('Total slots:', res.totalSlots, 'Filled:', res.filledSlots, 'Unassigned:', res.unassignedCount);
    
    const acads = res.activeProctors.filter(p => p.type === 'academic');
    const acad100 = acads.filter(p => p.assignedCount === p.quota).length;
    console.log('Academics 100% fulfillment:', acad100, '/', acads.length);
    acads.filter(p => p.assignedCount < p.quota).forEach(p => console.log(' - ' + p.name + ': ' + p.assignedCount + ' / ' + p.quota));

    console.log('\nAdmins:');
    const admins = res.activeProctors.filter(p => p.type === 'administrative');
    admins.forEach(p => console.log(' - ' + p.name + ': ' + p.assignedCount + ' / ' + p.quota + ' (' + Math.round((p.assignedCount/p.quota)*100) + '%)'));
  });
});
