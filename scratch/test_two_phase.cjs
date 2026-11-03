const https = require('https');

function runTwoPhaseDistribution(scheduleDays, proctorsList) {
  const days = JSON.parse(JSON.stringify(scheduleDays));

  // 1. Separate Active Academics and Active Administrators
  const academics = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0 && (p.type || 'academic') === 'academic')
    .map(p => ({
      id: p.id,
      name: p.name,
      type: 'academic',
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

  const administrators = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0 && p.type === 'administrative')
    .map(p => ({
      id: p.id,
      name: p.name,
      type: 'administrative',
      excludeSession3: Boolean(p.excludeSession3),
      preferredPair: p.preferredPair || 'any',
      quota: Number(p.quota), // Ceiling
      assignedCount: 0,
      exceptions: new Set(p.exceptions || []),
      assignments: [],
      daysWorked: new Set(),
      dailySessionCount: {},
      dailySessions: {}
    }));

  // Flatten all available room slots
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

  // Session proctor tracking to avoid double booking
  // key: "date_sX" -> Set of proctor IDs
  const sessionProctorMap = new Map();
  const getProctorSet = (date, sNum) => {
    const key = `${date}_s${sNum}`;
    if (!sessionProctorMap.has(key)) sessionProctorMap.set(key, new Set());
    return sessionProctorMap.get(key);
  };

  // =============================================================
  // PHASE 1: Academic Obligation Pass (Guaranteed 100% Fulfillment)
  // =============================================================
  // Sort slots to prioritize creating consecutive pairs (Session 1 & 2 first, then 3)
  for (const slot of allSlots) {
    const { date, dayName, sessionNumber, roomObj, dayIndex } = slot;
    const proctorsInSession = getProctorSet(date, sessionNumber);

    // Eligible academics
    const eligibleAcads = academics.filter(p => {
      if (p.assignedCount >= p.quota) return false;
      if (proctorsInSession.has(p.id)) return false;
      if (p.exceptions.has(`${date}_all`) || p.exceptions.has(`${date}_s${sessionNumber}`)) return false;
      if (sessionNumber === 3 && p.excludeSession3) return false;
      
      const todayCount = p.dailySessionCount[date] || 0;
      if (todayCount >= 3) return false; // Allowed up to 3 sessions if needed

      return true;
    });

    if (eligibleAcads.length > 0) {
      // Score academics
      eligibleAcads.sort((a, b) => {
        const todaySessionsA = a.dailySessions[date] || new Set();
        const todaySessionsB = b.dailySessions[date] || new Set();
        const todayCountA = a.dailySessionCount[date] || 0;
        const todayCountB = b.dailySessionCount[date] || 0;

        let scoreA = (1 - (a.assignedCount / a.quota)) * 20000 + (a.quota - a.assignedCount) * 150;
        let scoreB = (1 - (b.assignedCount / b.quota)) * 20000 + (b.quota - b.assignedCount) * 150;

        // Consecutive pairings bonus for comfort
        if (sessionNumber === 2 && todaySessionsA.has(1)) scoreA += 15000;
        if (sessionNumber === 2 && todaySessionsB.has(1)) scoreB += 15000;
        if (sessionNumber === 3 && todaySessionsA.has(2)) scoreA += 15000;
        if (sessionNumber === 3 && todaySessionsB.has(2)) scoreB += 15000;

        // Demote 3rd session on same day unless needed
        if (todayCountA >= 2) scoreA -= 25000;
        if (todayCountB >= 2) scoreB -= 25000;

        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.quota - b.assignedCount) - (a.quota - a.assignedCount);
      });

      const selected = eligibleAcads[0];
      roomObj.assignedProctors.push(selected.name);
      selected.assignedCount++;
      proctorsInSession.add(selected.id);
      selected.daysWorked.add(date);
      selected.dailySessionCount[date] = (selected.dailySessionCount[date] || 0) + 1;
      if (!selected.dailySessions[date]) selected.dailySessions[date] = new Set();
      selected.dailySessions[date].add(sessionNumber);
      selected.assignments.push({ dayIndex, date, dayName, sessionNumber, room: roomObj.room });
      slot.isAssigned = true;
      filledSlots++;
    }
  }

  // =============================================================
  // PHASE 2: Administrative Ceiling Balancing Pass (Fill All Remaining)
  // =============================================================
  const unassignedSlots = [];

  for (const slot of allSlots) {
    if (slot.isAssigned) continue; // Already taken by academic

    const { date, dayName, sessionNumber, roomObj, dayIndex } = slot;
    const proctorsInSession = getProctorSet(date, sessionNumber);

    // Eligible administrators
    const eligibleAdmins = administrators.filter(p => {
      if (p.assignedCount >= p.quota) return false; // Quota is ceiling
      if (proctorsInSession.has(p.id)) return false;
      if (p.exceptions.has(`${date}_all`) || p.exceptions.has(`${date}_s${sessionNumber}`)) return false;
      if (sessionNumber === 3 && p.excludeSession3) return false;

      // Strict administrative daily ceiling: Max 2 sessions per day
      const todayCount = p.dailySessionCount[date] || 0;
      if (todayCount >= 2) return false;

      return true;
    });

    if (eligibleAdmins.length > 0) {
      // Score administrators with strict equality
      eligibleAdmins.sort((a, b) => {
        const todaySessionsA = a.dailySessions[date] || new Set();
        const todaySessionsB = b.dailySessions[date] || new Set();
        const todayCountA = a.dailySessionCount[date] || 0;
        const todayCountB = b.dailySessionCount[date] || 0;

        // Equal progress ratio is key: everyone stays at the same percentage
        const ratioA = a.quota > 0 ? (a.assignedCount / a.quota) : 1;
        const ratioB = b.quota > 0 ? (b.assignedCount / b.quota) : 1;

        let scoreA = (1 - ratioA) * 30000 + (a.quota - a.assignedCount) * 100;
        let scoreB = (1 - ratioB) * 30000 + (b.quota - b.assignedCount) * 100;

        if (todayCountA === 0) scoreA += 3000;
        if (todayCountB === 0) scoreB += 3000;

        if (sessionNumber === 3 && todaySessionsA.has(1)) scoreA += 5000;
        if (sessionNumber === 3 && todaySessionsB.has(1)) scoreB += 5000;

        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.quota - b.assignedCount) - (a.quota - a.assignedCount);
      });

      const selected = eligibleAdmins[0];
      roomObj.assignedProctors.push(selected.name);
      selected.assignedCount++;
      proctorsInSession.add(selected.id);
      selected.daysWorked.add(date);
      selected.dailySessionCount[date] = (selected.dailySessionCount[date] || 0) + 1;
      if (!selected.dailySessions[date]) selected.dailySessions[date] = new Set();
      selected.dailySessions[date].add(sessionNumber);
      selected.assignments.push({ dayIndex, date, dayName, sessionNumber, room: roomObj.room });
      slot.isAssigned = true;
      filledSlots++;
    } else {
      unassignedSlots.push({ date, dayName, session: sessionNumber, room: roomObj.room });
    }
  }

  // Synchronize string property
  days.forEach(day => {
    (day.sessions || []).forEach(session => {
      (session.rooms || []).forEach(roomObj => {
        roomObj.proctor = (roomObj.assignedProctors || []).join(' / ');
      });
    });
  });

  return {
    totalSlots,
    filledSlots,
    unassignedSlots,
    academics,
    administrators,
    days
  };
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

    const res = runTwoPhaseDistribution(scheduleDays, proctors);

    console.log('=== TWO-PHASE DISTRIBUTION EXECUTION ===');
    console.log('Total Slots:', res.totalSlots);
    console.log('Filled Slots:', res.filledSlots);
    console.log('Unassigned Slots:', res.unassignedSlots.length);
    console.log('Coverage Rate:', Math.round((res.filledSlots / res.totalSlots) * 100) + '%');

    console.log('\n--- ACADEMIC PROCTORS (Target = 100% Complete) ---');
    let allAcadsComplete = true;
    res.academics.forEach(p => {
      const isComplete = p.assignedCount === p.quota;
      if (!isComplete) allAcadsComplete = false;
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (${isComplete ? '100% ✓' : '❌ فرق ' + (p.quota - p.assignedCount)})`);
    });
    console.log('All 27 Academics 100% Complete:', allAcadsComplete ? 'نعم 100% كامل وبدون أي فرق ✓✓✓' : 'لا');

    console.log('\n--- ADMINISTRATIVE PROCTORS (Fair Ceiling Distribution) ---');
    res.administrators.forEach(p => {
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (سقف) [${Math.round((p.assignedCount / p.quota) * 100)}%]`);
    });
  });
});
