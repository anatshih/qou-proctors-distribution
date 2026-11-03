/**
 * Smart Proctor Distribution Engine
 * Developed for Al-Quds Open University
 */

export function runProctorDistribution(scheduleDays, proctorsList) {
  // Deep clone schedule to avoid direct mutation
  const days = JSON.parse(JSON.stringify(scheduleDays));
  
  // Filter only active proctors with quota > 0
  const activeProctors = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0)
    .map(p => ({
      id: p.id,
      name: p.name,
      quota: Number(p.quota),
      assignedCount: 0,
      exceptions: new Set(p.exceptions || []),
      assignments: [], // { dayIndex, date, dayName, sessionNumber, room }
      daysWorked: new Set(),
      dailySessionCount: {} // date -> count
    }));

  let totalSlots = 0;
  let filledSlots = 0;
  const unassignedSlots = [];

  // Iterate over each day
  days.forEach((day, dayIndex) => {
    const dayDate = day.date;
    const dayName = day.dayName;

    // Iterate over each session of the day
    (day.sessions || []).forEach(session => {
      const sessionNum = session.sessionNumber;
      
      // Keep track of proctors already assigned in this specific session
      const proctorsInThisSession = new Set();

      (session.rooms || []).forEach(roomObj => {
        totalSlots++;

        // Candidate pool for this room
        const candidates = activeProctors.filter(proctor => {
          // 1. Quota check
          if (proctor.assignedCount >= proctor.quota) return false;

          // 2. Conflict check: Not already in this session
          if (proctorsInThisSession.has(proctor.id)) return false;

          // 3. Exception check
          // Check for day-wide exception or specific session exception
          const dayWideKey = `${dayDate}_all`;
          const sessionKey = `${dayDate}_s${sessionNum}`;
          if (proctor.exceptions.has(dayWideKey) || proctor.exceptions.has(sessionKey)) {
            return false;
          }

          return true;
        });

        if (candidates.length === 0) {
          // Cannot fill this room slot
          roomObj.proctor = "";
          unassignedSlots.push({
            date: dayDate,
            dayName: dayName,
            session: sessionNum,
            room: roomObj.room,
            reason: activeProctors.every(p => p.assignedCount >= p.quota)
              ? 'استنفاد جميع أنصبة المراقبين'
              : 'تعارض في الجلسة أو استثناءات للمراقبين المتاحين'
          });
          return;
        }

        // Rank candidates based on fairness score:
        // Lower score = better candidate
        candidates.sort((a, b) => {
          // Criterion 1: Percentage of quota filled (encourage balanced progression)
          const ratioA = a.assignedCount / a.quota;
          const ratioB = b.assignedCount / b.quota;
          if (Math.abs(ratioA - ratioB) > 0.08) {
            return ratioA - ratioB;
          }

          // Criterion 2: Workload today (prefer proctor who hasn't worked today or worked fewer sessions today)
          const todayCountA = a.dailySessionCount[dayDate] || 0;
          const todayCountB = b.dailySessionCount[dayDate] || 0;
          if (todayCountA !== todayCountB) {
            return todayCountA - todayCountB;
          }

          // Criterion 3: Total remaining quota needed
          const remainingA = a.quota - a.assignedCount;
          const remainingB = b.quota - b.assignedCount;
          if (remainingA !== remainingB) {
            return remainingB - remainingA; // Higher remaining gets priority
          }

          // Criterion 4: Slight pseudo-random tie breaker
          return Math.random() - 0.5;
        });

        const selected = candidates[0];

        // Assign
        roomObj.proctor = selected.name;
        selected.assignedCount++;
        proctorsInThisSession.add(selected.id);
        selected.daysWorked.add(dayDate);
        selected.dailySessionCount[dayDate] = (selected.dailySessionCount[dayDate] || 0) + 1;
        selected.assignments.push({
          dayIndex,
          date: dayDate,
          dayName: dayName,
          sessionNumber: sessionNum,
          room: roomObj.room
        });

        filledSlots++;
      });
    });
  });

  // Calculate statistics for all proctors (including inactive and zero-quota ones)
  const proctorStats = proctorsList.map(original => {
    const matched = activeProctors.find(p => p.id === original.id);
    const assigned = matched ? matched.assignedCount : 0;
    const assignments = matched ? matched.assignments : [];
    const quota = Number(original.quota) || 0;

    return {
      id: original.id,
      name: original.name,
      isActive: original.isActive,
      quota,
      assignedCount: assigned,
      difference: assigned - quota,
      assignments,
      completionRate: quota > 0 ? Math.round((assigned / quota) * 100) : 0
    };
  });

  const totalQuota = activeProctors.reduce((sum, p) => sum + p.quota, 0);

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
      unassignedList: unassignedSlots
    }
  };
}
