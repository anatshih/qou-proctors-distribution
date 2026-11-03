const https = require('https');

async function test() {
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
              return { id: 'r_' + dIdx + '_' + sessionNumber + '_' + rIdx, room: String(rName), name: String(rName), capacity: rCapacity };
            });
          }
          return { sessionNumber, time, rooms };
        });
        return { dayNumber, dayName, date, sessions };
      });

      const result = runProctorDistribution(scheduleDays, proctors);

      console.log('=== REAL DISTRIBUTION TEST ===');
      console.log('Total Slots:', result.summary.totalSlots);
      console.log('Filled Slots:', result.summary.filledSlots);
      console.log('Unassigned Slots:', result.summary.unassignedSlotsCount);
      console.log('Coverage Rate:', result.summary.coverageRate + '%');

      const acads = result.proctorStats.filter(p => p.type === 'academic');
      const acad100 = acads.filter(p => p.assignedCount === p.quota).length;
      console.log('Academics 100% Completed:', acad100, '/', acads.length);
      acads.forEach(p => {
        console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (${p.assignedCount === p.quota ? '100% كامل ✓' : 'فرق ' + (p.quota - p.assignedCount)})`);
      });

      console.log('\nAdmins:');
      const admins = result.proctorStats.filter(p => p.type === 'administrative');
      admins.forEach(p => {
        console.log(` - ${p.name}: ${p.assignedCount} / ${p.quota} (سقف) [${Math.round((p.assignedCount / p.quota) * 100)}%]`);
      });
    });
  });
}

test();
