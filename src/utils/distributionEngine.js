/**
 * Smart Proctor Distribution Engine
 * Multi-Proctor, Fair Scheduling & Human-Comfort Heuristics
 * Al-Quds Open University - Hebron Branch
 * 
 * Rules Enforced:
 * 1. Multi-Proctor per Room (1, 2, or 3 proctors per room capacity).
 * 2. Academic Contract Load Priority: Academic staff are prioritized over Administrative staff to meet academic quotas (100% mandatory target).
 * 3. Pair-First Academic Clustering: Academics are assigned in consecutive pairs (1+2 or 2+3) to cluster their attendance and avoid single-session days.
 * 4. Administrative Staff as "Absorbers": Administrative staff (already on campus) absorb isolated single sessions, protecting academics from single-session trips.
 * 5. Strict No-Gap Rule: Forbids assigning Session 1 and Session 3 on the same day for academics while leaving Session 2 empty.
 * 6. Daily Session Limits:
 *    - Administrative Staff: Strictly MAX 2 sessions per day (never 3).
 *    - Academic Staff: Target MAX 2 sessions; 3rd session permitted only as extreme necessity if no other candidate is available.
 * 7. Proctor-Specific Exclusions & Preferences: Respects user exceptions, excludeSession3, and preferredPair ('1-2' | '2-3').
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

  // Initialize room assignments and normalize capacities
  days.forEach(d => {
    (d.sessions || []).forEach(s => {
      (s.rooms || []).forEach(r => {
        r.assignedProctors = [];
        r.capacity = Math.max(1, Number(r.capacity) || 1);
      });
    });
  });

  // Global Session Proctor Set to strictly forbid any double-booking
  const sessionProctorMap = new Map();
  const getProctorSet = (date, sNum) => {
    const key = `${date}_s${sNum}`;
    if (!sessionProctorMap.has(key)) sessionProctorMap.set(key, new Set());
    return sessionProctorMap.get(key);
  };

  // Constraint validation helper
  const canAssign = (proctor, date, sessionNum) => {
    if (proctor.assignedCount >= proctor.quota) return false;
    if (getProctorSet(date, sessionNum).has(proctor.id)) return false;

    const dayWideKey = `${date}_all`;
    const sessionKey = `${date}_s${sessionNum}`;
    if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) return false;
    if (sessionNum === 3 && proctor.excludeSession3) return false;

    const count = proctor.dailySessionCount[date] || 0;
    if (proctor.type === 'administrative') {
      if (count >= 2) return false;
    } else {
      if (count >= 3) return false;
      const todaySessions = proctor.dailySessions[date] || new Set();
      // Strict NO-GAP: Forbid 1+3 without 2 for academics
      if (sessionNum === 3 && todaySessions.has(1) && !todaySessions.has(2)) return false;
      if (sessionNum === 1 && todaySessions.has(3) && !todaySessions.has(2)) return false;
    }
    return true;
  };

  // Assignment executor helper
  const doAssign = (proctor, dayIndex, date, dayName, sessionNum, roomObj) => {
    roomObj.assignedProctors.push(proctor.name);
    proctor.assignedCount++;
    getProctorSet(date, sessionNum).add(proctor.id);
    proctor.daysWorked.add(date);
    proctor.dailySessionCount[date] = (proctor.dailySessionCount[date] || 0) + 1;
    if (!proctor.dailySessions[date]) proctor.dailySessions[date] = new Set();
    proctor.dailySessions[date].add(sessionNum);

    const slotIndex = roomObj.assignedProctors.length;
    proctor.assignments.push({
      dayIndex,
      date,
      dayName,
      sessionNumber: sessionNum,
      room: roomObj.room,
      slotIndex
    });
  };

  // -------------------------------------------------------------
  // PHASE 1: PAIR ALLOCATION FOR ACADEMICS (Consecutive Double Sessions)
  // Schedules academics in consecutive blocks (1+2 or 2+3) to minimize single days.
  // Prioritizes bottleneck days first (Day 12, Day 3, Day 6, Day 8, etc.)
  // -------------------------------------------------------------
  const dayDemand = days.map((d, dIdx) => {
    let totalRooms = 0;
    (d.sessions || []).forEach(s => totalRooms += (s.rooms || []).length);
    return { dayIndex: dIdx, day: d, totalRooms };
  });
  dayDemand.sort((a, b) => b.totalRooms - a.totalRooms);

  dayDemand.forEach(({ dayIndex, day }) => {
    const date = day.date;
    const dayName = day.dayName;
    const sess1 = (day.sessions || []).find(s => s.sessionNumber === 1);
    const sess2 = (day.sessions || []).find(s => s.sessionNumber === 2);
    const sess3 = (day.sessions || []).find(s => s.sessionNumber === 3);

    const getUnfilledSlots = (sess) => {
      if (!sess) return [];
      const slots = [];
      (sess.rooms || []).forEach(r => {
        const cap = r.capacity || 1;
        const filled = (r.assignedProctors || []).length;
        for (let i = filled; i < cap; i++) {
          slots.push(r);
        }
      });
      return slots;
    };

    const tryFormPairs = (sA_num, sB_num) => {
      const sessA = sA_num === 1 ? sess1 : (sA_num === 2 ? sess2 : sess3);
      const sessB = sB_num === 1 ? sess1 : (sB_num === 2 ? sess2 : sess3);
      if (!sessA || !sessB) return;

      let slotsA = getUnfilledSlots(sessA);
      let slotsB = getUnfilledSlots(sessB);

      while (slotsA.length > 0 && slotsB.length > 0) {
        // Find academic candidates with at least 2 remaining quota eligible for both sessions
        const pairCandidates = activeProctors.filter(p => {
          if (p.type !== 'academic') return false;
          if (p.quota - p.assignedCount < 2) return false;
          return canAssign(p, date, sA_num) && canAssign(p, date, sB_num);
        });

        if (pairCandidates.length === 0) break;

        pairCandidates.sort((a, b) => {
          const pairName = sA_num === 1 ? '1-2' : '2-3';
          const prefA = a.preferredPair === pairName ? 10 : (a.preferredPair === 'any' ? 5 : 2);
          const prefB = b.preferredPair === pairName ? 10 : (b.preferredPair === 'any' ? 5 : 2);

          const remA = a.quota - a.assignedCount;
          const remB = b.quota - b.assignedCount;

          const scoreA = (prefA * 1000) + (remA * 50);
          const scoreB = (prefB * 1000) + (remB * 50);

          if (scoreB !== scoreA) return scoreB - scoreA;
          return Math.random() - 0.5;
        });

        const chosen = pairCandidates[0];
        const roomA = slotsA.shift();
        const roomB = slotsB.shift();

        doAssign(chosen, dayIndex, date, dayName, sA_num, roomA);
        doAssign(chosen, dayIndex, date, dayName, sB_num, roomB);
      }
    };

    // Smart pairing order: align with the session carrying higher room density
    const count1 = (sess1?.rooms || []).length;
    const count3 = (sess3?.rooms || []).length;
    if (count1 >= count3) {
      tryFormPairs(1, 2);
      tryFormPairs(2, 3);
    } else {
      tryFormPairs(2, 3);
      tryFormPairs(1, 2);
    }
  });

  // -------------------------------------------------------------
  // PHASE 2: Complete Remaining Slots
  // Priority 1: Academics with unfulfilled odd quotas (15, 13, 11, etc.)
  // Priority 2: Administrators (absorb isolated single sessions with balanced ceiling)
  // -------------------------------------------------------------
  const remainingSlots = [];
  days.forEach((day, dayIndex) => {
    (day.sessions || []).forEach(sess => {
      (sess.rooms || []).forEach(r => {
        const cap = r.capacity || 1;
        const filled = (r.assignedProctors || []).length;
        for (let i = filled; i < cap; i++) {
          remainingSlots.push({
            dayIndex,
            date: day.date,
            dayName: day.dayName,
            sessionNumber: sess.sessionNumber,
            roomObj: r,
            sessionDensity: (sess.rooms || []).length
          });
        }
      });
    });
  });

  // Sort remaining slots by session density descending
  remainingSlots.sort((a, b) => b.sessionDensity - a.sessionDensity);

  const unassignedSlots = [];

  remainingSlots.forEach(slotItem => {
    const { dayIndex, date, dayName, sessionNumber, roomObj } = slotItem;

    const candidates = activeProctors.filter(p => canAssign(p, date, sessionNumber));
    if (candidates.length === 0) {
      unassignedSlots.push({
        date,
        dayName,
        session: sessionNumber,
        room: roomObj.room,
        slotIndex: roomObj.assignedProctors.length + 1,
        reason: activeProctors.every(p => p.assignedCount >= p.quota)
          ? 'استنفاد جميع أنصبة المراقبين'
          : 'تعارض زمني أو استثناءات أو قيود الجلسات'
      });
      return;
    }

    candidates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const remA = a.quota - a.assignedCount;
      const remB = b.quota - b.assignedCount;

      // Academics still needing quota get absolute priority to achieve 100% contract fulfillment
      if (a.type === 'academic') {
        scoreA += 50000 + (remA * 500);
        const tA = a.dailySessions[date] || new Set();
        if ((sessionNumber === 2 && (tA.has(1) || tA.has(3))) ||
            (sessionNumber === 1 && tA.has(2)) ||
            (sessionNumber === 3 && tA.has(2))) {
          scoreA += 40000; // Complete a pair if already present today
        }
      } else {
        // Administrative staff: Absorbers of single / filler sessions
        scoreA += 20000;
        const progress = a.quota > 0 ? (a.assignedCount / a.quota) : 1;
        scoreA += (1 - progress) * 20000;
        scoreA += remA * 100;
      }

      if (b.type === 'academic') {
        scoreB += 50000 + (remB * 500);
        const tB = b.dailySessions[date] || new Set();
        if ((sessionNumber === 2 && (tB.has(1) || tB.has(3))) ||
            (sessionNumber === 1 && tB.has(2)) ||
            (sessionNumber === 3 && tB.has(2))) {
          scoreB += 40000;
        }
      } else {
        scoreB += 20000;
        const progress = b.quota > 0 ? (b.assignedCount / b.quota) : 1;
        scoreB += (1 - progress) * 20000;
        scoreB += remB * 100;
      }

      if (scoreB !== scoreA) return scoreB - scoreA;
      return Math.random() - 0.5;
    });

    const chosen = candidates[0];
    doAssign(chosen, dayIndex, date, dayName, sessionNumber, roomObj);
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
  let totalSlots = 0;
  let filledSlots = 0;
  days.forEach(d => {
    (d.sessions || []).forEach(s => {
      (s.rooms || []).forEach(r => {
        totalSlots += (r.capacity || 1);
        filledSlots += (r.assignedProctors || []).length;
      });
    });
  });

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
