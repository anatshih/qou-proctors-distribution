import React from 'react';
import { ShieldCheck, UserCheck, Settings, LogOut, CheckCircle2 } from 'lucide-react';
import { ROLES } from '../utils/auth';

export default function Navbar({ 
  currentUser, 
  onSwitchUser, 
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
          
          {/* Logo & University Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
              <img src="/logo.png" alt="شعار جامعة القدس المفتوحة" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-bold text-base lg:text-lg leading-tight tracking-wide">
                جامعة القدس المفتوحة
              </h1>
              <p className="text-xs text-emerald-100 font-medium">
                نظام التوزيع الذكي لمراقبات الامتحانات
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

          {/* User Profile & Role Switcher */}
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

            {/* Quick Switch Button */}
            <button
              onClick={onSwitchUser}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-2.5 py-1.5 rounded-lg border border-white/20 transition flex items-center gap-1.5"
              title="تبديل الحساب (مدير النظام / مسؤول الامتحانات)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">تبديل الحساب</span>
            </button>

            {/* Settings button (available for Super Admin) */}
            {isSuperAdmin && (
              <button
                onClick={onOpenSettings}
                className="bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 p-1.5 rounded-lg border border-amber-300/30 transition"
                title="إعدادات النظام والفصل"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
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
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap ${
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
