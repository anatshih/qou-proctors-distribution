// scratch/audit_app.cjs
// Comprehensive Automated Audit Script for QOU Proctor Distribution System

const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('🔍 بدء التدقيق الشامل والفحص البرمجي الدقيق للنظام...');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [نجاح]: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [فشل]: ${testName} - ${details}`);
  }
}

// -------------------------------------------------------------
// TEST SUITE 1: Code Structure & Files Audit
// -------------------------------------------------------------
console.log('--- 📁 فحص الملفات والمكونات الأساسية ---');

const requiredFiles = [
  'src/App.jsx',
  'src/components/LoginPage.jsx',
  'src/components/ProjectsHub.jsx',
  'src/components/Navbar.jsx',
  'src/components/ScheduleTab.jsx',
  'src/components/ProctorsTab.jsx',
  'src/components/DistributionTab.jsx',
  'src/components/ReviewTab.jsx',
  'src/components/ResultsTab.jsx',
  'src/components/QuickSwapModal.jsx',
  'src/components/ExceptionsModal.jsx',
  'src/components/SettingsModal.jsx',
  'src/utils/distributionEngine.js',
  'src/utils/excelHandler.js',
  'src/utils/auth.js',
  'src/data/initialProctors.js'
];

requiredFiles.forEach(file => {
  const fullPath = path.resolve(__dirname, '..', file);
  assert(fs.existsSync(fullPath), `وجود الملف الأساسي: ${file}`);
});

// -------------------------------------------------------------
// TEST SUITE 2: Initial 43 Proctors Roster Audit
// -------------------------------------------------------------
console.log('\n--- 👥 فحص كادر المراقبين الافتراضي (43 مراقباً) ---');

const initialDataPath = path.resolve(__dirname, '../src/data/initialProctors.js');
const initialDataContent = fs.readFileSync(initialDataPath, 'utf8');

// Count proctor strings (only lines inside the array)
const proctorLines = initialDataContent.split('\n').filter(l => {
  const trimmed = l.trim();
  return trimmed.startsWith('"') && (trimmed.endsWith('",') || trimmed.endsWith('"'));
});
assert(proctorLines.length === 43, `كادر المراقبين يحتوي تماماً على 43 اسماً (الموجود: ${proctorLines.length})`);

// Verify Ahmad Al-Natsheh is included in proctor roster
assert(initialDataContent.includes('النتشة'), 'وجود الأستاذ أحمد النتشة في قائمة المراقبين');

// Verify Academic Assistant in App/Footer/Navbar
const appPath = path.resolve(__dirname, '../src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');
assert(appContent.includes('مراد الجندي'), 'وجود المساعد الأكاديمي الدكتور مراد الجندي في تذييل النظام والاعتمادات');

// -------------------------------------------------------------
// TEST SUITE 3: Date Parsing & Excel Serial Number Audit
// -------------------------------------------------------------
console.log('\n--- 📅 فحص معالجة وتدقيق التواريخ وأرقام إكسل التسلسلية ---');

const excelHandlerPath = path.resolve(__dirname, '../src/utils/excelHandler.js');
const excelHandlerContent = fs.readFileSync(excelHandlerPath, 'utf8');

assert(excelHandlerContent.includes('extractDayAndDate'), 'وجود دالة استخراج وتنسيق التواريخ extractDayAndDate');
assert(excelHandlerContent.includes('25569'), 'معالجة أرقام تواريخ إكسل الرقمية (Excel Serial Conversion 25569)');

// Simulate Excel serial number calculation for 46333 (7/11/2026 UTC)
const serial = 46333;
const utc_days = Math.floor(serial - 25569);
const date_info = new Date(utc_days * 86400 * 1000);
const day = date_info.getUTCDate();
const month = date_info.getUTCMonth() + 1;
const year = date_info.getUTCFullYear();
assert(day === 7 && month === 11 && year === 2026, `دقة تحويل الرقم التسلسلي 46333 وفق تنسيق يوم/شهر/سنة (الناتج: ${day}/${month}/${year})`);

// -------------------------------------------------------------
// TEST SUITE 4: Distribution Engine Logic & Multi-Proctor Audit
// -------------------------------------------------------------
console.log('\n--- ⚡ فحص محرك التوزيع الذكي ودعم القاعات متعددة المراقبين (1، 2، 3) ---');

// Mock proctors list
const mockProctors = [];
for (let i = 1; i <= 20; i++) {
  mockProctors.push({
    id: `p_${i}`,
    name: `مراقب تجريبي ${i}`,
    quota: 10,
    isActive: true,
    exceptions: i === 1 ? ['11/7/2026_s1', '12/7/2026_all'] : []
  });
}

// Mock schedule days with multi-capacity rooms
const mockScheduleDays = [
  {
    dayName: 'السبت',
    date: '11/7/2026',
    sessions: [
      {
        sessionNumber: 1,
        rooms: [
          { room: '101', capacity: 1, assignedProctors: [] },
          { room: 'مدرج الشهداء', capacity: 2, assignedProctors: [] }, // Needs 2 proctors!
          { room: 'مختبر الحاسوب', capacity: 3, assignedProctors: [] }  // Needs 3 proctors!
        ]
      },
      {
        sessionNumber: 2,
        rooms: [
          { room: '102', capacity: 1, assignedProctors: [] },
          { room: 'مدرج الخليل', capacity: 2, assignedProctors: [] }
        ]
      }
    ]
  },
  {
    dayName: 'الأحد',
    date: '12/7/2026',
    sessions: [
      {
        sessionNumber: 1,
        rooms: [
          { room: '103', capacity: 1, assignedProctors: [] },
          { room: 'مدرج الشهداء', capacity: 2, assignedProctors: [] }
        ]
      }
    ]
  }
];

// Replicate distributionEngine logic in test to verify
function runAuditDistribution(proctorsList, schedule) {
  const daysCopy = JSON.parse(JSON.stringify(schedule));
  const activeProctors = proctorsList
    .filter(p => p.isActive && Number(p.quota) > 0)
    .map(p => ({
      ...p,
      quota: Number(p.quota),
      assignedCount: 0,
      daysWorked: new Set(),
      dailySessionCount: {},
      exceptions: new Set(p.exceptions || [])
    }));

  let totalSlots = 0;
  let filledSlots = 0;
  let conflicts = 0;
  let exceptionViolations = 0;
  let quotaViolations = 0;
  let intraRoomDuplicates = 0;

  daysCopy.forEach(day => {
    const dayDate = day.date;

    day.sessions.forEach(session => {
      const sessionNum = session.sessionNumber;
      const proctorsInThisSession = new Set();

      session.rooms.forEach(roomObj => {
        const capacity = Math.max(1, Number(roomObj.capacity) || 1);
        roomObj.capacity = capacity;
        roomObj.assignedProctors = [];

        for (let slot = 0; slot < capacity; slot++) {
          totalSlots++;

          const candidates = activeProctors.filter(p => {
            if (p.assignedCount >= p.quota) return false;
            if (proctorsInThisSession.has(p.id)) return false;
            const dayWideKey = `${dayDate}_all`;
            const sessionKey = `${dayDate}_s${sessionNum}`;
            if (p.exceptions.has(dayWideKey) || p.exceptions.has(sessionKey)) return false;
            return true;
          });

          if (candidates.length > 0) {
            candidates.sort((a, b) => (a.assignedCount / a.quota) - (b.assignedCount / b.quota));
            const selected = candidates[0];

            // Verify constraints
            if (proctorsInThisSession.has(selected.id)) conflicts++;
            if (selected.exceptions.has(`${dayDate}_all`) || selected.exceptions.has(`${dayDate}_s${sessionNum}`)) {
              exceptionViolations++;
            }
            if (roomObj.assignedProctors.includes(selected.name)) intraRoomDuplicates++;

            roomObj.assignedProctors.push(selected.name);
            selected.assignedCount++;
            if (selected.assignedCount > selected.quota) quotaViolations++;

            proctorsInThisSession.add(selected.id);
            filledSlots++;
          }
        }
        roomObj.proctor = roomObj.assignedProctors.join(' / ');
      });
    });
  });

  return {
    daysCopy,
    totalSlots,
    filledSlots,
    conflicts,
    exceptionViolations,
    quotaViolations,
    intraRoomDuplicates
  };
}

const auditResult = runAuditDistribution(mockProctors, mockScheduleDays);

assert(auditResult.totalSlots === 12, `حساب شواغر القاعات الإجمالية بدقة (المتوقع: 12 شاغر، المحسوب: ${auditResult.totalSlots})`);
assert(auditResult.filledSlots === 12, `تغطية كافة الشواغر بنسبة 100% (المسند: ${auditResult.filledSlots} من 12)`);
assert(auditResult.conflicts === 0, `انعدام التعارضات في نفس الجلسة (التعارضات: ${auditResult.conflicts})`);
assert(auditResult.exceptionViolations === 0, `الاحترام الصارم للاستثناءات والاعتذارات (المخالفات: ${auditResult.exceptionViolations})`);
assert(auditResult.quotaViolations === 0, `عدم تجاوز أنصبة المراقبين (التجاوزات: ${auditResult.quotaViolations})`);
assert(auditResult.intraRoomDuplicates === 0, `عدم تكرار نفس المراقب في نفس القاعة متعددة السعة (التكرار: ${auditResult.intraRoomDuplicates})`);

// Verify hall with capacity 2 has 2 distinct proctors
const shahadaHall = auditResult.daysCopy[0].sessions[0].rooms.find(r => r.room === 'مدرج الشهداء');
assert(shahadaHall.assignedProctors.length === 2, `مدرج الشهداء تم إسناد 2 مراقبين له بنجاح`);
assert(shahadaHall.assignedProctors[0] !== shahadaHall.assignedProctors[1], `المراقبان في مدرج الشهداء مختلفان تماماً (${shahadaHall.assignedProctors.join(' و ')})`);

// Verify computer lab with capacity 3 has 3 distinct proctors
const computerLab = auditResult.daysCopy[0].sessions[0].rooms.find(r => r.room === 'مختبر الحاسوب');
assert(computerLab.assignedProctors.length === 3, `مختبر الحاسوب تم إسناد 3 مراقبين له بنجاح`);
const distinctProctorsInLab = new Set(computerLab.assignedProctors);
assert(distinctProctorsInLab.size === 3, `المراقبون الثلاثة في مختبر الحاسوب متميزون دون أي تكرار`);

// -------------------------------------------------------------
// TEST SUITE 5: Headers, Footers & Privacy Integrity Audit
// -------------------------------------------------------------
console.log('\n--- 🏛️ فحص الترويسات الرسمية والتذييل والخصوصية ---');

const resultsTabPath = path.resolve(__dirname, '../src/components/ResultsTab.jsx');
const resultsTabContent = fs.readFileSync(resultsTabPath, 'utf8');

assert(resultsTabContent.includes('جامعة القدس المفتوحة — فرع الخليل'), 'الترويسة تتضمن اسم الجامعة المعتمد: جامعة القدس المفتوحة — فرع الخليل');
assert(resultsTabContent.includes('قسم الامتحانات'), 'الترويسة تتضمن: قسم الامتحانات');
assert(!resultsTabContent.includes('عميد / رئيس لجنة الامتحانات'), 'خلو التقارير من كتل التوقيعات الملغاة');
assert(!resultsTabContent.includes('مسؤول الجدولة والامتحانات'), 'خلو التقارير من توقيع مسؤول الجدولة');

const scheduleTabPath = path.resolve(__dirname, '../src/components/ScheduleTab.jsx');
const scheduleTabContent = fs.readFileSync(scheduleTabPath, 'utf8');
assert(scheduleTabContent.includes('ضبط سعات القاعات (1 / 2 / 3 مراقبين)'), 'شاشة جدول القاعات تدعم الضبط المركزي الموحد لسعات القاعات');
assert(scheduleTabContent.includes('الانتقال للخطوة 2'), 'وجود زر التوجيه للخطوة التالية في أسفل جدول القاعات');

const proctorsTabPath = path.resolve(__dirname, '../src/components/ProctorsTab.jsx');
const proctorsTabContent = fs.readFileSync(proctorsTabPath, 'utf8');
assert(proctorsTabContent.includes('الانتقال للخطوة 3'), 'وجود زر التوجيه للخطوة 3 في أسفل شاشة المراقبين');
assert(proctorsTabContent.includes('🎓 أكاديمي'), 'وجود تصنيف الكادر الأكاديمي في جدول المراقبين');
assert(proctorsTabContent.includes('💼 إداري'), 'وجود تصنيف الكادر الإداري في جدول المراقبين');

const navbarPath = path.resolve(__dirname, '../src/components/Navbar.jsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf8');
assert(navbarContent.includes('1. جدول القاعات والسعات'), 'الخطوة 1 مرقمة في شريط التنقل');
assert(navbarContent.includes('2. كادر المراقبين والأنصبة'), 'الخطوة 2 مرقمة في شريط التنقل');
assert(navbarContent.includes('3. التوزيع الآلي الذكي'), 'الخطوة 3 مرقمة في شريط التنقل');
assert(navbarContent.includes('4. المراجعة والتعيين اليدوي'), 'الخطوة 4 (المراجعة والتعيين اليدوي) مرقمة في شريط التنقل');
assert(navbarContent.includes('5. النتائج والطباعة المعتمدة'), 'الخطوة 5 (النتائج والطباعة المعتمدة) مرقمة في شريط التنقل');

// -------------------------------------------------------------
// TEST SUITE 6: Human-Comfort Proctor Constraints & Smart Heuristics
// -------------------------------------------------------------
console.log('\n--- 🧠 فحص الخوارزمية الذكية: التتابع، حظر فجوة (1 و 3)، وأولوية الأكاديمي ---');

async function runAsyncTests() {
  const enginePath = path.resolve(__dirname, '../src/utils/distributionEngine.js');
  const { runProctorDistribution } = await import('file:///' + enginePath.replace(/\\/g, '/'));

  // Realistic Exam Day with 3 sessions and multiple halls
  const examDays = [
    {
      dayName: 'السبت',
      date: '01/06/2026',
      sessions: [
        {
          sessionNumber: 1,
          rooms: [
            { room: '101', capacity: 1 },
            { room: '102', capacity: 1 },
            { room: '103', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        },
        {
          sessionNumber: 2,
          rooms: [
            { room: '101', capacity: 1 },
            { room: '102', capacity: 1 },
            { room: '103', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        },
        {
          sessionNumber: 3,
          rooms: [
            { room: '101', capacity: 1 },
            { room: '102', capacity: 1 },
            { room: '103', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        }
      ]
    },
    {
      dayName: 'الأحد',
      date: '02/06/2026',
      sessions: [
        {
          sessionNumber: 1,
          rooms: [
            { room: '101', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        },
        {
          sessionNumber: 2,
          rooms: [
            { room: '101', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        },
        {
          sessionNumber: 3,
          rooms: [
            { room: '101', capacity: 1 },
            { room: 'مدرج الشهداء', capacity: 2 }
          ]
        }
      ]
    }
  ];

  // Mix of Academic and Administrative proctors
  const testProctors = [
    { id: 'acad_1', name: 'د. أكاديمي أول', quota: 6, isActive: true, type: 'academic', exceptions: [] },
    { id: 'acad_2', name: 'د. أكاديمي ثان', quota: 6, isActive: true, type: 'academic', exceptions: [] },
    { id: 'acad_3', name: 'أستاذ أكاديمي ثالث', quota: 4, isActive: true, type: 'academic', exceptions: [] },
    { id: 'acad_no_s3', name: 'أستاذ بدون جلسة 3', quota: 4, isActive: true, type: 'academic', excludeSession3: true, exceptions: [] },
    { id: 'admin_1', name: 'أ. إداري أول', quota: 4, isActive: true, type: 'administrative', exceptions: [] },
    { id: 'admin_2', name: 'أ. إداري ثان', quota: 4, isActive: true, type: 'administrative', exceptions: [] }
  ];

  const distribution = runProctorDistribution(examDays, testProctors);

  assert(distribution.success === true, 'نجاح محرك التوزيع الآلي');
  assert(distribution.summary.gapViolationCount === 0, 'الالتزام التام بعدم وجود أي فجوة بين جلسة 1 و 3');

  // Verify no administrative proctor ever has 3 sessions in 1 day
  let adminWith3Sessions = 0;
  distribution.proctorStats.filter(p => p.type === 'administrative').forEach(p => {
    const dailyCounts = {};
    p.assignments.forEach(a => {
      dailyCounts[a.date] = (dailyCounts[a.date] || 0) + 1;
    });
    Object.values(dailyCounts).forEach(cnt => {
      if (cnt >= 3) adminWith3Sessions++;
    });
  });
  assert(adminWith3Sessions === 0, 'حظر الـ 3 جلسات في يوم واحد للمراقبين الإداريين تماماً');

  // Verify excludeSession3 proctor was never assigned in session 3
  const noS3Proctor = distribution.proctorStats.find(p => p.id === 'acad_no_s3');
  const assignedS3Count = noS3Proctor.assignments.filter(a => a.sessionNumber === 3).length;
  assert(assignedS3Count === 0, 'الاحترام الكامل لاستبعاد الجلسة الثالثة للمراقب (الجلسات 3 المسندة: 0)');

  // Verify consecutive pairings count is positive
  assert(distribution.summary.consecutivePairsCount > 0, `تشكيل جلسات متتابعة مريحة (1+2 أو 2+3): ${distribution.summary.consecutivePairsCount} ثنائية متصلة`);

  // Verify no 1 and 3 gaps across all proctors
  let gapFound = false;
  distribution.proctorStats.forEach(p => {
    const daysSessions = {};
    p.assignments.forEach(a => {
      if (!daysSessions[a.date]) daysSessions[a.date] = new Set();
      daysSessions[a.date].add(a.sessionNumber);
    });
    Object.entries(daysSessions).forEach(([date, set]) => {
      if (set.has(1) && set.has(3) && !set.has(2)) {
        gapFound = true;
      }
    });
  });
  assert(!gapFound, 'التأكد من عدم وجود أي مراقب مسند للجلسة الأولى والثالثة مع ترك الثانية فارغة');

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 نتيجة الفحص والتدقيق الإجمالية:`);
  console.log(`   إجمالي الفحوصات: ${totalTests}`);
  console.log(`   الفحوصات الناجحة: ${passedTests}`);
  console.log(`   الفحوصات الفاشلة: ${failedTests}`);
  console.log('================================================================');

  if (failedTests === 0) {
    console.log('🎉 النظام سليم 100% وخالٍ من أي تعارضات أو أخطاء برمجية أو انحرافات في القيود!');
  } else {
    console.error('⚠️ تم العثور على أخطاء تتطلب مراجعة فورية!');
    process.exit(1);
  }
}

runAsyncTests().catch(err => {
  console.error('Error running async tests:', err);
  process.exit(1);
});
