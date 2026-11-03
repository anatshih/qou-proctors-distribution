const https = require('https');

async function checkDalia() {
  const { runProctorDistribution } = await import('../src/utils/distributionEngine.js');
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
              return {
                id: rMap.id ? rMap.id.stringValue : ('r_' + dIdx + '_' + sessionNumber + '_' + rIdx),
                room: String(rName),
                name: String(rName),
                capacity: rCapacity,
                assignedProctors: []
              };
            });
          }
          return { sessionNumber, time, rooms };
        });

        return { dayNumber, dayName, date, sessions };
      });

      const result = runProctorDistribution(scheduleDays, proctors);

      const dalia = result.proctorStats.find(p => p.name.includes('داليه') || p.name.includes('داليا'));
      console.log('=== DALIA PROFILE & ASSIGNMENTS ===');
      console.log('Name:', dalia.name);
      console.log('Type:', dalia.type);
      console.log('Quota:', dalia.quota);
      console.log('Assigned:', dalia.assignedCount);
      console.log('Exclude Sess 3:', dalia.excludeSession3);
      console.log('Assignments:');
      dalia.assignments.forEach(a => {
        console.log(` - Day ${a.dayIndex + 1} (${a.dayName}) [${a.date}] | Sess ${a.sessionNumber} | Room ${a.room}`);
      });

      console.log('\n=== TESTING DALIA AGAINST THE UNASSIGNED SLOTS ===');
      result.summary.unassignedList.forEach((u, idx) => {
        const dayAssignments = dalia.assignments.filter(a => a.date === u.date);
        const daySessions = dayAssignments.map(a => a.sessionNumber);
        
        let reasons = [];
        if (daySessions.includes(u.session)) reasons.push('Already in this session');
        if (dalia.type === 'administrative' && daySessions.length >= 2) reasons.push(`Admin max 2 sessions reached (${daySessions.length})`);
        if (u.session === 3 && dalia.excludeSession3) reasons.push('Exclude session 3');
        if (u.session === 3 && daySessions.includes(1) && !daySessions.includes(2)) reasons.push('No 1+3 Gap Rule (has Sess 1 but no Sess 2)');
        
        console.log(`${idx + 1}. Date: ${u.date} (${u.dayName}) Sess ${u.session} Room ${u.room} -> [${reasons.join(', ') || 'No hard block! Why not assigned?'}]`);
      });

    });
  });
}

checkDalia();
