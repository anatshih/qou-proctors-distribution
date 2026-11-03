import React, { useEffect } from 'react';
import { AlertTriangle, AlertCircle, Sparkles, HelpCircle, Info, X, Check, Trash2, Printer } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'تأكيد الإجراء',
  message,
  consequences = [],
  confirmText = 'تأكيد ومتابعة',
  cancelText = 'إلغاء وتراجع',
  variant = 'warning', // 'danger' | 'warning' | 'primary' | 'info'
  icon = null
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Icon & color styling by variant
  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-100 text-rose-600 border-rose-200',
          defaultIcon: <Trash2 className="w-5 h-5 text-rose-600" />,
          btnConfirm: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200',
          boxBg: 'bg-rose-50/80 border-rose-200/80 text-rose-950',
          boxHeader: 'text-rose-900',
          boxIcon: <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
        };
      case 'primary':
        return {
          iconBg: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          defaultIcon: <Sparkles className="w-5 h-5 text-indigo-700" />,
          btnConfirm: 'bg-qou-primary hover:bg-qou-dark text-white shadow-qou-light',
          boxBg: 'bg-indigo-50/80 border-indigo-200/80 text-indigo-950',
          boxHeader: 'text-indigo-900',
          boxIcon: <Info className="w-4 h-4 text-indigo-700 shrink-0" />
        };
      case 'info':
        return {
          iconBg: 'bg-blue-100 text-blue-700 border-blue-200',
          defaultIcon: <Printer className="w-5 h-5 text-blue-700" />,
          btnConfirm: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200',
          boxBg: 'bg-blue-50/80 border-blue-200/80 text-blue-950',
          boxHeader: 'text-blue-900',
          boxIcon: <Info className="w-4 h-4 text-blue-700 shrink-0" />
        };
      case 'warning':
      default:
        return {
          iconBg: 'bg-amber-100 text-amber-700 border-amber-200',
          defaultIcon: <AlertCircle className="w-5 h-5 text-amber-700" />,
          btnConfirm: 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200',
          boxBg: 'bg-amber-50/80 border-amber-200/80 text-amber-950',
          boxHeader: 'text-amber-900',
          boxIcon: <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
        };
    }
  };

  const v = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      
      {/* Backdrop click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <div 
        className="relative bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs ${v.iconBg}`}>
              {icon || v.defaultIcon}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                يرجى تأكيد الإجراء قبل المتابعة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-3.5 text-xs">
          
          {/* Main Description Message */}
          {message && (
            <p className="text-slate-700 leading-relaxed font-semibold">
              {message}
            </p>
          )}

          {/* Consequences / Results Box */}
          {consequences && consequences.length > 0 && (
            <div className={`rounded-xl p-3.5 space-y-2 border ${v.boxBg}`}>
              <div className={`font-black flex items-center gap-1.5 text-xs ${v.boxHeader}`}>
                {v.boxIcon}
                <span>ماذا سيترتب على هذا الإجراء؟ (النتيجة المباشرة):</span>
              </div>
              <ul className="space-y-1.5 pr-4 list-disc text-slate-700 text-[11.5px] leading-relaxed font-medium">
                {consequences.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer ${v.btnConfirm}`}
          >
            <Check className="w-4 h-4" />
            <span>{confirmText}</span>
          </button>
        </div>

      </div>

    </div>
  );
}
