/**
 * auditEngine.js
 * Central, mathematical, zero-mock validation & audit engine for Al-Quds Open University proctor schedules.
 * 
 * Computes exact live metrics from scheduleDays and proctors data.
 * Zero hardcoded claims: Every percentage, count, and compliance badge is strictly derived from raw data.
 */

/**
 * Run a full audit on the active schedule and proctors list.
 * @param {Array} scheduleDays 
 * @param {Array} proctors 
 * @returns {Object} Full audit report with detailed metrics and proctor-level breakdown.
 */
export function runScheduleAudit(scheduleDays = [], proctors = []) {
  // 1. Build rapid lookup maps
  const proctorMap = new Map();
  (proctors || []).forEach(p => {
    if (p && p.name) {
      proctorMap.set(p.name.trim(), p);
    }
  });

  // Track assignments per proctor: { [proctorName]: [ { dayIndex, dayName, date, sessionNumber, roomName } ] }
  const assignmentsByProctor = new Map();
  // Track assigned proctor names per session: key = `${date}_s${sessionNumber}` -> Set(names)
  const sessionProctorsMap = new Map();
  // Same-session conflicts list
  const sameSessionConflicts = [];

  let totalCapacityRequired = 0;
  let totalAssignedSlots = 0;
  let totalUnassignedSlots = 0;
  let totalRoomsCount = 0;

  // Process schedule
  (scheduleDays || []).forEach((day, dayIdx) => {
    const dayDate = day.date || `يوم_${dayIdx + 1}`;
    const dayName = day.dayName || '';

    (day.sessions || []).forEach(sess => {
      const sessNum = Number(sess.sessionNumber) || 1;
      const sessKey = `${dayDate}_s${sessNum}`;
      if (!sessionProctorsMap.has(sessKey)) {
        sessionProctorsMap.set(sessKey, new Set());
      }
      const namesInThisSession = sessionProctorsMap.get(sessKey);

      (sess.rooms || []).forEach(room => {
        totalRoomsCount++;
        const capacity = Math.max(1, Number(room.capacity) || 1);
        totalCapacityRequired += capacity;

        const assignedList = Array.isArray(room.assignedProctors) 
          ? room.assignedProctors 
          : (room.assignedProctor ? [room.assignedProctor] : []);

        for (let i = 0; i < capacity; i++) {
          const proctorName = (assignedList[i] || '').trim();
          if (proctorName) {
            totalAssignedSlots++;

            // Record assignment
            if (!assignmentsByProctor.has(proctorName)) {
              assignmentsByProctor.set(proctorName, []);
            }
            assignmentsByProctor.get(proctorName).push({
              dayIndex: dayIdx,
              dayName,
              date: dayDate,
              sessionNumber: sessNum,
              roomName: room.roomName || room.name || 'قاعة'
            });

            // Check same-session conflict
            if (namesInThisSession.has(proctorName)) {
              sameSessionConflicts.push({
                proctorName,
                date: dayDate,
                dayName,
                sessionNumber: sessNum,
                roomName: room.roomName || room.name
              });
            } else {
              namesInThisSession.add(proctorName);
            }
          } else {
            totalUnassignedSlots++;
          }
        }
      });
    });
  });

  // 2. Proctor-by-proctor deep audit
  const proctorReports = [];
  let academicCount = 0;
  let academicFullComplianceCount = 0;
  let academicTotalQuota = 0;
  let academicTotalAssigned = 0;
  let academicSingleSessionDaysCount = 0;
  let academicGapViolationsCount = 0;

  let adminCount = 0;
  let adminTotalCap = 0;
  let adminTotalAssigned = 0;
  let adminWithinCapCount = 0;
  let adminDailyOverloadCount = 0;

  let exceptionViolationsTotal = 0;
  let session3ViolationsTotal = 0;

  (proctors || []).forEach(proctor => {
    const pName = (proctor.name || '').trim();
    const isAcademic = proctor.type !== 'administrative';
    const quota = Math.max(0, Number(proctor.quota) || 0);
    const assignedList = assignmentsByProctor.get(pName) || [];
    const assignedCount = assignedList.length;

    if (isAcademic) {
      academicCount++;
      academicTotalQuota += quota;
      academicTotalAssigned += assignedCount;
      if (assignedCount === quota) {
        academicFullComplianceCount++;
      }
    } else {
      adminCount++;
      adminTotalCap += quota;
      adminTotalAssigned += assignedCount;
      if (assignedCount <= quota) {
        adminWithinCapCount++;
      }
    }

    // Group assignments by day to check daily limits, gaps, and isolated sessions
    const daysMap = new Map(); // date -> array of sessionNumbers
    assignedList.forEach(a => {
      if (!daysMap.has(a.date)) {
        daysMap.set(a.date, []);
      }
      daysMap.get(a.date).push(a.sessionNumber);
    });

    const daysWorkedDates = Array.from(daysMap.keys());
    const daysWorkedCount = daysWorkedDates.length;
    const singleSessionDays = [];
    const twoSessionDays = [];
    const threeSessionDays = [];
    const gapViolations = [];
    const adminDailyOverloads = [];

    daysMap.forEach((sessions, date) => {
      const uniqueSessions = Array.from(new Set(sessions)).sort((a, b) => a - b);
      const count = uniqueSessions.length;

      if (count === 1) singleSessionDays.push(date);
      else if (count === 2) twoSessionDays.push(date);
      else if (count >= 3) threeSessionDays.push(date);

      // Check academic gap: Sessions 1 and 3 present without 2
      if (isAcademic && uniqueSessions.includes(1) && uniqueSessions.includes(3) && !uniqueSessions.includes(2)) {
        gapViolations.push(date);
        academicGapViolationsCount++;
      }

      // Check admin overload (> 2 sessions in a day)
      if (!isAcademic && count > 2) {
        adminDailyOverloads.push({ date, count });
        adminDailyOverloadCount++;
      }
    });

    if (isAcademic) {
      academicSingleSessionDaysCount += singleSessionDays.length;
    }

    // Check excludeSession3 violation
    const session3Violations = [];
    if (proctor.excludeSession3) {
      assignedList.forEach(a => {
        if (a.sessionNumber === 3) {
          session3Violations.push(a);
          session3ViolationsTotal++;
        }
      });
    }

    // Check exceptions/apologies violations
    const exceptionViolations = [];
    const rawExceptions = proctor.exceptions || [];
    const exceptionSet = new Set();
    rawExceptions.forEach(ex => {
      if (typeof ex === 'string') {
        exceptionSet.add(ex);
      } else if (ex && ex.date) {
        if (ex.sessionNumber) {
          exceptionSet.add(`${ex.date}_s${ex.sessionNumber}`);
        } else {
          exceptionSet.add(`${ex.date}_all`);
          exceptionSet.add(`${ex.date}_s1`);
          exceptionSet.add(`${ex.date}_s2`);
          exceptionSet.add(`${ex.date}_s3`);
        }
      }
    });

    if (exceptionSet.size > 0) {
      assignedList.forEach(a => {
        const dayWideKey = `${a.date}_all`;
        const sessionKey = `${a.date}_s${a.sessionNumber}`;
        if (exceptionSet.has(dayWideKey) || exceptionSet.has(sessionKey)) {
          exceptionViolations.push(a);
          exceptionViolationsTotal++;
        }
      });
    }

    const difference = assignedCount - quota;
    const isSatisfied = isAcademic ? (assignedCount === quota) : (assignedCount <= quota);

    proctorReports.push({
      id: proctor.id,
      name: pName,
      type: proctor.type || (isAcademic ? 'academic' : 'administrative'),
      isAcademic,
      quota,
      assignedCount,
      difference,
      isSatisfied,
      daysWorkedCount,
      daysWorkedDates,
      singleSessionDays,
      twoSessionDays,
      threeSessionDays,
      gapViolations,
      adminDailyOverloads,
      session3Violations,
      exceptionViolations,
      assignments: assignedList
    });
  });

  // Calculate percentages
  const fulfillmentRate = totalCapacityRequired > 0 
    ? Math.round((totalAssignedSlots / totalCapacityRequired) * 100) 
    : 0;

  const academicComplianceRate = academicCount > 0 
    ? Math.round((academicFullComplianceCount / academicCount) * 100) 
    : 100;

  const adminComplianceRate = adminCount > 0 
    ? Math.round((adminWithinCapCount / adminCount) * 100) 
    : 100;

  const exceptionRespectRate = (exceptionViolationsTotal === 0) ? 100 : Math.max(0, 100 - (exceptionViolationsTotal * 5));

  const isFullyCompliant = 
    totalUnassignedSlots === 0 &&
    sameSessionConflicts.length === 0 &&
    academicFullComplianceCount === academicCount &&
    academicGapViolationsCount === 0 &&
    exceptionViolationsTotal === 0 &&
    session3ViolationsTotal === 0 &&
    adminDailyOverloadCount === 0;

  return {
    // Totals
    totalCapacityRequired,
    totalAssignedSlots,
    totalUnassignedSlots,
    totalRoomsCount,
    fulfillmentRate,
    isScheduleComplete: totalUnassignedSlots === 0 && totalAssignedSlots === totalCapacityRequired,

    // Academic Stats
    academicCount,
    academicTotalQuota,
    academicTotalAssigned,
    academicFullComplianceCount,
    academicComplianceRate,
    academicSingleSessionDaysCount,
    academicGapViolationsCount,

    // Admin Stats
    adminCount,
    adminTotalCap,
    adminTotalAssigned,
    adminWithinCapCount,
    adminComplianceRate,
    adminDailyOverloadCount,

    // Violations & Conflicts
    sameSessionConflicts,
    exceptionViolationsTotal,
    session3ViolationsTotal,

    // Master Verdict
    isFullyCompliant,
    proctorReports
  };
}
