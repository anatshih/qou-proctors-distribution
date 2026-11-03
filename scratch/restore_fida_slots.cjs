const https = require('https');

const baseUrl = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

const FIDA_SLOTS = [
  { day: 3, sess: 1, room: '508' },
  { day: 5, sess: 1, room: '510' },
  { day: 5, sess: 3, room: '306' },
  { day: 6, sess: 1, room: '412' },
  { day: 10, sess: 1, room: '304' },
  { day: 10, sess: 3, room: '505' },
  { day: 11, sess: 3, room: '301' },
  { day: 12, sess: 1, room: '504' },
  { day: 12, sess: 3, room: '416' }
];

function fetchDocSafe() {
  return new Promise((resolve, reject) => {
    https.get(baseUrl, (res) => {
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

function updateScheduleDaysSafe(scheduleDays) {
  return new Promise((resolve, reject) => {
    const patchUrl = baseUrl + '?updateMask.fieldPaths=scheduleDays';
    const parsedUrl = new URL(patchUrl);
    const payload = JSON.stringify({ fields: { scheduleDays: { arrayValue: { values: scheduleDays } } } });
    const payloadBuffer = Buffer.from(payload, 'utf8');

    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': payloadBuffer.length
      }
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(JSON.parse(buf.toString('utf8')));
      });
    });
    req.on('error', reject);
    req.write(payloadBuffer);
    req.end();
  });
}

async function run() {
  console.log('Fetching document...');
  const doc = await fetchDocSafe();
  const scheduleDays = doc.fields.scheduleDays.arrayValue.values;

  let restored = 0;
  scheduleDays.forEach((dv, dIdx) => {
    const dayNumber = dIdx + 1;
    (dv.mapValue.fields.sessions.arrayValue.values || []).forEach(sv => {
      const sNum = parseInt(sv.mapValue.fields.sessionNumber.integerValue || sv.mapValue.fields.sessionNumber.stringValue || 1, 10);
      (sv.mapValue.fields.rooms.arrayValue.values || []).forEach(rv => {
        const rf = rv.mapValue.fields;
        const room = rf.room ? rf.room.stringValue : '';

        // Check if this slot matches Fida's slot
        const isFidaSlot = FIDA_SLOTS.some(fs => fs.day === dayNumber && fs.sess === sNum && fs.room === room);
        if (isFidaSlot) {
          if (rf.assignedProctors && rf.assignedProctors.arrayValue && rf.assignedProctors.arrayValue.values) {
            rf.assignedProctors.arrayValue.values.forEach(item => {
              if (item.stringValue.includes('تيسير')) {
                console.log(`Restoring slot Day ${dayNumber} Sess ${sNum} Room ${room}: "${item.stringValue}" -> "فداء تيسير محمود طه"`);
                item.stringValue = 'فداء تيسير محمود طه';
                restored++;
              }
            });
          }
          if (rf.proctor && rf.proctor.stringValue && rf.proctor.stringValue.includes('تيسير')) {
            rf.proctor.stringValue = 'فداء تيسير محمود طه';
          }
        }
      });
    });
  });

  console.log(`Total restored slots for Fida: ${restored}`);
  if (restored > 0) {
    console.log('Updating Firestore...');
    await updateScheduleDaysSafe(scheduleDays);
    console.log('✅ Successfully restored all Fida Taha slots in Firestore!');
  }
}

run().catch(console.error);
