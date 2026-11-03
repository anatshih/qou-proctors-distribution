/**
 * Smart Proctor Distribution Engine
 * Multi-Proctor, Fair Scheduling & Human-Comfort Heuristics
 * Al-Quds Open University - Hebron Branch
 * 
 * Rules Enforced & Established:
 * 1. Multi-Proctor per Room (1, 2, or 3 proctors per room capacity).
 * 2. Academic Contract Load Priority: Academic staff are prioritized to achieve 100% of their teaching contract quota (Difference = 0).
 * 3. Low-Quota Compact Rule: Academics with quotas of 2 or 3 sessions are packed into a SINGLE attendance day:
 *    - Quota 2: Packed into 1 day with consecutive sessions (1+2 or 2+3).
 *    - Quota 3: Packed into 1 day with 3 consecutive sessions (1+2+3).
 * 4. Pair-First Academic Clustering: Academic staff are assigned in consecutive blocks (1+2 or 2+3) on bottleneck days to minimize days of university attendance.
 * 5. Odd-Quota Triple Session Upgrade: Academics with odd quotas (e.g. 13, 15, 11) are permitted 3 consecutive sessions (1+2+3) on ONE of their days (unless excludeSession3 is set), eliminating isolated single-session days.
 * 6. Administrative Staff as "Absorbers": Administrative staff (already present in university offices) absorb isolated single sessions and asymmetric session surpluses, protecting academics from single-session trips.
 * 7. Daily Session Limits & No-Gap Constraint:
 *    - Administrative Staff: Strictly MAX 2 sessions per day (never 3).
 *    - Academic Staff: Strictly forbids gap sessions (Session 1 + Session 3 on same day without Session 2).
 * 8. Inviolable Constraints: Strictly honors user-defined exceptions, physical non-collision (no proctor twice in same session), and excludeSession3.
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

  // Inviolable constraint validation helper
  const canAssign = (proctor, date, sessionNum, allowThirdSession = false) => {
    if (proctor.assignedCount >= proctor.quota) return false;
    if (getProctorSet(date, sessionNum).has(proctor.id)) return false;

    const dayWideKey = `${date}_all`;
    const sessionKey = `${date}_s${sessionNum}`;
    if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) return false;
    if (sessionNum === 3 && proctor.excludeSession3) return false;

    const count = proctor.dailySessionCount[date] || 0;
    if (proctor.type === 'administrative') {
      // Administrative staff: strictly MAX 2 sessions per day
      if (count >= 2) return false;
    } else {
      // Academic staff: normally 2 sessions; 3rd session permitted only for triple completion rule
      if (!allowThirdSession && count >= 2) return false;
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
  // RULE 1: LOW-QUOTA COMPACT RULE (Quota = 2 or 3)
  // Pack professors with low proctoring duties into EXACTLY 1 single day!
  // E.g. Dr. Saleh Shalalfah (3) -> 1 day (1+2+3); Dr. Khaled Al-Najjar (2) -> 1 day (1+2).
  // -------------------------------------------------------------
  const lowQuotaAcademics = activeProctors.filter(p => p.type === 'academic' && (p.quota === 2 || p.quota === 3));

  lowQuotaAcademics.forEach(p => {
    for (let dIdx = 0; dIdx < days.length; dIdx++) {
      const day = days[dIdx];
      const date = day.date;
      const sess1 = (day.sessions || []).find(s => s.sessionNumber === 1);
      const sess2 = (day.sessions || []).find(s => s.sessionNumber === 2);
      const sess3 = (day.sessions || []).find(s => s.sessionNumber === 3);

      if (p.quota === 3 && !p.excludeSession3) {
        if (canAssign(p, date, 1, true) && canAssign(p, date, 2, true) && canAssign(p, date, 3, true)) {
          const r1 = (sess1?.rooms || []).find(r => (r.assignedProctors || []).length < r.capacity);
          const r2 = (sess2?.rooms || []).find(r => (r.assignedProctors || []).length < r.capacity);
          const r3 = (sess3?.rooms || []).find(r => (r.assignedProctors || []).length < r.capacity);
          if (r1 && r2 && r3) {
            doAssign(p, dIdx, date, day.dayName, 1, r1);
            doAssign(p, dIdx, date, day.dayName, 2, r2);
            doAssign(p, dIdx, date, day.dayName, 3, r3);
            break;
          }
        }
      } else if (p.quota === 2) {
        const try2_3 = p.preferredPair === '2-3';
        const pair = try2_3 ? [2, 3] : [1, 2];
        const sA = pair[0] === 1 ? sess1 : (pair[0] === 2 ? sess2 : sess3);
        const sB = pair[1] === 1 ? sess1 : (pair[1] === 2 ? sess2 : sess3);

        if (canAssign(p, date, pair[0]) && canAssign(p, date, pair[1])) {
          const rA = (sA?.rooms || []).find(r => (r.assignedProctors || []).length < r.capacity);
          const rB = (sB?.rooms || []).find(r => (r.assignedProctors || []).length < r.capacity);
          if (rA && rB) {
            doAssign(p, dIdx, date, day.dayName, pair[0], rA);
            doAssign(p, dIdx, date, day.dayName, pair[1], rB);
            break;
          }
        }
      }
    }
  });

  // -------------------------------------------------------------
  // RULE 2: PAIR-FIRST ACADEMIC CLUSTERING (Consecutive Double Sessions)
  // Schedules remaining academic quotas in consecutive blocks (1+2 or 2+3).
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

    // Pairing order: align with the session carrying higher room density
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
  // RULE 3: ODD-QUOTA TRIPLE SESSION UPGRADE
  // Academics with odd quotas (e.g. Dr. Issa Al-Masri with 13, Dr. Maryam with 15)
  // are allowed 3 consecutive sessions (1+2+3) on ONE of their days, eliminating
  // an isolated single-session day and reducing attendance days by 1!
  // -------------------------------------------------------------
  const academicsNeedingSingle = activeProctors.filter(
    p => p.type === 'academic' && (p.quota - p.assignedCount) === 1 && !p.excludeSession3
  );

  academicsNeedingSingle.forEach(p => {
    for (const date of Array.from(p.daysWorked)) {
      const sessionsToday = p.dailySessions[date] || new Set();
      if (sessionsToday.size !== 2) continue;

      let missingSessionNum = null;
      if (sessionsToday.has(1) && sessionsToday.has(2)) missingSessionNum = 3;
      if (sessionsToday.has(2) && sessionsToday.has(3)) missingSessionNum = 1;

      if (!missingSessionNum) continue;
      if (!canAssign(p, date, missingSessionNum, true)) continue;

      const dIdx = days.findIndex(d => d.date === date);
      if (dIdx === -1) continue;
      const day = days[dIdx];
      const sessObj = (day.sessions || []).find(s => s.sessionNumber === missingSessionNum);
      if (!sessObj) continue;

      const freeRoom = (sessObj.rooms || []).find(r => (r.assignedProctors || []).length < (r.capacity || 1));
      if (freeRoom) {
        doAssign(p, dIdx, date, day.dayName, missingSessionNum, freeRoom);
        break; // successfully upgraded odd quota to triple!
      }
    }
  });

  // -------------------------------------------------------------
  // RULE 4: ABSORBERS & FINAL SLOTS COMPLETION
  // Priority 1: Academics with unfulfilled odd quotas (100% contract obligation).
  // Priority 2: Administrators (absorb isolated single sessions with balanced ceiling).
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

    const candidates = activeProctors.filter(p => canAssign(p, date, sessionNumber, true));
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

      // Academics still needing quota get absolute priority
      if (a.type === 'academic') {
        scoreA += 60000 + (remA * 500);
        const tA = a.dailySessions[date] || new Set();
        if ((sessionNumber === 2 && (tA.has(1) || tA.has(3))) ||
            (sessionNumber === 1 && tA.has(2)) ||
            (sessionNumber === 3 && tA.has(2))) {
          scoreA += 40000;
        }
      } else {
        // Administrative staff: Absorbers of single / filler sessions
        scoreA += 25000;
        const progress = a.quota > 0 ? (a.assignedCount / a.quota) : 1;
        scoreA += (1 - progress) * 20000;
        scoreA += remA * 100;
      }

      if (b.type === 'academic') {
        scoreB += 60000 + (remB * 500);
        const tB = b.dailySessions[date] || new Set();
        if ((sessionNumber === 2 && (tB.has(1) || tB.has(3))) ||
            (sessionNumber === 1 && tB.has(2)) ||
            (sessionNumber === 3 && tB.has(2))) {
          scoreB += 40000;
        }
      } else {
        scoreB += 25000;
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
