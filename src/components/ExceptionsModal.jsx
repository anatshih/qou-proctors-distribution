import React from 'react';
import { X, Calendar, Check, Ban, AlertCircle, RefreshCw } from 'lucide-react';

export default function ExceptionsModal({
  isOpen,
  onClose,
  proctor,
  scheduleDays,
  onSaveExceptions
}) {
  if (!isOpen || !proctor) return null;

  // Local state for exceptions of this proctor
  const [currentExceptions, setCurrentExceptions] = React.useState(
    new Set(proctor.exceptions || [])
  );

  const toggleSession = (date, sessionNum) => {
    const key = `${date}_s${sessionNum}`;
    const next = new Set(currentExceptions);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCurrentExceptions(next);
  };

  const toggleFullDay = (date, sessions) => {
    const dayWideKey = `${date}_all`;
    const next = new Set(currentExceptions);

    // If day-wide or all sessions are already excluded, remove them
    const isFullyExcluded = next.has(dayWideKey) || sessions.every(s => next.has(`${date}_s${s.sessionNumber}`));

    if (isFullyExcluded) {
      next.delete(dayWideKey);
      sessions.forEach(s => next.delete(`${date}_s${s.sessionNumber}`));
    } else {
      next.add(dayWideKey);
      sessions.forEach(s => next.add(`${date}_s${s.sessionNumber}`));
    }
    setCurrentExceptions(next);
  };

  const clearAll = () => {
    setCurrentExceptions(new Set());
  };

  const handleSave = () => {
    onSaveExceptions(proctor.id, Array.from(currentExceptions));
    onClose();
  };

  const isSessionExcluded = (date, sessionNum) => {
    return currentExceptions.has(`${date}_all`) || currentExceptions.has(`${date}_s${sessionNum}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-qou-accentLight text-qou-accentDark flex items-center justify-center font-bold">
              📅
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                استثناءات واعتذارات المراقب: <span className="text-qou-primary">{proctor.name}</span>
              </h2>
              <p className="text-xs text-slate-500">
                انقر على الجلسة لاستثنائها (⛔ باللون الأحمر) أو إتاحتها (✅ باللون الأخضر)
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

        {/* Info banner */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              خوارزمية التوزيع لن تسند هذا المراقب نهائياً في أي يوم أو جلسة تم استثناؤها هنا.
            </span>
          </div>
          <div className="font-bold bg-white px-2.5 py-1 rounded-md border border-amber-200">
            عدد الاستثناءات الحالية: {currentExceptions.size}
          </div>
        </div>

        {/* Days & Sessions Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scheduleDays.map((day, idx) => {
              const sessions = day.sessions || [];
              const isDayExcluded = currentExceptions.has(`${day.date}_all`) || 
                (sessions.length > 0 && sessions.every(s => currentExceptions.has(`${day.date}_s${s.sessionNumber}`)));

              return (
                <div
                  key={idx}
                  className={`border rounded-xl p-3 transition-all ${
                    isDayExcluded 
                      ? 'border-rose-200 bg-rose-50/40' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-sm text-slate-800">{day.dayName}</div>
                      <div className="text-[11px] text-slate-500">{day.date}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleFullDay(day.date, sessions)}
                      className={`text-[11px] px-2 py-0.5 rounded font-medium border transition ${
                        isDayExcluded
                          ? 'bg-rose-100 text-rose-700 border-rose-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {isDayExcluded ? 'إلغاء استثناء اليوم' : 'استثناء كامل اليوم'}
                    </button>
                  </div>

                  {/* Sessions Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {sessions.map((sess) => {
                      const excluded = isSessionExcluded(day.date, sess.sessionNumber);
                      return (
                        <button
                          key={sess.sessionNumber}
                          type="button"
                          onClick={() => toggleSession(day.date, sess.sessionNumber)}
                          className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                            excluded
                              ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <span className="text-[10px] opacity-80">جلسة</span>
                          <span className="text-sm font-extrabold">{sess.sessionNumber}</span>
                          {excluded ? (
                            <Ban className="w-3.5 h-3.5" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-rose-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تفريغ جميع استثناءات هذا المراقب</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-qou-primary hover:bg-qou-dark text-white font-bold rounded-xl shadow-md shadow-qou-primary/20 transition flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الاستثناءات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
