import React from 'react';
import { 
  ShieldCheck, UserCheck, Settings, LogOut, ArrowRight, Check,
  ChevronLeft, Sparkles
} from 'lucide-react';
import { ROLES } from '../utils/auth';

export default function Navbar({ 
  currentUser, 
  onLogout,
  onBackToHub,
  activeTab, 
  setActiveTab,
  semesterCode,
  examType,
  onOpenSettings,
  workflowStats
}) {
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;

  const steps = [
    {
      id: 'schedule',
      stepNum: 1,
      title: '1. جدول القاعات والسعات',
      subtitle: workflowStats?.hasSchedule 
        ? `${workflowStats.totalSlots} شاغر (${workflowStats.daysCount} أيام)` 
        : 'رفع الإكسل وتحديد السعات',
      isCompleted: Boolean(workflowStats?.hasSchedule && workflowStats?.totalSlots > 0),
      icon: '🏢'
    },
    {
      id: 'proctors',
      stepNum: 2,
      title: '2. كادر المراقبين والأنصبة',
      subtitle: workflowStats?.isQuotaMatched 
        ? 'الأنصبة مطابقة 100% ✓' 
        : workflowStats?.hasSchedule 
        ? `المحدد: ${workflowStats.totalQuotas} من ${workflowStats.totalSlots}` 
        : 'تحديد الأنصبة والتصنيف',
      isCompleted: Boolean(workflowStats?.isQuotaMatched),
      icon: '👥'
    },
    {
      id: 'distribution',
      stepNum: 3,
      title: '3. التوزيع الآلي الذكي',
      subtitle: workflowStats?.isDistributed 
        ? 'تم التوزيع بنجاح ✓' 
        : 'فحص وإطلاق التوزيع',
      isCompleted: Boolean(workflowStats?.isDistributed),
      icon: '⚡'
    },
    {
      id: 'review',
      stepNum: 4,
      title: '4. المراجعة والتعيين اليدوي',
      subtitle: 'سد الشواغر والتعيين المباشر',
      isCompleted: Boolean(workflowStats?.isDistributed),
      icon: '✍️'
    },
    {
      id: 'results',
      stepNum: 5,
      title: '5. النتائج والطباعة المعتمدة',
      subtitle: 'تصدير الجداول والطباعة',
      isCompleted: Boolean(workflowStats?.isDistributed),
      icon: '🖨️'
    }
  ];

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      
      {/* Top University Brand Bar */}
      <div className="bg-qou-primary text-white px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & University Name & Back to Projects Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-black px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="العودة إلى مستودع المشاريع والفصول"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>مستودع المشاريع</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="./logo.png" alt="شعار جامعة القدس المفتوحة" className="w-full h-full object-contain" />
            </div>

            <div className="hidden md:block">
              <h1 className="font-extrabold text-sm leading-tight tracking-wide">
                جامعة القدس المفتوحة — فرع الخليل
              </h1>
              <p className="text-[11px] text-emerald-100 font-medium">
                قسم الامتحانات
              </p>
            </div>
          </div>

          {/* Current Semester & Exam Type Badges */}
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-white/15 px-3 py-1 rounded-full border border-white/20 font-semibold backdrop-blur-sm">
              الفصل: <strong className="text-qou-accent">{semesterCode}</strong>
            </span>
            <span className="bg-qou-accent text-slate-900 px-3 py-1 rounded-full font-bold shadow-sm">
              {examType}
            </span>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold leading-tight">{currentUser?.name}</div>
              <div className="text-[11px] text-emerald-200 flex items-center justify-end gap-1">
                {isSuperAdmin ? (
                  <ShieldCheck className="w-3 h-3 text-amber-300" />
                ) : (
                  <UserCheck className="w-3 h-3 text-emerald-300" />
                )}
                <span>{currentUser?.badge}</span>
              </div>
            </div>

            {/* Settings button for Super Admin */}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition cursor-pointer"
                title="إعدادات النظام والحسابات"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Logout button */}
            <button
              type="button"
              onClick={onLogout}
              className="bg-rose-600/80 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workflow Stepper Navigation (5 Sequential Steps) */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5">
        <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {steps.map((tab) => {
            const isActive = activeTab === tab.id;
            const isCompleted = tab.isCompleted;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`p-2.5 rounded-2xl text-right transition border flex items-center justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-qou-primary text-white border-qou-primary shadow-sm shadow-qou-primary/20 ring-2 ring-qou-primary/20'
                    : isCompleted
                    ? 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200 text-slate-800'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={`الانتقال إلى: ${tab.title}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Step Number or Completed Checkmark */}
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 transition ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : tab.stepNum}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-black truncate leading-tight">
                      {tab.title}
                    </div>
                    <div className={`text-[10px] font-semibold truncate mt-0.5 ${
                      isActive 
                        ? 'text-white/80' 
                        : isCompleted 
                        ? 'text-emerald-700 font-bold' 
                        : 'text-slate-400'
                    }`}>
                      {tab.subtitle}
                    </div>
                  </div>
                </div>

                <span className="text-base flex-shrink-0 hidden sm:inline opacity-90">
                  {tab.icon}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

    </header>
  );
}