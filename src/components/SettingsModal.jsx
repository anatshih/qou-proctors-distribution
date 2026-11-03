import React, { useState } from 'react';
import { X, Settings, Download, Upload, RotateCcw, Check, Users, KeyRound, Eye, EyeOff } from 'lucide-react';
import { INITIAL_PROCTORS } from '../data/initialProctors';
import { DEFAULT_SCHEDULE, DEFAULT_TOTAL_SLOTS } from '../data/defaultSchedule';
import { DEFAULT_ACCOUNTS } from '../utils/auth';
import ConfirmModal from './ConfirmModal';

export default function SettingsModal({
  isOpen,
  onClose,
  semesterCode,
  setSemesterCode,
  examType,
  setExamType,
  proctors,
  setProctors,
  scheduleDays,
  setScheduleDays,
  setTotalRoomSlots,
  setDistributionResult,
  accounts,
  setAccounts
}) {
  // Hooks must always be declared unconditionally at top level
  const [tempSemester, setTempSemester] = useState(semesterCode);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [tempExamType, setTempExamType] = useState(examType);
  const [localAccounts, setLocalAccounts] = useState(accounts || DEFAULT_ACCOUNTS);
  const [showPasswords, setShowPasswords] = useState(false);

  if (!isOpen) return null;

  const examTypeOptions = [
    'نصفي',
    'نهائي',
    'غير مكتمل نصفي',
    'غير مكتمل نهائي'
  ];

  const handleAccountChange = (index, field, value) => {
    setLocalAccounts(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSave = () => {
    setSemesterCode(tempSemester.trim() || '1261');
    setExamType(tempExamType);
    setAccounts(localAccounts);
    onClose();
  };

  // Export all system state as a JSON backup
  const handleExportBackup = () => {
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      semesterCode: tempSemester,
      examType: tempExamType,
      proctors,
      scheduleDays,
      accounts: localAccounts
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `نسخة_احتياطية_مراقبات_${tempSemester}_${tempExamType}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.proctors && Array.isArray(data.proctors)) {
          setProctors(data.proctors);
        }
        if (data.scheduleDays && Array.isArray(data.scheduleDays)) {
          setScheduleDays(data.scheduleDays);
          const totalSlots = data.scheduleDays.reduce((acc, d) => 
            acc + (d.sessions || []).reduce((sAcc, s) => 
              sAcc + (s.rooms || []).reduce((rAcc, r) => rAcc + Math.max(1, Number(r.capacity) || 1), 0), 0), 0);
          setTotalRoomSlots(totalSlots);
        }
        if (data.semesterCode) setSemesterCode(data.semesterCode);
        if (data.examType) setExamType(data.examType);
        if (data.accounts && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
          setLocalAccounts(data.accounts);
        }
        setDistributionResult(null);
        alert('تمت استعادة النسخة الاحتياطية بنجاح!');
        onClose();
      } catch (err) {
        alert('ملف النسخة الاحتياطية غير صالح.');
      }
    };
    reader.readAsText(file);
  };

  // Reset to Factory Default
  const handleFactoryReset = () => {
    setConfirmConfig({
      title: 'تحذير هام: استعادة ضبط المصنع الكامل للمنظومة',
      message: 'أنت على وشك إعادة ضبط المنظومة بالكامل واستعادة البيانات الافتراضية الأصلية.',
      variant: 'danger',
      confirmText: 'نعم، استعادة ضبط المصنع',
      cancelText: 'إلغاء وتراجع',
      consequences: [
        'سيتم استعادة كادر الـ 43 مراقباً الأصلي بكافة بياناتهم وأنصبتهم المعتمدة لفرع الخليل.',
        'سيتم استعادة جدول الامتحانات الافتراضي المعتمد للفصل 1261 (12 يوماً، 402 شاغراً).',
        'سيتم مسح أي تعديلات محلية أو حسابات مستحدثة وتصفير نتائج التوزيع.',
        'سيتم تنظيف التخزين المحلي وإعادة فتح النظام بحالته الرسمية الأولى.'
      ],
      onConfirm: () => {
        setProctors(INITIAL_PROCTORS);
        setScheduleDays(DEFAULT_SCHEDULE);
        setTotalRoomSlots(DEFAULT_TOTAL_SLOTS);
        setSemesterCode('1261');
        setExamType('نصفي');
        setAccounts(DEFAULT_ACCOUNTS);
        setLocalAccounts(DEFAULT_ACCOUNTS);
        setDistributionResult(null);
        localStorage.clear();
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                إعدادات النظام والحسابات
              </h2>
              <p className="text-xs text-slate-500">
                صلاحية خاصة بـ: <strong>مدير النظام (Super Admin)</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* Section 1: Accounts Management (New!) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-qou-primary" />
                <span>إدارة بيانات تسجيل الدخول للحسابين</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowPasswords(prev => !prev)}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {localAccounts.map((acc, idx) => (
                <div key={acc.role} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{acc.name}</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {acc.role === 'super_admin' ? 'مدير النظام' : 'مسؤول'}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم المستخدم:</label>
                    <input
                      type="text"
                      value={acc.username}
                      onChange={(e) => handleAccountChange(idx, 'username', e.target.value)}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">كلمة المرور:</label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={acc.password}
                      onChange={(e) => handleAccountChange(idx, 'password', e.target.value)}
                      className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Semester & Exam Type Settings */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="font-bold text-sm text-slate-800 pb-2 border-b border-slate-100">
              بيانات الدورة الامتحانية الحالية
            </h4>

            {/* Semester Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                رقم الفصل الدراسي:
              </label>
              <input
                type="text"
                value={tempSemester}
                onChange={(e) => setTempSemester(e.target.value)}
                placeholder="مثال: 1261"
                className="w-full text-sm font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary"
              />
              <p className="text-[11px] text-slate-400 mt-1">يظهر في ترويسات الكشوفات وتسمية ملفات الإكسل المصدرة.</p>
            </div>

            {/* Exam Type Options */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                نوع الامتحان:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {examTypeOptions.map((type) => {
                  const isSelected = tempExamType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTempExamType(type)}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                        isSelected
                          ? 'border-qou-primary bg-emerald-50 text-qou-primary shadow-sm'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span>{type}</span>
                      {isSelected && <Check className="w-4 h-4 text-qou-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Backup & Restore Section */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="font-bold text-sm text-slate-800">
              النسخ الاحتياطي واستعادة البيانات
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 border border-slate-200"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>تصدير نسخة احتياطية (JSON)</span>
              </button>

              <label className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 border border-slate-200 cursor-pointer">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>استيراد نسخة احتياطية</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportBackup}
                />
              </label>
            </div>
          </div>

          {/* Section 4: Factory Reset */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleFactoryReset}
              className="w-full text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-xl py-2.5 transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط المصنع (استعادة الكادر والجدول والحسابات الأصلية)</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-qou-primary hover:bg-qou-dark text-white rounded-xl shadow-md transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>حفظ الإعدادات والحسابات</span>
          </button>
        </div>

      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmConfig)}
        onClose={() => setConfirmConfig(null)}
        {...confirmConfig}
      />

    </div>
  );
}
