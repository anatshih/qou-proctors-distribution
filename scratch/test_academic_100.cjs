const https = require('https');

function runSimulation(scheduleDays, proctorsList) {
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

          // Eligible candidates check
          const eligibleCandidates = activeProctors.filter(proctor => {
            // 1. Quota check: must have remaining quota
            if (proctor.assignedCount >= proctor.quota) return false;

            // 2. Physical double-booking check: cannot proctor two rooms in same session
            if (proctorsInThisSession.has(proctor.id)) return false;

            // 3. Explicit date / session exceptions check (Inviolable)
            const dayWideKey = `${dayDate}_all`;
            const sessionKey = `${dayDate}_s${sessionNum}`;
            if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) return false;

            // 4. Explicit Session 3 exclusion check (Inviolable)
            if (sessionNum === 3 && proctor.excludeSession3) return false;

            // 5. Daily session limits:
            const todayCount = proctor.dailySessionCount[dayDate] || 0;
            if (proctor.type === 'administrative') {
              // Administrative staff: strict MAX 2 sessions per day (to protect office work)
              if (todayCount >= 2) return false;
            } else {
              // Academic staff: Max 3 sessions per day (permitted to ensure 100% completion)
              if (todayCount >= 3) return false;
            }

            return true;
          });

          if (eligibleCandidates.length === 0) {
            unassignedSlots.push({ date: dayDate, dayName, session: sessionNum, room: roomObj.room });
            continue;
          }

          // Candidate Scoring & Selection
          eligibleCandidates.sort((a, b) => {
            const scoreA = calculateScore(a, dayDate, sessionNum);
            const scoreB = calculateScore(b, dayDate, sessionNum);
            if (scoreB !== scoreA) return scoreB - scoreA;
            const remA = a.quota - a.assignedCount;
            const remB = b.quota - b.assignedCount;
            if (remB !== remA) return remB - remA;
            return Math.random() - 0.5;
          });

          const selected = eligibleCandidates[0];
          roomObj.assignedProctors.push(selected.name);
          selected.assignedCount++;
          proctorsInThisSession.add(selected.id);
          selected.daysWorked.add(dayDate);
          selected.dailySessionCount[dayDate] = (selected.dailySessionCount[dayDate] || 0) + 1;
          if (!selected.dailySessions[dayDate]) selected.dailySessions[dayDate] = new Set();
          selected.dailySessions[dayDate].add(sessionNum);
          selected.assignments.push({
            dayIndex,
            date: dayDate,
            dayName,
            sessionNumber: sessionNum,
            room: roomObj.room
          });
          filledSlots++;
        }
      });
    });
  });

  return { totalSlots, filledSlots, unassignedSlots, activeProctors };
}

function calculateScore(candidate, dayDate, sessionNum) {
  let score = 0;
  const todaySessions = candidate.dailySessions[dayDate] || new Set();
  const todayCount = candidate.dailySessionCount[dayDate] || 0;
  const remainingQuota = candidate.quota - candidate.assignedCount;
  const progressRatio = candidate.quota > 0 ? (candidate.assignedCount / candidate.quota) : 1;

  // 1. Mandatory Academic Contract Priority (+50,000 pts)
  // Ensures academics are picked first to guarantee 100% completion
  if (candidate.type === 'academic') {
    score += 50000;
    // Prioritize academics who have more remaining quota or are behind in progress
    score += (1 - progressRatio) * 15000;
    score += remainingQuota * 200;

    // Consecutive session comfort bonus for academics (+12,000 pts)
    if (sessionNum === 2 && todaySessions.has(1)) score += 12000;
    if (sessionNum === 3 && todaySessions.has(2)) score += 12000;

    // Penalty for 3rd session on same day (allowed, but prefer 1 or 2 if other academics available)
    if (todayCount >= 2) score -= 15000;
  } else {
    // 2. Administrative Ceiling & Fair Proportional Balancing
    // Administrators progress together in parallel (balanced percentage of ceiling)
    score += (1 - progressRatio) * 20000;
    score += remainingQuota * 150;

    if (todayCount === 0) score += 2500; // Natural steady daily presence across the schedule
    if (sessionNum === 3 && todaySessions.has(1)) score += 5000; // 1+3 session is completely allowed
  }

  // Preferred pair respect
  if (candidate.preferredPair === '1-2') {
    if (sessionNum === 1 || sessionNum === 2) score += 3000;
    if (sessionNum === 3) score -= 8000;
  } else if (candidate.preferredPair === '2-3') {
    if (sessionNum === 2 || sessionNum === 3) score += 3000;
    if (sessionNum === 1) score -= 8000;
  }

  return score;
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

    const res = runSimulation(scheduleDays, proctors);

    console.log('=== SIMULATION RESULTS ===');
    console.log('Total slots:', res.totalSlots);
    console.log('Filled slots:', res.filledSlots);
    console.log('Unassigned slots:', res.unassignedSlots.length);
    console.log('Coverage Rate:', Math.round((res.filledSlots / res.totalSlots) * 100) + '%');

    console.log('\n--- ACADEMIC PROCTORS (Must be 100% complete) ---');
    const acads = res.activeProctors.filter(p => p.type === 'academic');
    let allAcadsComplete = true;
    acads.forEach(p => {
      const isComplete = p.assignedCount === p.quota;
      if (!isComplete) allAcadsComplete = false;
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (${isComplete ? '100% كامل ✓' : '❌ ناقص ' + (p.quota - p.assignedCount)})`);
    });
    console.log('\nAll Academics 100% Complete:', allAcadsComplete ? 'نعم 100% تماماً ✓' : 'لا');

    console.log('\n--- ADMINISTRATIVE PROCTORS (Balanced Ceiling) ---');
    const admins = res.activeProctors.filter(p => p.type === 'administrative');
    admins.forEach(p => {
      console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (سقف) [${Math.round((p.assignedCount / p.quota) * 100)}%]`);
    });
  });
});
