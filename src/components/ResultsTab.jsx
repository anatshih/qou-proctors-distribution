import React, { useState, useMemo } from 'react';
import { 
  Printer, FileSpreadsheet, Filter, RotateCcw, User, Calendar, 
  Building, CheckCircle2, AlertCircle, Search, Eye
} from 'lucide-react';
import { exportDistributedScheduleExcel, exportProctorsMatrixExcel } from '../utils/excelHandler';

export default function ResultsTab({
  scheduleDays,
  proctors,
  distributionResult,
  semesterCode,
  examType
}) {
  // View mode: 'schedule' (table by room & session) or 'matrix' (proctor quota fulfillment)
  const [viewMode, setViewMode] = useState('schedule');

  // Filters
  const [selectedProctor, setSelectedProctor] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'assigned' | 'unassigned'

  // Flattened rooms list for filtering
  const allSlots = useMemo(() => {
    const list = [];
    (scheduleDays || []).forEach(day => {
      (day.sessions || []).forEach(session => {
        (session.rooms || []).forEach(room => {
          list.push({
            date: day.date,
            dayName: day.dayName,
            sessionNumber: session.sessionNumber,
            room: room.room,
            proctor: room.proctor || '',
            isAssigned: Boolean(room.proctor && room.proctor.trim() !== '')
          });
        });
      });
    });
    return list;
  }, [scheduleDays]);

  // Unique lists for dropdowns
  const uniqueDays = useMemo(() => {
    const set = new Set();
    scheduleDays.forEach(d => set.add(`${d.dayName} (${d.date})`));
    return Array.from(set);
  }, [scheduleDays]);

  const uniqueProctors = useMemo(() => {
    const set = new Set();
    allSlots.forEach(s => { if (s.proctor) set.add(s.proctor); });
    return Array.from(set).sort();
  }, [allSlots]);

  // Apply filters
  const filteredSlots = useMemo(() => {
    return allSlots.filter(item => {
      if (selectedProctor && item.proctor !== selectedProctor) return false;
      if (selectedDay && `${item.dayName} (${item.date})` !== selectedDay) return false;
      if (selectedSession && String(item.sessionNumber) !== selectedSession) return false;
      if (selectedRoom && !String(item.room).toLowerCase().includes(selectedRoom.toLowerCase())) return false;
      if (statusFilter === 'assigned' && !item.isAssigned) return false;
      if (statusFilter === 'unassigned' && item.isAssigned) return false;
      return true;
    });
  }, [allSlots, selectedProctor, selectedDay, selectedSession, selectedRoom, statusFilter]);

  // Statistics for filtered set
  const filteredStats = useMemo(() => {
    const total = filteredSlots.length;
    const assigned = filteredSlots.filter(s => s.isAssigned).length;
    return { total, assigned, unassigned: total - assigned };
  }, [filteredSlots]);

  const handleResetFilters = () => {
    setSelectedProctor('');
    setSelectedDay('');
    setSelectedSession('');
    setSelectedRoom('');
    setStatusFilter('all');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportSchedule = () => {
    exportDistributedScheduleExcel(scheduleDays, semesterCode, examType);
  };

  const handleExportMatrix = () => {
    const stats = distributionResult?.proctorStats || proctors.map(p => ({
      ...p,
      assignedCount: allSlots.filter(s => s.proctor === p.name).length,
      difference: allSlots.filter(s => s.proctor === p.name).length - (Number(p.quota) || 0)
    }));
    exportProctorsMatrixExcel(stats, scheduleDays, semesterCode, examType);
  };

  return (
    <div className="space-y-6">

      {/* Screen Controls Header (Hidden in Print) */}
      <div className="no-print space-y-4">
        
        {/* Top Actions & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base">كشوفات النتائج والطباعة المنسقة</h3>
            <p className="text-xs text-slate-500">قم بتطبيق أي فلتر تحتاجه ثم اطبع النتائج المحددة فوراً</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
              title="طباعة ما هو معروض على الشاشة وفق الفلاتر المحددة"
            >
              <Printer className="w-4 h-4" />
              <span>
                {selectedProctor 
                  ? `طباعة كشف المراقب (${selectedProctor.split(' ')[0]})` 
                  : 'طباعة الكشف المحدد'}
              </span>
            </button>

            {/* Export Schedule Excel */}
            <button
              type="button"
              onClick={handleExportSchedule}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير إكسل للقاعات</span>
            </button>

            {/* Export Matrix Excel */}
            <button
              type="button"
              onClick={handleExportMatrix}
              className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              <span>تصدير مصفوفة التفريغ</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setViewMode('schedule')}
                className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'schedule' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
              >
                جدول القاعات
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                className={`px-3 py-1.5 rounded-lg transition ${viewMode === 'matrix' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
              >
                متابعة أنصبة المراقبين
              </button>
            </div>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        {viewMode === 'schedule' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Filter className="w-4 h-4 text-qou-primary" />
                <span>أدوات الفلترة والتخصيص قبل الطباعة:</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition"
              >
                <RotateCcw className="w-3 h-3" />
                <span>إعادة ضبط الفلاتر</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
              
              {/* Filter by Proctor */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">المراقب:</label>
                <select
                  value={selectedProctor}
                  onChange={(e) => setSelectedProctor(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                >
                  <option value="">جميع المراقبين ({uniqueProctors.length})</option>
                  {uniqueProctors.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Day */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">اليوم والتاريخ:</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                >
                  <option value="">جميع الأيام ({uniqueDays.length})</option>
                  {uniqueDays.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Filter by Session */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الجلسة:</label>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                >
                  <option value="">جميع الجلسات</option>
                  <option value="1">جلسة 1</option>
                  <option value="2">جلسة 2</option>
                  <option value="3">جلسة 3</option>
                </select>
              </div>

              {/* Filter by Room */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم القاعة:</label>
                <input
                  type="text"
                  placeholder="رقم القاعة (مثلاً 301)"
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                />
              </div>

              {/* Filter by Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">حالة القاعة:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                >
                  <option value="all">الكل</option>
                  <option value="assigned">المسندة بمراقب فقط</option>
                  <option value="unassigned">الشاغرة فقط</option>
                </select>
              </div>

            </div>

            {/* Filter stats pill */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-3">
                <span>النتائج المطابقة للفلاتر: <strong className="text-slate-800 font-bold">{filteredStats.total}</strong> قاعة</span>
                <span>• مسند: <strong className="text-emerald-700 font-bold">{filteredStats.assigned}</strong></span>
                {filteredStats.unassigned > 0 && (
                  <span>• شاغر: <strong className="text-amber-700 font-bold">{filteredStats.unassigned}</strong></span>
                )}
              </div>
              {selectedProctor && (
                <div className="bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold text-[11px] border border-emerald-200">
                  كشف مراقبة مخصص للمراقب: {selectedProctor}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ========================================================
          PRINT-READY OFFICIAL DOCUMENT TEMPLATE
          (This part renders on screen and in print)
         ======================================================== */}
      <div className="print-area bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">

        {/* Official University Print Header */}
        <div className="border-b-2 border-qou-primary pb-4 mb-4">
          <div className="flex items-center justify-between">
            {/* Right: University Info */}
            <div className="text-right">
              <h2 className="text-xl font-black text-slate-900 tracking-wide">
                جامعة القدس المفتوحة
              </h2>
              <h3 className="text-sm font-bold text-qou-primary">
                عمادة القبول والتسجيل والامتحانات
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                الفصل الدراسي: <strong className="text-slate-900 font-black">{semesterCode}</strong> | نوع الامتحان: <strong className="text-slate-900 font-black">{examType}</strong>
              </p>
            </div>

            {/* Center: Title / Proctors Badge */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-1 flex items-center justify-center">
                <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
              </div>
              <div className="text-sm font-black text-slate-900">
                {selectedProctor ? (
                  <span className="bg-slate-100 px-3 py-1 rounded-full border border-slate-300">
                    بطاقة مراقبة خاصة: {selectedProctor}
                  </span>
                ) : (
                  <span>كشف توزيع مراقبات الامتحانات</span>
                )}
              </div>
            </div>

            {/* Left: Metadata & Date */}
            <div className="text-left text-xs text-slate-500 space-y-1">
              <div>التاريخ: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
              <div>إجمالي القاعات: <strong>{filteredStats.total}</strong></div>
              {selectedDay && <div className="text-qou-primary font-bold">{selectedDay}</div>}
            </div>
          </div>
        </div>

        {/* VIEW MODE 1: Schedule Table */}
        {viewMode === 'schedule' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black border-y-2 border-slate-300">
                  <th className="py-2.5 px-3 w-12 text-center border-l border-slate-200">#</th>
                  <th className="py-2.5 px-3 border-l border-slate-200">اليوم والتاريخ</th>
                  <th className="py-2.5 px-3 w-24 text-center border-l border-slate-200">رقم الجلسة</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">القاعة</th>
                  <th className="py-2.5 px-4 border-l border-slate-200">اسم المراقب المسند</th>
                  <th className="py-2.5 px-3 w-32 text-center print-only-col">توقيع المراقب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSlots.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400 font-bold">
                      لا توجد بيانات مطابقة لخيارات الفلترة الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredSlots.map((item, idx) => (
                    <tr 
                      key={idx}
                      className={`hover:bg-slate-50 transition-colors ${
                        !item.isAssigned ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-2 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800 border-l border-slate-200">
                        {item.dayName} <span className="text-[11px] font-mono text-slate-500">({item.date})</span>
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">
                        <span className="bg-slate-100 font-extrabold text-slate-700 px-2.5 py-0.5 rounded border border-slate-200">
                          جلسة {item.sessionNumber}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-800 border-l border-slate-200">
                        قاعة {item.room}
                      </td>
                      <td className="py-2 px-4 border-l border-slate-200">
                        {item.isAssigned ? (
                          <span className="font-extrabold text-slate-900">{item.proctor}</span>
                        ) : (
                          <span className="text-amber-700 font-bold bg-amber-100/70 px-2 py-0.5 rounded text-[11px]">
                            شاغر / لم يُحدد
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200 print-only-col text-slate-300">
                        ____________
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW MODE 2: Matrix & Quota Fulfillment */}
        {viewMode === 'matrix' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-black border-y-2 border-slate-300">
                  <th className="py-2.5 px-3 w-12 text-center border-l border-slate-200">#</th>
                  <th className="py-2.5 px-4 border-l border-slate-200">اسم المراقب</th>
                  <th className="py-2.5 px-3 w-24 text-center border-l border-slate-200">الحالة</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">النصاب المطلوب</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">المنفذ فعلياً</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">الفرق والتطابق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(distributionResult?.proctorStats || proctors.map(p => ({
                  ...p,
                  assignedCount: allSlots.filter(s => s.proctor === p.name).length,
                  difference: allSlots.filter(s => s.proctor === p.name).length - (Number(p.quota) || 0)
                }))).map((p, idx) => {
                  const quota = Number(p.quota) || 0;
                  const assigned = p.assignedCount || 0;
                  const isComplete = assigned === quota && quota > 0;
                  const isUnder = assigned < quota;

                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-4 font-bold text-slate-800 border-l border-slate-200">
                        {p.name}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {p.isActive ? 'نشط' : 'مجمّد'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-slate-700 border-l border-slate-200">
                        {quota}
                      </td>
                      <td className="py-2 px-3 text-center font-black text-qou-primary border-l border-slate-200">
                        {assigned}
                      </td>
                      <td className="py-2 px-3 text-center border-l border-slate-200 font-bold">
                        {quota === 0 ? (
                          <span className="text-slate-400 font-normal">احتياط</span>
                        ) : isComplete ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            مستوفى 100%
                          </span>
                        ) : isUnder ? (
                          <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                            نقص {quota - assigned}
                          </span>
                        ) : (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                            زيادة {assigned - quota}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}



      </div>

    </div>
  );
}
