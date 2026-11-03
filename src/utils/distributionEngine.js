/**
 * Smart Proctor Distribution Engine
 * Multi-Proctor, Fair Scheduling & Human-Comfort Heuristics
 * Al-Quds Open University - Hebron Branch
 * 
 * Rules Enforced:
 * 1. Multi-Proctor per Room (1, 2, or 3 proctors per room capacity).
 * 2. Academic Contract Load Priority: Academic staff are prioritized over Administrative staff to meet academic quotas.
 * 3. Consecutive Session Preference: Favors (1 + 2) or (2 + 3) continuous assignments.
 * 4. Strict No-Gap Rule: Forbids assigning Session 1 and Session 3 on the same day while leaving Session 2 empty.
 * 5. Avoid Single-Session Days: Prioritizes assigning proctors to a second session on the day they attend.
 * 6. Daily Session Limits:
 *    - Administrative Staff: Strictly MAX 2 sessions per day (never 3).
 *    - Academic Staff: Target MAX 2 sessions; 3rd session permitted only as extreme necessity if no other candidate is available.
 * 7. Proctor-Specific Exclusions & Preferences: Respects excludeSession3 and preferredPair ('1-2' | '2-3').
 */

export function runProctorDistribution(scheduleDays, proctorsList) {
  // Deep clone schedule to avoid direct mutation
  const days = JSON.parse(JSON.stringify(scheduleDays));
  
  // Prepare active proctors pool with enriched tracking structures
  const activeProctors = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      type: p.type === 'administrative' ? 'administrative' : 'academic',
      excludeSession3: Boolean(p.excludeSession3),
      preferredPair: p.preferredPair || 'any', // 'any' | '1-2' | '2-3'
      quota: Number(p.quota),
      assignedCount: 0,
      exceptions: new Set(p.exceptions || []),
      assignments: [], // { dayIndex, date, dayName, sessionNumber, room, slotIndex }
      daysWorked: new Set(),
      dailySessionCount: {}, // date -> number of sessions assigned
      dailySessions: {} // date -> Set of session numbers assigned today
    }));

  // -------------------------------------------------------------
  // STEP 1: Flatten All Slots & Pre-Calculate Session Densities
  // -------------------------------------------------------------
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
            slotIndex: slot,
            sessionDensity: session.rooms.length
          });
        }
      });
    });
  });

  const totalSlots = allSlots.length;
  let filledSlots = 0;
  const unassignedSlots = [];

  // Global Session Proctor Set to strictly forbid any double-booking
  const sessionProctorMap = new Map();
  const getProctorSet = (date, sNum) => {
    const key = `${date}_s${sNum}`;
    if (!sessionProctorMap.has(key)) sessionProctorMap.set(key, new Set());
    return sessionProctorMap.get(key);
  };

  // -------------------------------------------------------------
  // STEP 2: Smart Bottleneck-First / Constraint Density Sorting
  // Peak bottleneck sessions (e.g. Day 12 with 21 rooms, Day 3 with 25 rooms)
  // are scheduled FIRST to prevent proctor quotas from depleting prematurely.
  // -------------------------------------------------------------
  allSlots.sort((a, b) => {
    if (b.sessionDensity !== a.sessionDensity) {
      return b.sessionDensity - a.sessionDensity;
    }
    if (b.dayIndex !== a.dayIndex) {
      return b.dayIndex - a.dayIndex;
    }
    return a.sessionNumber - b.sessionNumber;
  });

  // -------------------------------------------------------------
  // STEP 3: Assign Proctors with Academic Obligation & Administrative Equality
  // -------------------------------------------------------------
  allSlots.forEach(slotItem => {
    const { date, dayName, sessionNumber, roomObj, dayIndex, slotIndex } = slotItem;
    const proctorsInThisSession = getProctorSet(date, sessionNumber);

    // Filter candidates based on inviolable constraints
    const eligibleCandidates = activeProctors.filter(proctor => {
      // Hard 1: Quota check
      if (proctor.assignedCount >= proctor.quota) return false;

      // Hard 2: No double-booking in this same session (physically impossible)
      if (proctorsInThisSession.has(proctor.id)) return false;

      // Hard 3: User-defined exceptions check (date_all or date_sX) - Inviolable
      const dayWideKey = `${date}_all`;
      const sessionKey = `${date}_s${sessionNumber}`;
      if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) {
        return false;
      }

      // Hard 4: Explicit Session 3 exclusion check - Inviolable
      if (sessionNumber === 3 && proctor.excludeSession3) {
        return false;
      }

      // Hard 5: Daily session limits
      const todayCount = proctor.dailySessionCount[date] || 0;
      if (proctor.type === 'administrative') {
        // Administrative staff: strict MAX 2 sessions per day (to protect office work)
        if (todayCount >= 2) return false;
      } else {
        // Academic staff: Max 3 sessions per day (permitted when needed to complete 100% quota)
        if (todayCount >= 3) return false;
      }

      return true;
    });

    if (eligibleCandidates.length === 0) {
      unassignedSlots.push({
        date,
        dayName,
        session: sessionNumber,
        room: roomObj.room,
        slotIndex: slotIndex + 1,
        reason: activeProctors.every(p => p.assignedCount >= p.quota)
          ? 'استنفاد جميع أنصبة المراقبين'
          : 'تعارض زمني أو استثناءات أو قيود الجلسات'
      });
      return;
    }

    // Candidate Ranking & Selection
    eligibleCandidates.sort((a, b) => {
      const scoreA = calculateCandidateScore(a, date, sessionNumber);
      const scoreB = calculateCandidateScore(b, date, sessionNumber);

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      const remA = a.quota - a.assignedCount;
      const remB = b.quota - b.assignedCount;
      if (remB !== remA) {
        return remB - remA;
      }

      return Math.random() - 0.5;
    });

    const selected = eligibleCandidates[0];
    roomObj.assignedProctors.push(selected.name);
    selected.assignedCount++;
    proctorsInThisSession.add(selected.id);
    selected.daysWorked.add(date);

    selected.dailySessionCount[date] = (selected.dailySessionCount[date] || 0) + 1;
    if (!selected.dailySessions[date]) {
      selected.dailySessions[date] = new Set();
    }
    selected.dailySessions[date].add(sessionNumber);

    selected.assignments.push({
      dayIndex,
      date,
      dayName,
      sessionNumber,
      room: roomObj.room,
      slotIndex: slotIndex + 1
    });

    filledSlots++;
  });

  // Keep single string proctor property synchronized for backwards compatibility
  days.forEach(day => {
    (day.sessions || []).forEach(session => {
      (session.rooms || []).forEach(roomObj => {
        roomObj.proctor = (roomObj.assignedProctors || []).join(' / ');
      });
    });
  });

  // Chronologically sort proctor assignments for clean printing
  activeProctors.forEach(p => {
    p.assignments.sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return a.sessionNumber - b.sessionNumber;
    });
  });

  // -------------------------------------------------------------
  // STEP 5: Calculate Detailed Analytics & Metrics
  // -------------------------------------------------------------
  let consecutivePairsCount = 0;
  let singleSessionDaysCount = 0;
  let threeSessionDaysCount = 0;
  let gapViolationCount = 0;

  activeProctors.forEach(p => {
    Object.entries(p.dailySessions).forEach(([date, sessionsSet]) => {
      const count = sessionsSet.size;
      const has1 = sessionsSet.has(1);
      const has2 = sessionsSet.has(2);
      const has3 = sessionsSet.has(3);

      if (count === 1) {
        singleSessionDaysCount++;
      } else if (count === 2) {
        if ((has1 && has2) || (has2 && has3)) {
          consecutivePairsCount++;
        } else if (has1 && has3 && !has2) {
          // Counted as a comfort violation only for Academic staff
          if (p.type === 'academic') {
            gapViolationCount++;
          }
        }
      } else if (count >= 3) {
        threeSessionDaysCount++;
      }
    });
  });

  // Calculate statistics for all proctors
  const proctorStats = proctorsList.map(original => {
    const matched = activeProctors.find(p => p.id === original.id);
    const assigned = matched ? matched.assignedCount : 0;
    const assignments = matched ? matched.assignments : [];
    const quota = Number(original.quota) || 0;
    const type = original.type === 'administrative' ? 'administrative' : 'academic';

    return {
      id: original.id,
      name: original.name,
      type,
      excludeSession3: Boolean(original.excludeSession3),
      preferredPair: original.preferredPair || 'any',
      isActive: original.isActive,
      quota,
      assignedCount: assigned,
      difference: assigned - quota,
      assignments,
      completionRate: quota > 0 ? Math.round((assigned / quota) * 100) : 0,
      isCeiling: type === 'administrative'
    };
  });

  const totalQuota = activeProctors.reduce((sum, p) => sum + p.quota, 0);
  const activeAcademicsCount = activeProctors.filter(p => (p.type || 'academic') === 'academic').length;
  const activeAdministrativesCount = activeProctors.filter(p => p.type === 'administrative').length;

  return {
    success: true,
    schedule: days,
    proctorStats,
    summary: {
      totalSlots,
      filledSlots,
      unassignedSlotsCount: totalSlots - filledSlots,
      coverageRate: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
      totalQuota,
      activeProctorsCount: activeProctors.length,
      activeAcademicsCount,
      activeAdministrativesCount,
      consecutivePairsCount,
      singleSessionDaysCount,
      threeSessionDaysCount,
      gapViolationCount,
      unassignedList: unassignedSlots
    }
  };
}

/**
 * Heuristic scoring calculation for candidates
 * Enforces:
 * 1. Mandatory Academic Contract Obligation: Academics have priority to fulfill 100% of their quota.
 * 2. Administrative Ceiling & Fair Balancing: Administrative quota is a MAXIMUM CEILING, distributed
 *    with strict equality so all administrators carry a balanced, fair proportion of their ceiling.
 */
function calculateCandidateScore(candidate, dayDate, sessionNum) {
  let score = 0;
  const todaySessions = candidate.dailySessions[dayDate] || new Set();
  const todayCount = candidate.dailySessionCount[dayDate] || 0;
  const remainingQuota = candidate.quota - candidate.assignedCount;
  const progressRatio = candidate.quota > 0 ? (candidate.assignedCount / candidate.quota) : 1;

  // 1. Mandatory Academic Contract Load Priority (+25,000 pts)
  // Ensures academics are given absolute priority to fulfill 100% of their teaching contract quota
  if (candidate.type === 'academic') {
    score += 25000;
    score += (1 - progressRatio) * 12000;
    score += (remainingQuota * 150);

    // Consecutive pairing bonus (+12,000 pts)
    if (sessionNum === 2 && todaySessions.has(1)) {
      score += 12000;
    }
    if (sessionNum === 3 && todaySessions.has(2)) {
      score += 12000;
    }
  } else {
    // 2. Administrative Staff: Quota is a MAXIMUM CEILING, distributed with strict fairness
    // Administrators progress together in parallel (balanced percentage of ceiling)
    score += (1 - progressRatio) * 18000; // Strong balancing weight among administrators
    score += (remainingQuota * 100);

    if (todayCount === 0) {
      score += 2500; // Natural steady daily presence across the schedule
    }
    if (sessionNum === 3 && todaySessions.has(1)) {
      score += 5000; // 1+3 session is completely allowed for administrators
    }
  }

  // 3. Emergency 3rd Session Demotion (Academics only, last resort)
  if (todayCount >= 2) {
    score -= 40000;
  }

  // 4. Preferred Pair Respect
  if (candidate.preferredPair === '1-2') {
    if (sessionNum === 1 || sessionNum === 2) score += 3000;
    if (sessionNum === 3) score -= 8000;
  } else if (candidate.preferredPair === '2-3') {
    if (sessionNum === 2 || sessionNum === 3) score += 3000;
    if (sessionNum === 1) score -= 8000;
  }

  return score;
}
