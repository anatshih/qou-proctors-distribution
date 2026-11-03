import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, LogIn, X, Check } from 'lucide-react';
import { saveStoredUser } from '../utils/auth';

export default function LoginModal({
  isOpen,
  onClose,
  currentUser,
  setCurrentUser,
  accounts
}) {
  if (!isOpen) return null;

  const [selectedAccount, setSelectedAccount] = useState(currentUser || accounts[0]);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setPassword('');
    setErrorMsg('');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password !== selectedAccount.password) {
      setErrorMsg('كلمة المرور غير صحيحة.');
      return;
    }

    setCurrentUser(selectedAccount);
    saveStoredUser(selectedAccount);
    onClose();
  };

  const handleInstantSwitch = (acc) => {
    setCurrentUser(acc);
    saveStoredUser(acc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-qou-primary text-white flex items-center justify-center font-bold">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">
                تسجيل الدخول / تبديل الحساب
              </h2>
              <p className="text-xs text-slate-500">
                اختر الحساب المطلوب للمتابعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">

          <div className="text-xs font-bold text-slate-500 mb-1">
            الحسابات المتوفرة في النظام:
          </div>

          {/* Accounts List */}
          <div className="space-y-2">
            {(accounts || []).map((acc) => {
              const isCurrent = currentUser?.username === acc.username;
              const isSelected = selectedAccount?.username === acc.username;

              return (
                <div
                  key={acc.username}
                  onClick={() => handleSelectAccount(acc)}
                  className={`p-3.5 rounded-xl border text-right transition cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'border-qou-primary bg-emerald-50/60 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                      acc.role === 'super_admin' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {acc.role === 'super_admin' ? (
                        <ShieldCheck className="w-5 h-5 text-amber-700" />
                      ) : (
                        <UserCheck className="w-5 h-5 text-emerald-700" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                        <span>{acc.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-medium">
                            الحالي
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        المستخدم: <strong>{acc.username}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantSwitch(acc);
                    }}
                    className="text-xs font-bold bg-white hover:bg-qou-primary hover:text-white text-qou-primary border border-qou-primary/30 px-3 py-1.5 rounded-lg transition"
                  >
                    دخول سريع
                  </button>
                </div>
              );
            })}
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="pt-3 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور للحساب ({selectedAccount?.username}):
              </label>
              <input
                type="password"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary"
              />
              {errorMsg && (
                <div className="text-xs text-rose-600 mt-1 font-semibold">{errorMsg}</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold bg-qou-primary hover:bg-qou-dark text-white rounded-xl shadow-md transition flex items-center gap-1.5"
              >
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول</span>
              </button>
            </div>
          </form>

        </div>

      </div>
    </div>
  );
}
