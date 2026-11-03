import React, { useState, useMemo } from 'react';
import { 
  Upload, FileSpreadsheet, RotateCcw, CheckCircle, AlertCircle, 
  Calendar, Building, Trash2, Printer, Eye, FileText, Check, Users,
  SlidersHorizontal, Search, Sparkles, Layers, ArrowLeft
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
  examType,
  onNavigateNext
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);

  // View mode: 'capacities' (unified room capacity settings) | 'report' (printable audit review table) | 'cards' (interactive)
  const [viewMode, setViewMode] = useState('capacities');

  // Search & filter for unique rooms view
  const [roomSearchTerm, setRoomSearchTerm] = useState('');
  const [roomFilterCategory, setRoomFilterCategory] = useState('all'); // 'all' | 'single' | 'multi'
  const [capacityToast, setCapacityToast] = useState('');

  // Recalculate total slots considering multi-proctor capacities
  const calcTotalSlots = (days) => {
    return days.reduce((acc, d) => 
      acc + (d.sessions || []).reduce((sAcc, s) => 
        sAcc + (s.rooms || []).reduce((rAcc, r) => rAcc + Math.max(1, Number(r.capacity) || 1), 0), 0), 0);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const result = await parseUploadedSchedule(file);
      const computedTotal = calcTotalSlots(result.days);
      setScheduleDays(result.days);
      setTotalRoomSlots(computedTotal);
      setUploadedFileName(result.fileName);
      setSuccessMsg(`تم بنجاح رفع وقراءة جدول القاعات: تم التعرف على ${result.days.length} يوماً و ${computedTotal} شاغر مراقبة.`);
      setSelectedDayIdx(0);
      setViewMode('capacities'); // Automatically direct user to room capacity settings!
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

  // -------------------------------------------------------------
  // Centralized Global Room Capacity Handler
  // (Changes the capacity of a unique room across all sessions and days!)
  // -------------------------------------------------------------
  const handleSetRoomCapacityGlobally = (roomName, newCapacity) => {
    setScheduleDays(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.forEach(day => {
        (day.sessions || []).forEach(sess => {
          (sess.rooms || []).forEach(r => {
            if (String(r.room || '').trim() === roomName) {
              r.capacity = newCapacity;
              if (Array.isArray(r.assignedProctors) && r.assignedProctors.length > newCapacity) {
                r.assignedProctors = r.assignedProctors.slice(0, newCapacity);
                r.proctor = r.assignedProctors.filter(Boolean).join(' / ');
              }
            }
          });
        });
      });

      const newTotal = calcTotalSlots(copy);
      setTotalRoomSlots(newTotal);
      return copy;
    });

    const label = newCapacity === 1 ? 'مراقب واحد (1)' : newCapacity === 2 ? 'مراقبَين (2)' : '3 مراقبين (3)';
    setCapacityToast(`✓ تم بنجاح ضبط سعة قاعة (${roomName}) إلى [${label}] في كافة جلسات وأيام الامتحان.`);
    setTimeout(() => setCapacityToast(''), 3500);
  };

  // Extract unique rooms list across the entire exam period
  const uniqueRoomsList = useMemo(() => {
    if (!scheduleDays || scheduleDays.length === 0) return [];
    const map = new Map();

    scheduleDays.forEach(day => {
      (day.sessions || []).forEach(sess => {
        (sess.rooms || []).forEach(r => {
          const roomName = String(r.room || '').trim();
          if (!roomName) return;
          const cap = Math.max(1, Number(r.capacity) || 1);

          if (!map.has(roomName)) {
            map.set(roomName, {
              roomName,
              appearances: 1,
              capacity: cap
            });
          } else {
            const item = map.get(roomName);
            item.appearances += 1;
            item.capacity = Math.max(item.capacity, cap);
          }
        });
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.capacity !== a.capacity) return b.capacity - a.capacity;
      return a.roomName.localeCompare(b.roomName, 'ar', { numeric: true });
    });
  }, [scheduleDays]);

  // Filtered unique rooms
  const filteredUniqueRooms = useMemo(() => {
    return uniqueRoomsList.filter(item => {
      if (roomSearchTerm && !item.roomName.toLowerCase().includes(roomSearchTerm.toLowerCase())) {
        return false;
      }
      if (roomFilterCategory === 'single' && item.capacity !== 1) return false;
      if (roomFilterCategory === 'multi' && item.capacity <= 1) return false;
      return true;
    });
  }, [uniqueRoomsList, roomSearchTerm, roomFilterCategory]);

  // Capacity stats
  const capacityStats = useMemo(() => {
    const totalRooms = uniqueRoomsList.length;
    const singleRooms = uniqueRoomsList.filter(r => r.capacity === 1).length;
    const multiRooms = totalRooms - singleRooms;
    return { totalRooms, singleRooms, multiRooms };
  }, [uniqueRoomsList]);

  const handlePrintReview = () => {
    window.print();
  };

  const hasSchedule = scheduleDays && scheduleDays.length > 0;
  const currentDay = hasSchedule ? scheduleDays[selectedDayIdx] : null;

  return (
    <div className="space-y-6">

      {/* Realtime Toast for capacity changes */}
      {capacityToast && (
        <div className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-600 animate-in fade-in slide-in-from-top-4">
          <CheckCircle className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{capacityToast}</span>
        </div>
      )}

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
              <span>الملف الحالي: <strong>{uploadedFileName}</strong></span>
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
                  القاعات الفريدة:
                </span>
                <span className="font-bold text-slate-800">
                  {hasSchedule ? `${uniqueRoomsList.length} قاعة مميزة` : '0'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs text-slate-600 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  إجمالي شواغر المراقبة:
                </span>
                <span className="font-black text-qou-primary text-base">
                  {hasSchedule ? `${totalRoomSlots} شاغر` : '0 شاغر'}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
            {hasSchedule ? (
              <button
                type="button"
                onClick={handleClearSchedule}
                className="w-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl py-2.5 transition flex items-center justify-center gap-2 cursor-pointer"
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
        <div className="no-print p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('capacities')}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>ضبط سعات القاعات (1 أو 2 أو 3)</span>
          </button>
        </div>
      )}

      {/* Main Schedule Content (Only shown if schedule is loaded) */}
      {hasSchedule ? (
        <div className="space-y-4">
          
          {/* Controls Bar & View Mode Toggle */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-qou-primary" />
              <span className="font-extrabold text-sm text-slate-800">إدارة القاعات والمراقبات:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                
                {/* Mode 1: Centralized Capacities (The Star Feature!) */}
                <button
                  type="button"
                  onClick={() => setViewMode('capacities')}
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'capacities' 
                      ? 'bg-qou-primary text-white shadow-sm font-black' 
                      : 'hover:text-slate-900'
                  }`}
                  title="مكان موحد لتحديد عدد المراقبين لكل قاعة في جميع فترات الامتحان"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>ضبط سعات القاعات (1 / 2 / 3 مراقبين)</span>
                  {capacityStats.multiRooms > 0 && (
                    <span className="bg-amber-400 text-slate-950 text-[10px] px-1.5 py-0.2 rounded-full font-black">
                      {capacityStats.multiRooms}
                    </span>
                  )}
                </button>

                {/* Mode 2: Audit Review Report */}
                <button
                  type="button"
                  onClick={() => setViewMode('report')}
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'report' ? 'bg-white text-slate-900 shadow-sm font-black' : 'hover:text-slate-900'
                  }`}
                  title="كشف مراجعة وتدقيق القاعات والجلسات يوماً بيوم"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>كشف المراجعة والتدقيق</span>
                </button>

                {/* Mode 3: Interactive Cards */}
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-slate-900 shadow-sm font-black' : 'hover:text-slate-900'
                  }`}
                  title="استعراض القاعات يوم بيوم وبطاقات الجلسات"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>استعراض البطاقات</span>
                </button>
              </div>

              {/* Print Review Report Button (Active for report view) */}
              {viewMode === 'report' && (
                <button
                  type="button"
                  onClick={handlePrintReview}
                  className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="طباعة كشف مراجعة وتدقيق القاعات والجلسات"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة تقرير التدقيق</span>
                </button>
              )}
            </div>
          </div>

          {/* ========================================================
              VIEW 1: CENTRALIZED ROOM CAPACITIES SETTINGS (1, 2, 3 PROCTORS)
             ======================================================== */}
          {viewMode === 'capacities' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              
              {/* Informative Guidance Banner */}
              <div className="bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-700 space-y-1">
                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <span>التحكم الموحد في سعات القاعات (لكافة أيام وفترات الامتحان)</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      بدون تشتيت
                    </span>
                  </h4>
                  <p className="leading-relaxed">
                    جميع القاعات تم ضبطها تلقائياً على <strong>(مراقب واحد 1)</strong>. فقط حدد المدرجات والمختبرات الكبيرة إلى <strong>(2 مراقبين)</strong> أو <strong>(3 مراقبين)</strong>، وسيتم تطبيق ذلك تلقائياً على <strong>جميع جلسات تلك القاعة عبر كل أيام الامتحان</strong> بضغطة زر واحدة!
                  </p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="ابحث عن قاعة أو مدرج أو مختبر..."
                    value={roomSearchTerm}
                    onChange={(e) => setRoomSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setRoomFilterCategory('all')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        roomFilterCategory === 'all' ? 'bg-white text-slate-900 shadow-sm' : ''
                      }`}
                    >
                      الكل ({uniqueRoomsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomFilterCategory('single')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        roomFilterCategory === 'single' ? 'bg-white text-slate-900 shadow-sm' : ''
                      }`}
                    >
                      مراقب واحد ({capacityStats.singleRooms})
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoomFilterCategory('multi')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        roomFilterCategory === 'multi' ? 'bg-white text-slate-900 shadow-sm' : ''
                      }`}
                    >
                      2 أو 3 مراقبين ({capacityStats.multiRooms})
                    </button>
                  </div>
                </div>
              </div>

              {/* Unique Rooms Capacity Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full min-w-[960px] text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-300 text-xs">
                      <th className="py-3 px-3 w-12 text-center border-l border-slate-200">#</th>
                      <th className="py-3 px-4 min-w-[190px] border-l border-slate-200">اسم القاعة / المختبر / المدرج</th>
                      <th className="py-3 px-4 w-44 text-center border-l border-slate-200 whitespace-nowrap">مرات الاستخدام في الجدول</th>
                      <th className="py-3 px-4 w-52 text-center border-l border-slate-200 whitespace-nowrap">التصنيف الحالي للسعة</th>
                      <th className="py-3 px-6 w-72 text-center whitespace-nowrap">تحديد عدد المراقبين المطلوب لكل جلسة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredUniqueRooms.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 font-bold">
                          لا توجد قاعات مطابقة لبحثك.
                        </td>
                      </tr>
                    ) : (
                      filteredUniqueRooms.map((r, idx) => {
                        const cap = r.capacity;

                        return (
                          <tr 
                            key={r.roomName} 
                            className={`hover:bg-slate-50/80 transition-colors ${
                              cap > 1 ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                              {idx + 1}
                            </td>

                            <td className="py-3 px-4 font-black text-slate-900 border-l border-slate-200">
                              <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                                  cap === 1 ? 'bg-slate-100 text-slate-700' :
                                  cap === 2 ? 'bg-amber-100 text-amber-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  <Building className="w-4 h-4" />
                                </div>
                                <span className="text-sm font-black">قاعة {r.roomName}</span>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-center border-l border-slate-200 font-bold text-slate-600 whitespace-nowrap">
                              <span className="bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-mono text-xs">
                                مستخدمة في <strong>{r.appearances}</strong> جلسة
                              </span>
                            </td>

                            <td className="py-3 px-4 text-center border-l border-slate-200 whitespace-nowrap">
                              {cap === 1 && (
                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs px-3 py-1 rounded-full font-bold whitespace-nowrap border border-slate-200">
                                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                  <span>1 مراقب (قاعة عادية)</span>
                                </span>
                              )}
                              {cap === 2 && (
                                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border border-amber-300 text-xs px-3 py-1 rounded-full font-black whitespace-nowrap shadow-xs">
                                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                                  <span>2 مراقبين (مدرج/مختبر)</span>
                                </span>
                              )}
                              {cap === 3 && (
                                <span className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 border border-blue-300 text-xs px-3 py-1 rounded-full font-black whitespace-nowrap shadow-xs">
                                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                  <span>3 مراقبين (مدرج كبير)</span>
                                </span>
                              )}
                            </td>

                            {/* Capacity Action Buttons: 1, 2, or 3 */}
                            <td className="py-3 px-6 text-center">
                              <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
                                
                                {/* 1 Proctor */}
                                <button
                                  type="button"
                                  onClick={() => handleSetRoomCapacityGlobally(r.roomName, 1)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    cap === 1
                                      ? 'bg-white text-slate-900 shadow-sm font-black border border-slate-200'
                                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                  }`}
                                  title="تحديد مراقب واحد لهذه القاعة في جميع الجلسات"
                                >
                                  {cap === 1 && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                                  <span>1 مراقب</span>
                                </button>

                                {/* 2 Proctors */}
                                <button
                                  type="button"
                                  onClick={() => handleSetRoomCapacityGlobally(r.roomName, 2)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    cap === 2
                                      ? 'bg-amber-500 text-white shadow-sm font-black'
                                      : 'text-slate-600 hover:text-amber-800 hover:bg-amber-100/50'
                                  }`}
                                  title="تحديد 2 مراقبين لهذه القاعة في جميع الجلسات"
                                >
                                  {cap === 2 && <Check className="w-3.5 h-3.5 text-white" />}
                                  <span>2 مراقبين</span>
                                </button>

                                {/* 3 Proctors */}
                                <button
                                  type="button"
                                  onClick={() => handleSetRoomCapacityGlobally(r.roomName, 3)}
                                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                    cap === 3
                                      ? 'bg-blue-600 text-white shadow-sm font-black'
                                      : 'text-slate-600 hover:text-blue-800 hover:bg-blue-100/50'
                                  }`}
                                  title="تحديد 3 مراقبين للمدرجات الكبيرة في جميع الجلسات"
                                >
                                  {cap === 3 && <Check className="w-3.5 h-3.5 text-white" />}
                                  <span>3 مراقبين</span>
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ========================================================
              VIEW 2: FORMAL AUDIT & REVIEW REPORT (PRINTABLE)
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
                    <div>إجمالي الشواغر: <strong>{totalRoomSlots} شاغر مراقبة</strong></div>
                  </div>
                </div>
              </div>

              {/* Printable Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-black border-y-2 border-slate-300">
                      <th className="py-2.5 px-3 w-12 text-center border-l border-slate-200">#</th>
                      <th className="py-2.5 px-3 border-l border-slate-200">اليوم والتاريخ</th>
                      <th className="py-2.5 px-3 w-24 text-center border-l border-slate-200">الجلسة</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">المراقبين المطلوبين</th>
                      <th className="py-2.5 px-4 border-l border-slate-200">أرقام القاعات وسعاتها المعتمدة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {scheduleDays.map((day, dIdx) => {
                      const sessions = day.sessions || [];

                      return sessions.map((sess, sIdx) => {
                        const sessRequiredProctors = (sess.rooms || []).reduce(
                          (acc, r) => acc + Math.max(1, Number(r.capacity) || 1), 0
                        );

                        return (
                          <tr key={`${dIdx}_${sIdx}`} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                              {dIdx + 1}.{sIdx + 1}
                            </td>

                            <td className="py-2 px-3 font-bold text-slate-800 border-l border-slate-200">
                              <div className="text-slate-900 font-extrabold">{day.dayName}</div>
                              <div className="text-[11px] font-mono text-slate-600 font-semibold">{day.date}</div>
                            </td>

                            <td className="py-2 px-3 text-center border-l border-slate-200">
                              <span className="font-black bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded border border-slate-200">
                                جلسة {sess.sessionNumber}
                              </span>
                            </td>

                            <td className="py-2 px-3 text-center font-bold text-qou-primary border-l border-slate-200">
                              {sessRequiredProctors} مراقب
                              <span className="text-[10px] text-slate-400 block font-normal">
                                ({(sess.rooms || []).length} قاعات)
                              </span>
                            </td>

                            <td className="py-2 px-4 border-l border-slate-200">
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {(sess.rooms || []).map((r, rIdx) => {
                                  const cap = Math.max(1, Number(r.capacity) || 1);
                                  const isMulti = cap > 1;

                                  return (
                                    <span
                                      key={rIdx}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold border ${
                                        cap === 2
                                          ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                                          : cap === 3
                                          ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-xs'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                    >
                                      <span>قاعة {r.room}</span>
                                      {cap === 2 && (
                                        <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-sans font-bold">
                                          2 مراقبين
                                        </span>
                                      )}
                                      {cap === 3 && (
                                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-sans font-bold">
                                          3 مراقبين
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
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
                        الإجمالي الكلي لشواغر المراقبة المطلوبة:
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
              VIEW 3: INTERACTIVE CARDS
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
                      className={`p-3 rounded-2xl border text-right transition-all flex-shrink-0 min-w-[130px] cursor-pointer ${
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
                          {(sess.rooms || []).map((r, rIdx) => {
                            const cap = Math.max(1, Number(r.capacity) || 1);

                            return (
                              <span
                                key={rIdx}
                                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                                  cap === 2
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
                                    : cap === 3
                                    ? 'bg-blue-100 text-blue-900 border-blue-300 shadow-xs'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <span>قاعة {r.room}</span>
                                {cap === 2 && (
                                  <span className="bg-amber-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                    2 مراقبين
                                  </span>
                                )}
                                {cap === 3 && (
                                  <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                    3 مراقبين
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Next Step Guidance Action Card */}
              <div className="no-print bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 mt-6 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">
                      اكتملت الخطوة 1
                    </span>
                    <h4 className="text-sm font-black text-slate-900">
                      تم اعتماد {totalRoomSlots} شاغر مراقبة عبر {scheduleDays.length} يوماً امتحانياً
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    الخطوة التالية هي تحديد أنصبة واستثناءات كادر المراقبين لتغطية الشواغر المطلوبة بدقة (المطلوب: {totalRoomSlots} مراقبة).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateNext?.('proctors')}
                  className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3.5 rounded-2xl shadow-md shadow-qou-primary/20 transition flex items-center gap-2 cursor-pointer"
                >
                  <span>الانتقال للخطوة 2: تحديد أنصبة واستثناءات المراقبين</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* Bottom Guidance Card visible across all schedule views */}
          {viewMode !== 'cards' && (
            <div className="no-print bg-white border border-slate-200 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="text-xs text-slate-600">
                <strong className="text-slate-800 font-bold">جاهز للمتابعة؟</strong> بمجرد الاطمئنان لسعات القاعات وشواغرها، انتقل لضبط أنصبة واستثناءات المراقبين.
              </div>
              <button
                type="button"
                onClick={() => onNavigateNext?.('proctors')}
                className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>الخطوة التالية: كادر المراقبين والأنصبة ({totalRoomSlots} شاغر)</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
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
            القاعات فارغة ومهيأة للفحص. يرجى سحب وإفلات ملف الإكسل في الصندوق أعلاه لتحميل القاعات والجلسات وضبط سعات المدرجات بضغطة زر واحدة.
          </p>
        </div>
      )}

    </div>
  );
}