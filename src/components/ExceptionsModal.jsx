import React, { useState } from 'react';
import { X, Calendar, Check, Ban, AlertCircle, RefreshCw, Clock, Sparkles } from 'lucide-react';

export default function ExceptionsModal({
  isOpen,
  onClose,
  proctor,
  scheduleDays,
  onSaveExceptions
}) {
  if (!isOpen || !proctor) return null;

  // Local state for exceptions
  const [currentExceptions, setCurrentExceptions] = useState(
    new Set(proctor.exceptions || [])
  );

  // Local state for preferences
  const [excludeSession3, setExcludeSession3] = useState(Boolean(proctor.excludeSession3));
  const [preferredPair, setPreferredPair] = useState(proctor.preferredPair || 'any');

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
    const isFullyExcluded = next.has(dayWideKey) || (sessions.length > 0 && sessions.every(s => next.has(`${date}_s${s.sessionNumber}`)));

    if (isFullyExcluded) {
      next.delete(dayWideKey);
      sessions.forEach(s => next.delete(`${date}_s${s.sessionNumber}`));
    } else {
      next.add(dayWideKey);
      sessions.forEach(s => next.add(`${date}_s${s.sessionNumber}`));
    }
    setCurrentExceptions(next);
  };

  const handleToggleExcludeSession3Global = () => {
    const nextVal = !excludeSession3;
    setExcludeSession3(nextVal);
  };

  const handleExcludeSession3AllDays = () => {
    const next = new Set(currentExceptions);
    scheduleDays.forEach(d => {
      next.add(`${d.date}_s3`);
    });
    setCurrentExceptions(next);
    setExcludeSession3(true);
  };

  const handleIncludeSession3AllDays = () => {
    const next = new Set(currentExceptions);
    scheduleDays.forEach(d => {
      next.delete(`${d.date}_s3`);
    });
    setCurrentExceptions(next);
    setExcludeSession3(false);
  };

  const clearAll = () => {
    setCurrentExceptions(new Set());
    setExcludeSession3(false);
    setPreferredPair('any');
  };

  const handleSave = () => {
    onSaveExceptions(proctor.id, Array.from(currentExceptions), {
      excludeSession3,
      preferredPair
    });
    onClose();
  };

  const isSessionExcluded = (date, sessionNum) => {
    if (sessionNum === 3 && excludeSession3) return true;
    return currentExceptions.has(`${date}_all`) || currentExceptions.has(`${date}_s${sessionNum}`);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-qou-accentLight text-qou-accentDark flex items-center justify-center font-bold text-lg">
              📅
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  استثناءات وتفضيلات المراقب: <span className="text-qou-primary">{proctor.name}</span>
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  proctor.type === 'administrative' 
                    ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}>
                  {proctor.type === 'administrative' ? '💼 كادر إداري' : '🎓 كادر أكاديمي'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                حدد التفضيلات الزمنية، واستثنِ الجلسات (⛔ أحمر) أو أتحها (✅ أخضر) بما يضمن راحة المراقب.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Preferences Panel (Session 3 & Preferred Consecutive Pair) */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-emerald-50/20 border-b border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-qou-primary" />
            <span>خيارات التوزيع الذكي المخصصة لهذا المراقب:</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            
            {/* Session 3 Exclude Toggle */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>استبعاد الجلسة الثالثة دائماً:</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  مفيد للمراقبين القادمين من بلدات بعيدة أو لمن تنتهي مواصلاتهم مبكراً
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleExcludeSession3Global}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition border flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
                  excludeSession3 
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm' 
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                {excludeSession3 ? (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>مستبعدة دائماً</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>متاحة للمراقبة</span>
                  </>
                )}
              </button>
            </div>

            {/* Preferred Pair */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span>⭐</span>
                  <span>تفضيل الجلسات المتتالية:</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  توجيه المحرك لتفضيل زوج محدد عند التوزيع
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreferredPair('any')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                    preferredPair === 'any' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                  title="تلقائي: 1+2 أو 2+3 حسب حاجة القاعات"
                >
                  تلقائي
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredPair('1-2')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                    preferredPair === '1-2' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="تفضيل الجلسة 1 و 2 صباحاً"
                >
                  1 و 2
                </button>
                <button
                  type="button"
                  onClick={() => setPreferredPair('2-3')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                    preferredPair === '2-3' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="تفضيل الجلسة 2 و 3 ظهراً"
                >
                  2 و 3
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Info banner & Quick Controls */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between text-xs text-amber-800 gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              خوارزمية التوزيع لن تسند هذا المراقب نهائياً في أي جلسة مستثناة، ولن تضعه في جلسة 1 و 3 مع ترك الثانية فارغة.
            </span>
          </div>

          <div className="flex items-center gap-2 font-bold">
            <button
              type="button"
              onClick={handleExcludeSession3AllDays}
              className="text-[11px] bg-white hover:bg-rose-50 text-rose-700 px-2 py-1 rounded border border-rose-200 transition cursor-pointer"
            >
              استثناء ج3 في كل الأيام
            </button>
            <button
              type="button"
              onClick={handleIncludeSession3AllDays}
              className="text-[11px] bg-white hover:bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200 transition cursor-pointer"
            >
              إتاحة ج3 في كل الأيام
            </button>
            <span className="bg-white px-2.5 py-1 rounded-md border border-amber-200 text-slate-800">
              الاستثناءات المحددة: {currentExceptions.size + (excludeSession3 ? ' + (استبعاد ج3 عام)' : '')}
            </span>
          </div>
        </div>

        {/* Days & Sessions Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {scheduleDays.map((day, idx) => {
              const sessions = day.sessions || [];
              const isDayExcluded = currentExceptions.has(`${day.date}_all`) || 
                (sessions.length > 0 && sessions.every(s => isSessionExcluded(day.date, s.sessionNumber)));

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
                      className={`text-[11px] px-2 py-0.5 rounded font-medium border transition cursor-pointer ${
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
                          className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
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
            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-rose-50 transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>تفريغ جميع الاستثناءات والتفضيلات</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-sm bg-qou-primary hover:bg-qou-dark text-white font-bold rounded-xl shadow-md shadow-qou-primary/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الاستثناءات والتفضيلات</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
