const https = require('https');

async function run() {
  const { runProctorDistribution } = await import('../src/utils/distributionEngine.js');

  const url = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
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

        console.log(`Parsed ${proctors.length} proctors, ${scheduleDays.length} days.`);
        console.log('Total Quota Sum:', proctors.reduce((s, p) => s + p.quota, 0));
        
        const result = runProctorDistribution(scheduleDays, proctors);

        console.log('\n=== REAL SIMULATION RESULTS WITH CURRENT SYSTEM DATA ===');
        console.log('Total Room Slots Required:', result.summary.totalSlots);
        console.log('Filled Slots:', result.summary.filledSlots);
        console.log('Unassigned Slots:', result.summary.unassignedSlotsCount);
        console.log('Coverage Rate:', result.summary.coverageRate + '%');
        console.log('Consecutive Session Pairs (1+2 or 2+3):', result.summary.consecutivePairsCount);
        console.log('Gap Violations (1 and 3 without 2):', result.summary.gapViolationCount);
        console.log('Single-Session Days:', result.summary.singleSessionDaysCount);
        console.log('3-Session Days (emergency only):', result.summary.threeSessionDaysCount);

        if (result.summary.unassignedSlotsCount > 0) {
          console.log('\nUnassigned slots breakdown:');
          result.summary.unassignedList.forEach(u => {
            console.log(` - Day ${u.dayIndex + 1} (${u.dayName}) | Session ${u.sessionNumber} | Room ${u.roomName}`);
          });
        }

        console.log('\n=== PROCTORS QUOTA FULFILLMENT ===');
        let full = 0;
        let partial = 0;
        result.proctorStats.forEach(p => {
          if (p.assignedCount === p.quota) {
            full++;
          } else {
            partial++;
            console.log(` * ${p.name}: Assigned ${p.assignedCount} / ${p.quota} (Remains: ${p.remainingQuota})`);
          }
        });
        console.log(`Total 100% Fulfilled: ${full} / ${result.proctorStats.length}`);

      } catch (e) {
        console.error(e);
      }
    });
  }).on('error', err => console.error(err.message));
}

run();
