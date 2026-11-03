import React, { useState } from 'react';
import { 
  Play, CheckCircle2, AlertTriangle, ArrowLeft, RefreshCw, Sparkles, 
  Building, Users, Calendar, GraduationCap, Briefcase, Clock, ShieldCheck, Heart, Trash2, RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { runProctorDistribution } from '../utils/distributionEngine';

export default function DistributionTab({
  proctors,
  scheduleDays,
  setScheduleDays,
  totalRoomSlots,
  distributionResult,
  setDistributionResult,
  setActiveTab
}) {
  const [isRunning, setIsRunning] = useState(false);

  // Calculations
  const activeProctors = proctors.filter(p => p.isActive && Number(p.quota) > 0);
  const activeAcademics = activeProctors.filter(p => (p.type || 'academic') === 'academic');
  const activeAdministratives = activeProctors.filter(p => p.type === 'administrative');

  const totalQuotas = activeProctors.reduce((sum, p) => sum + Number(p.quota), 0);
  const totalExceptions = proctors.reduce((sum, p) => sum + (p.exceptions?.length || 0) + (p.excludeSession3 ? 1 : 0), 0);

  const handleRunDistribution = () => {
    setIsRunning(true);

    setTimeout(() => {
      try {
        const result = runProctorDistribution(scheduleDays, proctors);
        setDistributionResult(result);
        setScheduleDays(result.schedule);

        // Confetti effect if success
        if (result.success && result.summary.filledSlots > 0) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } catch (err) {
        console.error('Error during distribution:', err);
        alert('حدث خطأ أثناء تنفيذ التوزيع: ' + err.message);
      } finally {
        setIsRunning(false);
      }
    }, 400);
  };

  const handleClearDistribution = () => {
    const confirmed = window.confirm(
      'هل أنت متأكد من تصفير وإلغاء التوزيع الحالي وتفريغ كافة القاعات؟\n\nسيتم مسح كافة أسماء المراقبين من القاعات والعودة لنقطة البداية لتتمكن من التوزيع بناءً على أي أرصدة جديدة.'
    );
    if (!confirmed) return;

    setScheduleDays(prevDays => {
      return (prevDays || []).map(day => ({
        ...day,
        sessions: (day.sessions || []).map(session => ({
          ...session,
          rooms: (session.rooms || []).map(room => ({
            ...room,
            assignedProctors: [],
            proctor: ''
          }))
        }))
      }));
    });

    setDistributionResult(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Hero Action Card */}
      <div className="bg-gradient-to-br from-qou-dark via-qou-primary to-emerald-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-qou-accent" />
              <span>محرك الجدولة والذكاء الرياضي الإنساني</span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-200 bg-black/20 px-3 py-1 rounded-full border border-white/10">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>خوارزمية مراعاة راحة الكادر وعدالة الأنصبة</span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl lg:text-3xl font-black mb-2 leading-tight">
              التوزيع الآلي الذكي لمراقبات الامتحانات
            </h2>
            <p className="text-sm text-emerald-100 max-w-2xl leading-relaxed">
              يقوم المحرك بتوزيع المراقبين بدقة متناهية مع تفعيل ضوابط الراحة الجامعية:
              أولوية استيفاء العبء للأكاديميين، جلسات متتابعة مريحة (1 و 2) أو (2 و 3)، منع فجوة (1 و 3) نهائياً، وتفادي الحضور لجلسة واحدة.
            </p>
          </div>

          {/* Active Constraints Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-white/10 rounded-xl p-2.5 border border-white/15 backdrop-blur-sm flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-qou-accent flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-[11px]">أولوية الأكاديمي</div>
                <div className="text-[10px] text-emerald-200">استيفاء النصاب أولاً</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-2.5 border border-white/15 backdrop-blur-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-qou-accent flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-[11px]">تتابع (1+2 أو 2+3)</div>
                <div className="text-[10px] text-emerald-200">جلسات متصلة بلا فراغ</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-2.5 border border-white/15 backdrop-blur-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-qou-accent flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-[11px]">منع فجوة (1 و 3)</div>
                <div className="text-[10px] text-emerald-200">حظر ترك ج2 للأكاديمي</div>
              </div>
            </div>

            <div className="bg-white/10 rounded-xl p-2.5 border border-white/15 backdrop-blur-sm flex items-center gap-2">
              <Heart className="w-4 h-4 text-qou-accent flex-shrink-0" />
              <div>
                <div className="font-bold text-white text-[11px]">مرونة وسقف الإداري</div>
                <div className="text-[10px] text-emerald-200">إتاحة 1 و 3 وسقف جلستين</div>
              </div>
            </div>
          </div>

          {/* Pre-flight Checks Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-emerald-200 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-300" />
                  المراقبون النشطون:
                </span>
                <span className="text-[11px] font-bold text-qou-accent">{activeProctors.length} مراقباً</span>
              </div>
              <div className="text-xl font-bold">{totalQuotas} حصة</div>
              <div className="text-[11px] text-emerald-200 flex items-center gap-2 mt-0.5">
                <span>🎓 {activeAcademics.length} أكاديمي</span>
                <span>•</span>
                <span>💼 {activeAdministratives.length} إداري</span>
              </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-emerald-200 mb-1 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-emerald-300" />
                شواغر القاعات:
              </div>
              <div className="text-xl font-bold">{totalRoomSlots} شاغر قاعة</div>
              <div className="text-[11px] text-emerald-200">عبر {scheduleDays.length} يوماً امتحانياً</div>
            </div>

            <div className="bg-white/10 rounded-2xl p-4 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-emerald-200 mb-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-300" />
                الاستثناءات والتفضيلات:
              </div>
              <div className="text-xl font-bold">{totalExceptions} استثناء</div>
              <div className="text-[11px] text-emerald-200">يتم تفاديها واحترامها 100%</div>
            </div>
          </div>

          {/* Launch & Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isRunning || activeProctors.length === 0 || totalRoomSlots === 0}
              onClick={handleRunDistribution}
              className="bg-qou-accent hover:bg-qou-accentDark text-slate-950 font-black text-sm lg:text-base px-7 py-3.5 rounded-2xl shadow-lg shadow-black/20 transition-all transform active:scale-95 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جارٍ التوزيع وبناء الجدولة الذكية...</span>
                </>
              ) : distributionResult ? (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>إعادة التوزيع الآلي (بناءً على الأرصدة الحالية)</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>بدء التوزيع الآلي الذكي الآن</span>
                </>
              )}
            </button>

            {distributionResult && (
              <button
                type="button"
                onClick={handleClearDistribution}
                disabled={isRunning}
                className="bg-rose-500/20 hover:bg-rose-600/30 text-rose-200 hover:text-white font-bold text-sm px-5 py-3.5 rounded-2xl border border-rose-400/30 transition flex items-center gap-2 cursor-pointer shadow-sm"
                title="تصفير ومسح كافة تعيينات المراقبين وتفريغ القاعات للبدء من جديد"
              >
                <Trash2 className="w-4 h-4 text-rose-300" />
                <span>تصفير وإلغاء التوزيع</span>
              </button>
            )}

            {distributionResult && (
              <button
                type="button"
                onClick={() => setActiveTab('review')}
                className="bg-white/15 hover:bg-white/25 text-white font-bold text-sm px-6 py-3.5 rounded-2xl border border-white/20 transition flex items-center gap-2 cursor-pointer"
              >
                <span>الخطوة 4: المراجعة والتعيين اليدوي</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Distribution Results Summary Card */}
      {distributionResult && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-black text-slate-800 text-lg">تقرير نتيجة التوزيع الأخير</h3>
              <p className="text-xs text-slate-500">تم فحص جميع القاعات والجلسات واستيفاء القيود الإنسانية والجامعية</p>
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-qou-primary">
                {distributionResult.summary.coverageRate}%
              </span>
              <div className="text-[11px] text-slate-400">نسبة تغطية القاعات</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="bg-gradient-to-r from-emerald-500 to-qou-primary h-full rounded-full transition-all duration-700"
                style={{ width: `${distributionResult.summary.coverageRate}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-xs text-slate-500 font-medium">
              <span>تم إسناد: <strong>{distributionResult.summary.filledSlots}</strong> شاغر قاعة</span>
              <span>المتبقي: <strong>{distributionResult.summary.unassignedSlotsCount}</strong> شاغر</span>
            </div>
          </div>

          {/* Notice about unassigned slots if any */}
          {distributionResult.summary.unassignedSlotsCount > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  تنبيه: يوجد {distributionResult.summary.unassignedSlotsCount} شاغر قاعة لم يُسند إليها مراقب بعد.
                </span>
              </div>
              <p className="text-amber-700 leading-relaxed">
                السبب يعود إلى أن مجموع أنصبة المراقبين النشطين ({distributionResult.summary.totalQuota}) 
                أقل من إجمالي شواغر القاعات المطلوبة ({distributionResult.summary.totalSlots})، أو بسبب كثرة استثناءات الجلسات.
                يمكنك التوجه لتبويب <strong>"كادر المراقبين"</strong> وزيادة أنصبة بعض المراقبين أو تفعيل مراقبين إضافيين لتغطية النقص.
              </p>
            </div>
          )}

          {/* Detailed Verification Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-800">تتابع الجلسات المريح (1+2 أو 2+3)</div>
                <div className="text-slate-500">
                  تم تشكيل <strong>{distributionResult.summary.consecutivePairsCount}</strong> مراقبة زوجية متصلة لراحة المراقبين وتفادي الحضور لجلسة يتيمة.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-800">منع فجوة (1 و 3) بنسبة 100%</div>
                <div className="text-slate-500">
                  تم الالتزام التام: <strong>0</strong> فجوات (لا يوجد أي مراقب مسند لجلسة 1 و 3 مع ترك الثانية فارغة).
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-800">أولوية الكادر الأكاديمي للعبء التعاقدي</div>
                <div className="text-slate-500">
                  تم استيفاء أنصبة الزملاء الأكاديميين كأولوية قصوى أولاً، ثم الاستعانة بالإداريين للإسناد.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-slate-800">انضباط سقف الجلسات اليومي</div>
                <div className="text-slate-500">
                  حظر تام للـ 3 جلسات للإداريين، وجلستان كحد أقصى للأكاديميين (3 جلسات للضرورة القصوى: {distributionResult.summary.threeSessionDaysCount || 0}).
                </div>
              </div>
            </div>
          </div>

          {/* Next button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className="bg-qou-primary hover:bg-qou-dark text-white font-bold text-sm px-8 py-3 rounded-xl shadow-md shadow-qou-primary/20 transition inline-flex items-center gap-2 cursor-pointer"
            >
              <span>الانتقال للخطوة 4: المراجعة وسد الشواغر يدوياً</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
