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

  let totalSlots = 0;
  let filledSlots = 0;
  const unassignedSlots = [];

  // Iterate over each day
  days.forEach((day, dayIndex) => {
    const dayDate = day.date;
    const dayName = day.dayName;

    // Iterate over each session of the day (Session 1, 2, 3...)
    (day.sessions || []).forEach(session => {
      const sessionNum = Number(session.sessionNumber) || 1;
      
      // Track proctors assigned in this specific session to avoid double-booking
      const proctorsInThisSession = new Set();

      (session.rooms || []).forEach(roomObj => {
        // Multi-proctor support: check capacity (default to 1)
        const capacity = Math.max(1, Number(roomObj.capacity) || 1);
        roomObj.capacity = capacity;
        roomObj.assignedProctors = [];

        for (let slot = 0; slot < capacity; slot++) {
          totalSlots++;

          // -------------------------------------------------------------
          // STEP 1: Filter Candidates Based on Hard Constraints
          // -------------------------------------------------------------
          const eligibleCandidates = activeProctors.filter(proctor => {
            // Hard 1: Quota check
            if (proctor.assignedCount >= proctor.quota) return false;

            // Hard 2: No double-booking in this same session
            if (proctorsInThisSession.has(proctor.id)) return false;

            // Hard 3: User-defined exceptions check (date_all or date_sX)
            const dayWideKey = `${dayDate}_all`;
            const sessionKey = `${dayDate}_s${sessionNum}`;
            if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) {
              return false;
            }

            // Hard 4: Global Session 3 exclusion check
            if (sessionNum === 3 && proctor.excludeSession3) {
              return false;
            }

            // Hard 5: Strict No 1+3 Gap Rule
            // If proctor is assigned Session 1 today, and does NOT have Session 2 today,
            // they CANNOT be assigned to Session 3 (to prevent stranded long waiting hours).
            if (sessionNum === 3) {
              const todaySessions = proctor.dailySessions[dayDate];
              if (todaySessions && todaySessions.has(1) && !todaySessions.has(2)) {
                return false;
              }
            }

            // Hard 6: Administrative staff hard daily ceiling (Max 2 sessions per day)
            const todayCount = proctor.dailySessionCount[dayDate] || 0;
            if (proctor.type === 'administrative' && todayCount >= 2) {
              return false;
            }

            // Hard 7: Absolute maximum sessions per day ceiling (never more than 3)
            if (todayCount >= 3) {
              return false;
            }

            return true;
          });

          if (eligibleCandidates.length === 0) {
            unassignedSlots.push({
              date: dayDate,
              dayName: dayName,
              session: sessionNum,
              room: roomObj.room,
              slotIndex: slot + 1,
              reason: activeProctors.every(p => p.assignedCount >= p.quota)
                ? 'استنفاد جميع أنصبة المراقبين'
                : 'تعارض زمني أو استثناءات أو قيود عدم الفراغ بين الجلسات'
            });
            continue;
          }

          // -------------------------------------------------------------
          // STEP 2: Partition Normal Candidates vs Emergency 3rd Session Candidates
          // -------------------------------------------------------------
          // Proctors with < 2 sessions today are normal candidates.
          // Academics with == 2 sessions today are ONLY emergency candidates
          // (used only when no normal candidate is available for this slot).
          const normalCandidates = eligibleCandidates.filter(p => (p.dailySessionCount[dayDate] || 0) < 2);
          const candidatesToRank = normalCandidates.length > 0 ? normalCandidates : eligibleCandidates;

          // -------------------------------------------------------------
          // STEP 3: Fairness & Human-Comfort Scoring
          // -------------------------------------------------------------
          candidatesToRank.sort((a, b) => {
            const scoreA = calculateCandidateScore(a, dayDate, sessionNum);
            const scoreB = calculateCandidateScore(b, dayDate, sessionNum);

            // Highest score first
            if (scoreB !== scoreA) {
              return scoreB - scoreA;
            }

            // Tie-breaker 1: Total remaining quota needed
            const remainingA = a.quota - a.assignedCount;
            const remainingB = b.quota - b.assignedCount;
            if (remainingB !== remainingA) {
              return remainingB - remainingA;
            }

            // Tie-breaker 2: Slight random jitter
            return Math.random() - 0.5;
          });

          const selected = candidatesToRank[0];

          // -------------------------------------------------------------
          // STEP 4: Assign Proctor & Update State
          // -------------------------------------------------------------
          roomObj.assignedProctors.push(selected.name);
          selected.assignedCount++;
          proctorsInThisSession.add(selected.id);
          selected.daysWorked.add(dayDate);

          selected.dailySessionCount[dayDate] = (selected.dailySessionCount[dayDate] || 0) + 1;
          if (!selected.dailySessions[dayDate]) {
            selected.dailySessions[dayDate] = new Set();
          }
          selected.dailySessions[dayDate].add(sessionNum);

          selected.assignments.push({
            dayIndex,
            date: dayDate,
            dayName: dayName,
            sessionNumber: sessionNum,
            room: roomObj.room,
            slotIndex: slot + 1
          });

          filledSlots++;
        }

        // Keep single string proctor property synchronized for backwards compatibility
        roomObj.proctor = roomObj.assignedProctors.join(' / ');
      });
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
          // This must never happen based on our hard constraint!
          gapViolationCount++;
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

    return {
      id: original.id,
      name: original.name,
      type: original.type === 'administrative' ? 'administrative' : 'academic',
      excludeSession3: Boolean(original.excludeSession3),
      preferredPair: original.preferredPair || 'any',
      isActive: original.isActive,
      quota,
      assignedCount: assigned,
      difference: assigned - quota,
      assignments,
      completionRate: quota > 0 ? Math.round((assigned / quota) * 100) : 0
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
 */
function calculateCandidateScore(candidate, dayDate, sessionNum) {
  let score = 0;
  const todaySessions = candidate.dailySessions[dayDate] || new Set();
  const todayCount = candidate.dailySessionCount[dayDate] || 0;
  const remainingQuota = candidate.quota - candidate.assignedCount;
  const progressRatio = candidate.assignedCount / candidate.quota;

  // 1. Academic Priority (+20,000 pts)
  // Ensures academics are given priority to fulfill their contract load before administrators
  if (candidate.type === 'academic') {
    score += 20000;
  }

  // 2. Consecutive Session Pairing Bonus (+15,000 pts)
  // If in Session 2, and candidate has Session 1 today -> massive bonus to create (1 + 2)
  if (sessionNum === 2 && todaySessions.has(1)) {
    score += 15000;
  }
  // If in Session 3, and candidate has Session 2 today (and no Session 1) -> massive bonus to create (2 + 3)
  if (sessionNum === 3 && todaySessions.has(2)) {
    score += 15000;
  }

  // 3. Avoid Single-Session Day Penalty / Bonus
  // If candidate already has 1 session today, and this session is adjacent, heavily favor pairing them up!
  // If candidate already has 2 sessions today (Academic taking emergency 3rd session), apply heavy penalty
  if (todayCount >= 2) {
    score -= 30000; // Demote 3-session days to last resort
  }

  // 4. Preferred Pair Respect
  if (candidate.preferredPair === '1-2') {
    if (sessionNum === 1 || sessionNum === 2) score += 3000;
    if (sessionNum === 3) score -= 8000;
  } else if (candidate.preferredPair === '2-3') {
    if (sessionNum === 2 || sessionNum === 3) score += 3000;
    if (sessionNum === 1) score -= 8000;
  }

  // 5. Fair Quota Fulfillment Ratio (-5000 * ratio)
  // Proctors who are behind on their quota percentage are prioritized
  score -= (progressRatio * 5000);

  // 6. Remaining Quota Weight (+100 * remaining)
  score += (remainingQuota * 100);

  return score;
}
