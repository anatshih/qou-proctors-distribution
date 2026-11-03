const https = require('https');
const url = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

function fetchDocSafe() {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const fullBuffer = Buffer.concat(chunks);
          resolve(JSON.parse(fullBuffer.toString('utf8')));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const doc = await fetchDocSafe();
  const proctorNames = doc.fields.proctors.arrayValue.values.map(v => v.mapValue.fields.name.stringValue);

  const unmatched = [];
  doc.fields.scheduleDays.arrayValue.values.forEach((dv, dIdx) => {
    const dName = dv.mapValue.fields.dayName.stringValue;
    const date = dv.mapValue.fields.date.stringValue;
    (dv.mapValue.fields.sessions.arrayValue.values || []).forEach(sv => {
      const sNum = sv.mapValue.fields.sessionNumber.integerValue || sv.mapValue.fields.sessionNumber.stringValue;
      (sv.mapValue.fields.rooms.arrayValue.values || []).forEach(rv => {
        const rName = rv.mapValue.fields.room.stringValue;
        const assigned = (rv.mapValue.fields.assignedProctors && rv.mapValue.fields.assignedProctors.arrayValue && rv.mapValue.fields.assignedProctors.arrayValue.values)
          ? rv.mapValue.fields.assignedProctors.arrayValue.values.map(x => x.stringValue)
          : [];
        assigned.forEach(n => {
          if (!proctorNames.includes(n)) {
            unmatched.push({ day: dIdx + 1, dName, date, sess: sNum, room: rName, name: n });
          }
        });
      });
    });
  });

  console.log('======================================================');
  console.log('Total unmatched instances in schedule:', unmatched.length);
  console.log('======================================================');
  unmatched.forEach(u => {
    console.log(`Day ${u.day} (${u.dName} ${u.date}) Sess ${u.sess} Room ${u.room}: "${u.name}"`);
  });
  if (unmatched.length === 0) {
    console.log('🎉 PERFECT! Every single assigned room across all days matches the official proctor list 100%!');
  }
}

run();
