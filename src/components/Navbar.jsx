import React from 'react';
import { ShieldCheck, UserCheck, Settings, LogOut, ArrowRight, FolderGit2 } from 'lucide-react';
import { ROLES } from '../utils/auth';

export default function Navbar({ 
  currentUser, 
  onLogout,
  onBackToHub,
  activeTab, 
  setActiveTab,
  semesterCode,
  examType,
  onOpenSettings
}) {
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;

  const tabs = [
    { id: 'proctors', label: 'كادر المراقبين والأنصبة', icon: '👥' },
    { id: 'schedule', label: 'جدول القاعات والجلسات', icon: '🏫' },
    { id: 'distribution', label: 'محرك التوزيع الذكي', icon: '⚡' },
    { id: 'results', label: 'النتائج والفلاتر والطباعة', icon: '🖨️' },
  ];

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      {/* Top University Brand Bar */}
      <div className="bg-qou-primary text-white px-4 lg:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & University Name & Back to Projects Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="bg-white/15 hover:bg-white/25 text-white text-xs font-black px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 shadow-sm"
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
                جامعة القدس المفتوحة
              </h1>
              <p className="text-[11px] text-emerald-100 font-medium">
                نظام التوزيع الذكي للمراقبات
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
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition"
                title="إعدادات النظام والحسابات"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}

            {/* Logout button */}
            <button
              type="button"
              onClick={onLogout}
              className="bg-rose-600/80 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              title="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">خروج</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <nav className="flex space-x-1 space-x-reverse overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-qou-primary text-white shadow-sm shadow-qou-primary/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
