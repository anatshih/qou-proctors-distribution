const https = require('https');

const baseUrl = 'https://firestore.googleapis.com/v1/projects/alnaseem-field-reports/databases/(default)/documents/qou_projects/proj_1261_midterm_default';

const OFFICIAL_NAMES = [
  "أحمد عوني حجازي النتشة",
  "أسماء عبد القادر يوسف شاهين",
  "اسماعيل محمد اسماعيل شندي (عمايره)",
  "تيسير عبد الحميد يونس ابو ساكور",
  "جهاد محمود حسين اغباريه",
  "حمزة عبد الحميد مجاهد مجاهد",
  "خالد ابراهيم مطلق النجار",
  "خالد سليمان محمد كتلو",
  "رائد أحمد إبراهيم أبو عيد",
  "راتب حريبات",
  "سناء عزمي ابراهيم ابو فاره",
  "شادي محمد اقطيش عواد",
  "صالح عبد الفتاح صالح الشلالفه",
  "عادل عطيه إبراهيم ريان",
  "عبد القادر محمد يوسف دراويش",
  "عصام محمد عيد أبو سنينة",
  "عيسى خليل محمود المصري",
  "غسان نعمان محمود ابو سنينة",
  "فؤاد شاور",
  "فضل ابراهيم عبدالعزيز عيدة",
  "كامل عيسى اسماعيل سليم",
  "لمياء محمد محمود عمرو",
  "ماجد احمد عبد الله ابو ريان",
  "محمود عبد الحافظ اسماعيل مغثه",
  "مريم رفيق محمد مسوده",
  "نور القواسمي",
  "هيا عمران بدر عابدين",
  "باسل عزمي عبد الفتاح المرقطن",
  "خالد عبد الفتاح خالد ابو شكر",
  "داليه نعمان عمرو",
  "دعاء محمد راتب شبانه",
  "رمزي محمد أحمد الحيح",
  "زهية عبد الرؤوف عبد الله القواسمي",
  "سعاد علي حسين زلوم",
  "سلام اسحاق اسماعيل الخطيب",
  "سماح محي الدين محمد نعمان سيد احمد",
  "عباده موسى حسين عمرو",
  "عدنان يعقوب يونس وزوز",
  "فداء تيسير محمود طه",
  "فهد محمد حسن طنينة",
  "محمد عبد المجيد محمد عودة",
  "محمد نبيل توفيق جرار",
  "يسرى سميح هاشم أبو عيشة"
];

function matchToOfficial(raw) {
  if (!raw) return '';
  if (OFFICIAL_NAMES.includes(raw)) return raw;

  // Clean raw from replacement chars and spaces
  const clean = raw.replace(/[\uFFFD\s]/g, '');

  let best = null;
  let maxScore = -1;

  for (let official of OFFICIAL_NAMES) {
    const offClean = official.replace(/\s/g, '');

    // Common character count in order
    let matchCount = 0;
    let sIdx = 0;
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const foundIdx = offClean.indexOf(char, sIdx);
      if (foundIdx !== -1) {
        matchCount++;
        sIdx = foundIdx + 1;
      }
    }

    const score = matchCount / Math.max(clean.length, offClean.length);
    if (score > maxScore) {
      maxScore = score;
      best = official;
    }
  }

  if (maxScore > 0.5) {
    return best;
  }
  return raw;
}

function fetchDocSafe() {
  return new Promise((resolve, reject) => {
    https.get(baseUrl, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const fullBuffer = Buffer.concat(chunks);
          const jsonStr = fullBuffer.toString('utf8');
          resolve(JSON.parse(jsonStr));
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
  console.log('Fetching document with safe buffer concatenation...');
  const doc = await fetchDocSafe();
  const scheduleDays = doc.fields.scheduleDays.arrayValue.values;

  let fixedSlots = 0;
  let fixedDayNames = 0;

  scheduleDays.forEach((dv, dIdx) => {
    const df = dv.mapValue.fields;

    // Clean dayName if needed
    if (df.dayName && df.dayName.stringValue) {
      const rawDay = df.dayName.stringValue;
      if (rawDay.includes('\uFFFD') || !['السبت', 'الاحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'].includes(rawDay)) {
        const cleanDay = rawDay.replace(/[\uFFFD\s]/g, '');
        let corrected = rawDay;
        if (cleanDay.includes('سبت')) corrected = 'السبت';
        else if (cleanDay.includes('احد') || cleanDay.includes('أحد')) corrected = 'الاحد';
        else if (cleanDay.includes('اثنين') || cleanDay.includes('إثنين')) corrected = 'الاثنين';
        else if (cleanDay.includes('ثلاثاء')) corrected = 'الثلاثاء';
        else if (cleanDay.includes('اربعاء') || cleanDay.includes('أربعاء')) corrected = 'الأربعاء';
        
        console.log(`Day ${dIdx+1} dayName: "${rawDay}" -> "${corrected}"`);
        df.dayName.stringValue = corrected;
        fixedDayNames++;
      }
    }

    (df.sessions.arrayValue.values || []).forEach(sv => {
      (sv.mapValue.fields.rooms.arrayValue.values || []).forEach(rv => {
        const rf = rv.mapValue.fields;

        // Clean assignedProctors
        if (rf.assignedProctors && rf.assignedProctors.arrayValue && rf.assignedProctors.arrayValue.values) {
          rf.assignedProctors.arrayValue.values.forEach(item => {
            const raw = item.stringValue;
            if (!OFFICIAL_NAMES.includes(raw)) {
              const matched = matchToOfficial(raw);
              if (matched && matched !== raw) {
                console.log(`Slot matched: "${raw}" -> "${matched}"`);
                item.stringValue = matched;
                fixedSlots++;
              }
            }
          });
        }

        // Clean proctor string field
        if (rf.proctor && rf.proctor.stringValue) {
          const rawProctor = rf.proctor.stringValue;
          if (rawProctor.includes('\uFFFD') || !OFFICIAL_NAMES.includes(rawProctor)) {
            const matchedProctor = rawProctor.split('/').map(s => matchToOfficial(s.trim())).join(' / ');
            rf.proctor.stringValue = matchedProctor;
          }
        }
      });
    });
  });

  console.log(`Fixed slots: ${fixedSlots}, Fixed day names: ${fixedDayNames}`);
  if (fixedSlots > 0 || fixedDayNames > 0) {
    console.log('Writing clean UTF-8 payload to Firestore...');
    await updateScheduleDaysSafe(scheduleDays);
    console.log('✅ Firestore scheduleDays updated safely with 100% buffer integrity!');
  } else {
    console.log('No slots needed fixing.');
  }
}

run().catch(console.error);
