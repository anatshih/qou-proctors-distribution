import React, { useState } from 'react';
import { Upload, FileSpreadsheet, RotateCcw, CheckCircle, AlertCircle, Calendar, Hash, Building } from 'lucide-react';
import { parseUploadedSchedule } from '../utils/excelHandler';
import { DEFAULT_SCHEDULE, DEFAULT_TOTAL_SLOTS } from '../data/defaultSchedule';

export default function ScheduleTab({
  scheduleDays,
  setScheduleDays,
  totalRoomSlots,
  setTotalRoomSlots,
  uploadedFileName,
  setUploadedFileName
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  const handleFileUpload = async (file) => {
    if (!file) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await parseUploadedSchedule(file);
      setScheduleDays(result.days);
      setTotalRoomSlots(result.totalSlots);
      setUploadedFileName(result.fileName);
      setSuccessMsg(`تم بنجاح رفع وقراءة جدول القاعات: تم التعرف على ${result.days.length} يوماً و ${result.totalSlots} شاغر قاعة.`);
      setSelectedDayIdx(0);
    } catch (err) {
      setErrorMsg(err.message || 'حدث خطأ أثناء قراءة ملف الإكسل.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('هل تريد استعادة جدول القاعات الافتراضي للفصل الحالي (12 يوماً - 392 قاعة)؟')) {
      setScheduleDays(DEFAULT_SCHEDULE);
      setTotalRoomSlots(DEFAULT_TOTAL_SLOTS);
      setUploadedFileName('توزيع المراقبين 1261.xlsx (الجدول الافتراضي)');
      setSuccessMsg('تمت استعادة جدول القاعات الافتراضي بنجاح.');
      setErrorMsg('');
      setSelectedDayIdx(0);
    }
  };

  const currentDay = scheduleDays[selectedDayIdx];

  return (
    <div className="space-y-6">

      {/* Top Banner: Upload or Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Upload Drop Zone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white flex flex-col items-center justify-center relative ${
            isDragging 
              ? 'border-qou-primary bg-emerald-50/50 scale-[1.01]' 
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-qou-primary flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-800 mb-1">
            رفع ملف قاعات وجلسات الامتحانات (Excel)
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-4">
            اسحب وأفلت ملف الإكسل هنا (مثل: <code className="bg-slate-100 px-1 py-0.5 rounded text-qou-dark font-mono">توزيع المراقبين 1261.xlsx</code>) أو اضغط لاختيار ملف من جهازك
          </p>

          <label className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-bold px-5 py-2.5 rounded-xl cursor-pointer shadow-sm transition flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span>{loading ? 'جارٍ قراءة الملف...' : 'استعراض واختيار ملف الإكسل'}</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
              disabled={loading}
            />
          </label>

          {uploadedFileName && (
            <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>الملف الحالي: <strong>{uploadedFileName}</strong></span>
            </div>
          )}
        </div>

        {/* Schedule Stats & Reset Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-slate-400 mb-2">إحصائيات الجدول الحالي</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  أيام الامتحانات:
                </span>
                <span className="font-bold text-slate-800">{scheduleDays.length} يوماً</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  إجمالي شواغر القاعات:
                </span>
                <span className="font-extrabold text-qou-primary text-base">{totalRoomSlots} شاغر</span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetToDefault}
              className="w-full text-xs font-bold text-slate-600 hover:text-qou-dark bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl py-2.5 transition flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>استعادة الجدول الافتراضي (392 قاعة)</span>
            </button>
          </div>
        </div>

      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Interactive Schedule Browser */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <span>استعراض قاعات وجلسات الامتحانات:</span>
          </h4>
          <span className="text-xs text-slate-400">انقر على أي يوم لاستعراض جلساته وقاعاته</span>
        </div>

        {/* Days Horizontal Scroller */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {scheduleDays.map((d, idx) => {
            const isSelected = idx === selectedDayIdx;
            const roomsCount = (d.sessions || []).reduce((acc, s) => acc + (s.rooms || []).length, 0);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDayIdx(idx)}
                className={`p-3 rounded-xl border text-right transition-all flex-shrink-0 min-w-[130px] ${
                  isSelected
                    ? 'border-qou-primary bg-emerald-50/70 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">{d.dayName}</div>
                <div className="text-[11px] text-slate-500 font-mono">{d.date}</div>
                <div className="text-[10px] text-qou-primary font-bold mt-1 bg-white/80 px-2 py-0.5 rounded border border-emerald-100 inline-block">
                  {roomsCount} قاعة
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Details */}
        {currentDay && (
          <div className="mt-4 p-5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-200 gap-2">
              <div>
                <span className="text-base font-black text-slate-800 ml-2">{currentDay.dayName}</span>
                <span className="text-xs font-mono text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                  {currentDay.date}
                </span>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                عدد الجلسات: <strong>{(currentDay.sessions || []).length}</strong> | 
                عدد القاعات: <strong>{(currentDay.sessions || []).reduce((acc, s) => acc + (s.rooms || []).length, 0)}</strong>
              </div>
            </div>

            {/* Sessions Grid for This Day */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(currentDay.sessions || []).map((sess) => (
                <div key={sess.sessionNumber} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                    <span className="font-extrabold text-xs text-qou-primary bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                      جلسة {sess.sessionNumber}
                    </span>
                    <span className="text-xs text-slate-400 font-bold">
                      {(sess.rooms || []).length} قاعات
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(sess.rooms || []).map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-white transition"
                        title={r.proctor ? `المراقب: ${r.proctor}` : 'شاغر لم يحدد بعد'}
                      >
                        قاعة {r.room}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
