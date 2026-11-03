import React, { useState } from 'react';
import { 
  Upload, FileSpreadsheet, RotateCcw, CheckCircle, AlertCircle, 
  Calendar, Building, Trash2, Printer, Eye, FileText, Check
} from 'lucide-react';
import { parseUploadedSchedule } from '../utils/excelHandler';

export default function ScheduleTab({
  scheduleDays,
  setScheduleDays,
  totalRoomSlots,
  setTotalRoomSlots,
  uploadedFileName,
  setUploadedFileName,
  semesterCode,
  examType
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // View mode: 'cards' (interactive) | 'report' (printable audit review table)
  const [viewMode, setViewMode] = useState('cards');

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
      setViewMode('report'); // Automatically show the review report after upload!
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

  const handleClearSchedule = () => {
    if (window.confirm('هل أنت متأكد من تصفير وتفريغ جميع القاعات الحالية لرفع ملف جديد؟')) {
      setScheduleDays([]);
      setTotalRoomSlots(0);
      setUploadedFileName('');
      setSuccessMsg('');
      setErrorMsg('');
      setSelectedDayIdx(0);
    }
  };

  const handlePrintReview = () => {
    window.print();
  };

  const hasSchedule = scheduleDays && scheduleDays.length > 0;
  const currentDay = hasSchedule ? scheduleDays[selectedDayIdx] : null;

  return (
    <div className="space-y-6">

      {/* Top Banner: Upload & Status */}
      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Upload Drop Zone */}
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`lg:col-span-2 border-2 border-dashed rounded-3xl p-6 text-center transition-all bg-white flex flex-col items-center justify-center relative ${
            isDragging 
              ? 'border-qou-primary bg-emerald-50/50 scale-[1.01]' 
              : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-qou-primary flex items-center justify-center mb-3">
            <Upload className="w-6 h-6" />
          </div>

          <h3 className="text-base font-black text-slate-800 mb-1">
            رفع ملف قاعات وجلسات الامتحانات (Excel)
          </h3>
          <p className="text-xs text-slate-500 max-w-md mb-4 leading-relaxed">
            اسحب وأفلت ملف إكسل القاعات هنا (مثل: <code className="bg-slate-100 px-1 py-0.5 rounded text-qou-dark font-mono font-bold">توزيع المراقبين 1261.xlsx</code>) أو اختر الملف من جهازك
          </p>

          <label className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3 rounded-xl cursor-pointer shadow-md shadow-qou-primary/20 transition flex items-center gap-2">
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
            <div className="mt-3 text-xs text-emerald-800 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-200 flex items-center gap-1.5 font-bold">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>الملف المفحوص والمرفوع: <strong>{uploadedFileName}</strong></span>
            </div>
          )}
        </div>

        {/* Schedule Summary Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
          <div>
            <div className="text-xs font-bold text-slate-400 mb-2">حالة القاعات لهذا المشروع</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  أيام الامتحانات:
                </span>
                <span className="font-bold text-slate-800">
                  {hasSchedule ? `${scheduleDays.length} يوماً` : '0 (فارغ)'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  إجمالي شواغر القاعات:
                </span>
                <span className="font-black text-qou-primary text-base">
                  {hasSchedule ? `${totalRoomSlots} شاغر` : '0 قاعة'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
            {hasSchedule ? (
              <button
                type="button"
                onClick={handleClearSchedule}
                className="w-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl py-2.5 transition flex items-center justify-center gap-2"
                title="تفريغ القاعات بالكامل لإعادة رفع ملف جديد"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ وتصفير القاعات الحالية</span>
              </button>
            ) : (
              <div className="text-xs text-center text-slate-400 bg-slate-50 py-2.5 rounded-xl border border-slate-100">
                القاعات فارغة، ارفع ملف الإكسل لبدء الفحص
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Alert Messages */}
      {errorMsg && (
        <div className="no-print p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="no-print p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Schedule Content (Only shown if schedule is loaded) */}
      {hasSchedule ? (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-qou-primary" />
              <span className="font-extrabold text-sm text-slate-800">طريقة عرض القاعات:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setViewMode('report')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    viewMode === 'report' ? 'bg-white text-slate-900 shadow-sm' : ''
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>تقرير المراجعة والتدقيق (شامل)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                    viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm' : ''
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>استعراض البطاقات اليومية</span>
                </button>
              </div>

              {/* Print Review Report Button */}
              <button
                type="button"
                onClick={handlePrintReview}
                className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                title="طباعة كشف مراجعة وتدقيق القاعات والجلسات"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة تقرير مراجعة القاعات</span>
              </button>
            </div>
          </div>

          {/* ========================================================
              VIEW 1: FORMAL AUDIT & REVIEW REPORT (PRINTABLE)
             ======================================================== */}
          {viewMode === 'report' && (
            <div className="print-area bg-white rounded-3xl border border-slate-200 p-6 lg:p-8 shadow-sm space-y-6">
              
              {/* Report Header */}
              <div className="border-b-2 border-qou-primary pb-4">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <h2 className="text-xl font-black text-slate-900">
                      جامعة القدس المفتوحة — فرع الخليل
                    </h2>
                    <h3 className="text-xs font-bold text-qou-primary mt-0.5">
                      قسم الامتحانات
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      تقرير تدقيق ومراجعة قاعات الامتحانات — الفصل: <strong className="text-slate-900">{semesterCode}</strong> | امتحان: <strong className="text-slate-900">{examType}</strong>
                    </p>
                  </div>

                  <div className="text-center">
                    <div className="w-14 h-14 mx-auto mb-1 flex items-center justify-center">
                      <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                      كشف القاعات والجلسات المعتمدة
                    </div>
                  </div>

                  <div className="text-left text-xs text-slate-500 space-y-1">
                    <div>التاريخ: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
                    <div>إجمالي الأيام: <strong>{scheduleDays.length} يوماً</strong></div>
                    <div>إجمالي القاعات: <strong className="text-qou-primary font-bold">{totalRoomSlots} شاغر</strong></div>
                  </div>
                </div>
              </div>

              {/* Comprehensive Review Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-black border-y-2 border-slate-300">
                      <th className="py-2.5 px-3 w-12 text-center border-l border-slate-200">#</th>
                      <th className="py-2.5 px-3 w-40 border-l border-slate-200">اليوم والتاريخ</th>
                      <th className="py-2.5 px-3 w-24 text-center border-l border-slate-200">رقم الجلسة</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">عدد القاعات</th>
                      <th className="py-2.5 px-4 border-l border-slate-200">أرقام القاعات المفتوحة بالجلسة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {scheduleDays.map((day, dIdx) => {
                      const sessions = day.sessions || [];
                      const dayRoomsTotal = sessions.reduce((acc, s) => acc + (s.rooms || []).length, 0);

                      return sessions.map((sess, sIdx) => {
                        const roomNumbers = (sess.rooms || []).map(r => r.room).join(' ، ');

                        return (
                          <tr key={`${dIdx}_${sIdx}`} className="hover:bg-slate-50 transition">
                            {/* Sequential numbering */}
                            <td className="py-2 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                              {dIdx + 1}.{sIdx + 1}
                            </td>

                            {/* Day and Date */}
                            <td className="py-2 px-3 font-bold text-slate-800 border-l border-slate-200">
                              <div className="text-slate-900 font-extrabold">{day.dayName}</div>
                              <div className="text-[11px] font-mono text-slate-600 font-semibold">{day.date}</div>
                            </td>

                            {/* Session Number */}
                            <td className="py-2 px-3 text-center border-l border-slate-200">
                              <span className="font-black bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                                جلسة {sess.sessionNumber}
                              </span>
                            </td>

                            {/* Rooms count in session */}
                            <td className="py-2 px-3 text-center font-bold text-qou-primary border-l border-slate-200">
                              {(sess.rooms || []).length} قاعات
                            </td>

                            {/* Formatted Rooms List */}
                            <td className="py-2 px-4 border-l border-slate-200">
                              <div className="font-mono text-xs font-semibold text-slate-800 leading-relaxed">
                                {roomNumbers || '-'}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>

                  {/* Summary Totals Row */}
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan="3" className="py-3 px-4 text-left border-l border-slate-200">
                        الإجمالي الكلي لشواغر القاعات:
                      </td>
                      <td className="py-3 px-3 text-center text-qou-primary text-sm font-black border-l border-slate-200">
                        {totalRoomSlots} شاغر
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-normal">
                        موزعة عبر {scheduleDays.length} يوماً امتحانياً
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>



            </div>
          )}

          {/* ========================================================
              VIEW 2: INTERACTIVE CARDS
             ======================================================== */}
          {viewMode === 'cards' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-500">اختر اليوم لاستعراض جلساته وقاعاته:</span>
                <span className="text-xs text-qou-primary font-bold">إجمالي: {scheduleDays.length} يوماً</span>
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
                      className={`p-3 rounded-2xl border text-right transition-all flex-shrink-0 min-w-[130px] ${
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
                <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in duration-200">
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

                  {/* Sessions Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(currentDay.sessions || []).map((sess) => (
                      <div key={sess.sessionNumber} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                          <span className="font-black text-xs text-qou-primary bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
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
          )}

        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-3 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Building className="w-7 h-7" />
          </div>
          <h3 className="font-black text-slate-800 text-base">لا توجد قاعات محملة في هذا المشروع حالياً</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            القاعات فارغة ومهيأة للفحص. يرجى سحب وإفلات ملف الإكسل في الصندوق أعلاه لتحميل القاعات والجلسات واستعراض تقرير التدقيق.
          </p>
        </div>
      )}

    </div>
  );
}
