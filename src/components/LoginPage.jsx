import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, ArrowLeft, AlertCircle, Lock, User } from 'lucide-react';
import { getStoredAccounts, saveStoredUser } from '../utils/auth';

export default function LoginPage({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const accounts = getStoredAccounts();
    const cleanUser = username.trim().toLowerCase();
    const matched = accounts.find(
      (a) => a.username.toLowerCase() === cleanUser && a.password === password
    );

    if (matched) {
      setLoading(true);
      setTimeout(() => {
        saveStoredUser(matched);
        onLoginSuccess(matched);
      }, 300);
    } else {
      setErrorMsg('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.');
    }
  };

  const handleQuickFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-qou-dark to-slate-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-qou-accent selection:text-white">
      
      {/* Top University Brand */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white p-1 shadow-lg flex items-center justify-center overflow-hidden flex-shrink-0">
            <img src="./logo.png" alt="شعار جامعة القدس المفتوحة" className="w-full h-full object-contain" />
          </div>
          <div className="text-white">
            <div className="font-extrabold text-base sm:text-lg tracking-wide">
              جامعة القدس المفتوحة — فرع الخليل
            </div>
            <div className="text-xs text-emerald-200">
              قسم الامتحانات
            </div>
          </div>
        </div>

        <div className="hidden sm:block text-left text-xs text-emerald-200 font-mono">
          بوابة إدارة المراقبات الآلية
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-8 bg-white rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8 space-y-6">
        
        {/* Card Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-qou-primary mx-auto flex items-center justify-center shadow-inner border border-emerald-100">
            <KeyRound className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800">
            تسجيل الدخول للنظام
          </h2>
          <p className="text-xs text-slate-500">
            أدخل بيانات الاعتماد للوصول إلى مستودع مشاريع الامتحانات
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Username Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم المستخدم:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="أدخل اسم المستخدم"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full text-sm font-semibold pl-3 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary focus:bg-white transition"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              كلمة المرور:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm font-semibold pl-3 pr-10 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary focus:bg-white transition"
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-qou-primary hover:bg-qou-dark text-white font-black text-sm py-3.5 px-4 rounded-xl shadow-lg shadow-qou-primary/30 transition-all transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? 'جارٍ التحقق والدخول...' : 'دخول إلى النظام'}</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Helper Cards */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 text-center">
            الحسابات الافتراضية المعتمدة (انقر للتعبئة السريعة):
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickFill('admin', '123456')}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-qou-primary/50 bg-slate-50 hover:bg-emerald-50/50 text-right transition"
            >
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                <span>مدير النظام</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                user: <strong>admin</strong>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('admin2', '123456')}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-qou-primary/50 bg-slate-50 hover:bg-emerald-50/50 text-right transition"
            >
              <div className="font-bold text-slate-800 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>مسؤول الامتحانات</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                user: <strong>admin2</strong>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="text-center text-xs text-emerald-200/80 py-3 space-y-1">
        <div>جامعة القدس المفتوحة — فرع الخليل | المساعد الأكاديمي الدكتور مراد الجندي</div>
        <div className="text-[11px] text-emerald-300/70">إعداد وتصميم الموقع: الأستاذ أحمد النتشة</div>
      </div>

    </div>
  );
}
