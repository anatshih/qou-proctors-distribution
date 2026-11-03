const https = require('https');

function runReservedDistribution(scheduleDays, proctorsList) {
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

  // Flatten all slots
  const allSlots = [];
  days.forEach((day, dayIndex) => {
    (day.sessions || []).forEach(session => {
      const sessionNum = Number(session.sessionNumber) || 1;
      (session.rooms || []).forEach(roomObj => {
        const capacity = Math.max(1, Number(roomObj.capacity) || 1);
        roomObj.capacity = capacity;
        roomObj.assignedProctors = [];
        for (let slot = 0; slot < capacity; slot++) {
          allSlots.push({
            dayIndex,
            date: day.date,
            dayName: day.dayName,
            sessionNumber: sessionNum,
            roomObj,
            slotIndex: slot
          });
        }
      });
    });
  });

  const totalSlots = allSlots.length;
  let filledSlots = 0;
  const unassignedSlots = [];

  const sessionProctorMap = new Map();
  const getProctorSet = (date, sNum) => {
    const key = `${date}_s${sNum}`;
    if (!sessionProctorMap.has(key)) sessionProctorMap.set(key, new Set());
    return sessionProctorMap.get(key);
  };

  // Process all slots
  allSlots.forEach((slot, slotIdx) => {
    const { date, dayName, sessionNumber, roomObj, dayIndex } = slot;
    const proctorsInSession = getProctorSet(date, sessionNumber);
    const slotsRemainingAhead = totalSlots - slotIdx;

    // Calculate total remaining quota needed by all academics
    const totalAcademicQuotaNeeded = activeProctors
      .filter(p => p.type === 'academic')
      .reduce((sum, p) => sum + (p.quota - p.assignedCount), 0);

    // If remaining slots <= academic quota needed, reserve strictly for academics!
    const reserveStrictlyForAcademics = slotsRemainingAhead <= (totalAcademicQuotaNeeded + 2);

    const eligibleCandidates = activeProctors.filter(proctor => {
      if (proctor.assignedCount >= proctor.quota) return false;
      if (proctorsInSession.has(proctor.id)) return false;
      if (proctor.exceptions.has(`${date}_all`) || proctor.exceptions.has(`${date}_s${sessionNumber}`)) return false;
      if (sessionNumber === 3 && proctor.excludeSession3) return false;

      // If strictly reserved for academics, exclude administrators
      if (reserveStrictlyForAcademics && proctor.type === 'administrative') {
        return false;
      }

      const todayCount = proctor.dailySessionCount[date] || 0;
      if (proctor.type === 'administrative') {
        // Admin max 2 sessions per day
        if (todayCount >= 2) return false;
      } else {
        // Academics max 3 sessions per day if needed
        if (todayCount >= 3) return false;
      }

      return true;
    });

    if (eligibleCandidates.length === 0) {
      unassignedSlots.push({ date, dayName, session: sessionNumber, room: roomObj.room });
      return;
    }

    // Score candidates
    eligibleCandidates.sort((a, b) => {
      const todaySessionsA = a.dailySessions[date] || new Set();
      const todaySessionsB = b.dailySessions[date] || new Set();
      const todayCountA = a.dailySessionCount[date] || 0;
      const todayCountB = b.dailySessionCount[date] || 0;

      const remA = a.quota - a.assignedCount;
      const remB = b.quota - b.assignedCount;
      const ratioA = a.assignedCount / a.quota;
      const ratioB = b.assignedCount / b.quota;

      let scoreA = (1 - ratioA) * 20000 + remA * 150;
      let scoreB = (1 - ratioB) * 20000 + remB * 150;

      // Academic contract priority
      if (a.type === 'academic') scoreA += 15000;
      if (b.type === 'academic') scoreB += 15000;

      // Consecutive pairing bonus
      if (sessionNumber === 2 && todaySessionsA.has(1)) scoreA += 12000;
      if (sessionNumber === 2 && todaySessionsB.has(1)) scoreB += 12000;
      if (sessionNumber === 3 && todaySessionsA.has(2)) scoreA += 12000;
      if (sessionNumber === 3 && todaySessionsB.has(2)) scoreB += 12000;

      // Admin smooth daily presence & 1+3
      if (a.type === 'administrative') {
        if (todayCountA === 0) scoreA += 3000;
        if (sessionNumber === 3 && todaySessionsA.has(1)) scoreA += 5000;
      }
      if (b.type === 'administrative') {
        if (todayCountB === 0) scoreB += 3000;
        if (sessionNumber === 3 && todaySessionsB.has(1)) scoreB += 5000;
      }

      // Demote 3rd session on same day
      if (todayCountA >= 2) scoreA -= 30000;
      if (todayCountB >= 2) scoreB -= 30000;

      if (scoreB !== scoreA) return scoreB - scoreA;
      return remB - remA;
    });

    const selected = eligibleCandidates[0];
    roomObj.assignedProctors.push(selected.name);
    selected.assignedCount++;
    proctorsInSession.add(selected.id);
    selected.daysWorked.add(date);
    selected.dailySessionCount[date] = (selected.dailySessionCount[date] || 0) + 1;
    if (!selected.dailySessions[date]) selected.dailySessions[date] = new Set();
    selected.dailySessions[date].add(sessionNumber);
    selected.assignments.push({ dayIndex, date, dayName, sessionNumber, room: roomObj.room });
    filledSlots++;
  });

  return { totalSlots, filledSlots, unassignedSlots, activeProctors };
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

    const res = runReservedDistribution(scheduleDays, proctors);

    console.log('=== RESERVED MATHEMATICAL DISTRIBUTION RESULT ===');
    console.log('Total slots:', res.totalSlots);
    console.log('Filled slots:', res.filledSlots);
    console.log('Unassigned slots:', res.unassignedSlots.length);
    console.log('Coverage Rate:', Math.round((res.filledSlots / res.totalSlots) * 100) + '%');

    const acads = res.activeProctors.filter(p => p.type === 'academic');
    const acad100 = acads.filter(p => p.assignedCount === p.quota).length;
    console.log(`\nAcademics 100% Complete: ${acad100} / ${acads.length}`);
    acads.forEach(p => {
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (${p.assignedCount === p.quota ? '100% ✓' : 'فرق ' + (p.quota - p.assignedCount)})`);
    });

    console.log('\nAdmins:');
    const admins = res.activeProctors.filter(p => p.type === 'administrative');
    admins.forEach(p => {
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (سقف) [${Math.round((p.assignedCount / p.quota) * 100)}%]`);
    });
  });
});
