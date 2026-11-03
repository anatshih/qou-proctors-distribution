import React, { useState, useMemo } from 'react';
import { 
  Printer, FileSpreadsheet, Filter, RotateCcw, User, Calendar, 
  Building, CheckCircle2, AlertCircle, Search, Eye, ArrowLeftRight,
  Users, Check, Plus, AlertTriangle
} from 'lucide-react';
import { exportDistributedScheduleExcel, exportProctorsMatrixExcel } from '../utils/excelHandler';
import QuickSwapModal from './QuickSwapModal';

export default function ResultsTab({
  scheduleDays = [],
  setScheduleDays,
  proctors = [],
  distributionResult,
  semesterCode = '1261',
  examType = 'نصفي'
}) {
  // View mode: 'schedule' (table by room & session) or 'matrix' (proctor quota fulfillment)
  const [viewMode, setViewMode] = useState('schedule');

  // Filters
  const [selectedProctor, setSelectedProctor] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'assigned' | 'unassigned'

  // Quick Swap Modal state
  const [activeSwapSlot, setActiveSwapSlot] = useState(null);

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper to get array of proctors from a room object
  const getRoomProctorList = (roomObj) => {
    if (Array.isArray(roomObj.assignedProctors) && roomObj.assignedProctors.length > 0) {
      return [...roomObj.assignedProctors];
    }
    if (roomObj.proctor && roomObj.proctor.trim()) {
      return roomObj.proctor.split('/').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  // Helper to get capacity of a room
  const getRoomCapacity = (roomObj) => {
    const list = getRoomProctorList(roomObj);
    return Math.max(1, Number(roomObj.capacity) || list.length || 1);
  };

  // Flattened rooms list for filtering & display
  const allRooms = useMemo(() => {
    const list = [];
    (scheduleDays || []).forEach((day, dayIndex) => {
      (day.sessions || []).forEach(session => {
        (session.rooms || []).forEach((room, roomIndex) => {
          const proctorList = getRoomProctorList(room);
          const capacity = getRoomCapacity(room);
          const isFullyAssigned = proctorList.length >= capacity && proctorList.every(p => Boolean(p && p.trim()));
          const hasAnyAssigned = proctorList.some(p => Boolean(p && p.trim()));

          list.push({
            dayIndex,
            date: day.date,
            dayName: day.dayName,
            sessionNumber: session.sessionNumber,
            roomIndex,
            room: room.room,
            capacity,
            proctors: proctorList,
            proctorString: room.proctor || proctorList.join(' / '),
            isFullyAssigned,
            hasAnyAssigned,
            rawRoom: room
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
    allRooms.forEach(item => {
      item.proctors.forEach(name => {
        if (name && name.trim()) set.add(name);
      });
    });
    return Array.from(set).sort();
  }, [allRooms]);

  // Dynamic live count of assignments per proctor
  const liveProctorCounts = useMemo(() => {
    const counts = {};
    allRooms.forEach(item => {
      item.proctors.forEach(name => {
        if (name && name.trim()) {
          counts[name] = (counts[name] || 0) + 1;
        }
      });
    });
    return counts;
  }, [allRooms]);

  // Live dynamic stats for matrix
  const liveProctorStats = useMemo(() => {
    return proctors.map(p => {
      const assignedCount = liveProctorCounts[p.name] || 0;
      const quota = Number(p.quota) || 0;
      const difference = assignedCount - quota;
      return {
        ...p,
        assignedCount,
        difference
      };
    });
  }, [proctors, liveProctorCounts]);

  // Apply filters to rooms
  const filteredRooms = useMemo(() => {
    return allRooms.filter(item => {
      if (selectedProctor && !item.proctors.includes(selectedProctor)) return false;
      if (selectedDay && `${item.dayName} (${item.date})` !== selectedDay) return false;
      if (selectedSession && String(item.sessionNumber) !== selectedSession) return false;
      if (selectedRoom && !String(item.room).toLowerCase().includes(selectedRoom.toLowerCase())) return false;
      if (statusFilter === 'assigned' && !item.hasAnyAssigned) return false;
      if (statusFilter === 'unassigned' && item.isFullyAssigned) return false;
      return true;
    });
  }, [allRooms, selectedProctor, selectedDay, selectedSession, selectedRoom, statusFilter]);

  // Statistics for filtered set
  const filteredStats = useMemo(() => {
    const totalRooms = filteredRooms.length;
    let totalSlots = 0;
    let filledSlots = 0;

    filteredRooms.forEach(r => {
      totalSlots += r.capacity;
      filledSlots += r.proctors.filter(p => Boolean(p && p.trim())).length;
    });

    return { 
      totalRooms, 
      totalSlots, 
      filledSlots, 
      unassignedSlots: totalSlots - filledSlots 
    };
  }, [filteredRooms]);

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
    exportProctorsMatrixExcel(liveProctorStats, scheduleDays, semesterCode, examType);
  };

  // -------------------------------------------------------------
  // Quick Swap & Manual Reassignment Handlers
  // -------------------------------------------------------------
  const handleOpenSwapModal = (roomItem, slotIndex) => {
    const currentProctorName = roomItem.proctors[slotIndex] || '';
    setActiveSwapSlot({
      dayIndex: roomItem.dayIndex,
      date: roomItem.date,
      dayName: roomItem.dayName,
      sessionNumber: roomItem.sessionNumber,
      roomIndex: roomItem.roomIndex,
      roomName: roomItem.room,
      capacity: roomItem.capacity,
      slotIndex: slotIndex,
      currentProctor: currentProctorName
    });
  };

  const handleApplyReassign = (dayIndex, sessionNumber, roomIndex, slotIndex, newProctorName) => {
    if (!setScheduleDays) return;

    setScheduleDays(prevDays => {
      const copy = JSON.parse(JSON.stringify(prevDays));
      const day = copy[dayIndex];
      if (!day) return prevDays;
      const session = (day.sessions || []).find(s => s.sessionNumber === sessionNumber);
      if (!session || !session.rooms[roomIndex]) return prevDays;

      const targetRoom = session.rooms[roomIndex];
      const cap = Math.max(1, Number(targetRoom.capacity) || 1);
      
      // Ensure assignedProctors array
      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor ? targetRoom.proctor.split('/').map(s => s.trim()) : [];
      }
      while (targetRoom.assignedProctors.length < cap) {
        targetRoom.assignedProctors.push('');
      }

      targetRoom.assignedProctors[slotIndex] = newProctorName;
      targetRoom.proctor = targetRoom.assignedProctors.filter(Boolean).join(' / ');

      return copy;
    });

    showToast(`✓ تم بنجاح تعيين (${newProctorName}) في قاعة ${activeSwapSlot?.roomName} الجلسة ${sessionNumber}`);
  };

  const handleApplySwap = (dayIndex, sessionNumber, sourceRoomIdx, sourceSlotIdx, targetRoomIdx, targetSlotIdx) => {
    if (!setScheduleDays) return;

    let sourceName = '';
    let targetName = '';
    let sourceRoomName = '';
    let targetRoomName = '';

    setScheduleDays(prevDays => {
      const copy = JSON.parse(JSON.stringify(prevDays));
      const day = copy[dayIndex];
      if (!day) return prevDays;
      const session = (day.sessions || []).find(s => s.sessionNumber === sessionNumber);
      if (!session) return prevDays;

      const sourceRoom = session.rooms[sourceRoomIdx];
      const targetRoom = session.rooms[targetRoomIdx];
      if (!sourceRoom || !targetRoom) return prevDays;

      sourceRoomName = sourceRoom.room;
      targetRoomName = targetRoom.room;

      const sourceCap = Math.max(1, Number(sourceRoom.capacity) || 1);
      const targetCap = Math.max(1, Number(targetRoom.capacity) || 1);

      if (!Array.isArray(sourceRoom.assignedProctors)) {
        sourceRoom.assignedProctors = sourceRoom.proctor ? sourceRoom.proctor.split('/').map(s => s.trim()) : [];
      }
      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor ? targetRoom.proctor.split('/').map(s => s.trim()) : [];
      }

      while (sourceRoom.assignedProctors.length < sourceCap) sourceRoom.assignedProctors.push('');
      while (targetRoom.assignedProctors.length < targetCap) targetRoom.assignedProctors.push('');

      sourceName = sourceRoom.assignedProctors[sourceSlotIdx] || '';
      targetName = targetRoom.assignedProctors[targetSlotIdx] || '';

      // Mutual Swap!
      sourceRoom.assignedProctors[sourceSlotIdx] = targetName;
      targetRoom.assignedProctors[targetSlotIdx] = sourceName;

      sourceRoom.proctor = sourceRoom.assignedProctors.filter(Boolean).join(' / ');
      targetRoom.proctor = targetRoom.assignedProctors.filter(Boolean).join(' / ');

      return copy;
    });

    showToast(`⇄ تم بنجاح التبديل الفوري بين قاعة ${sourceRoomName} (${sourceName || 'شاغر'}) وقاعة ${targetRoomName} (${targetName || 'شاغر'})`);
  };

  const handleApplyClear = (dayIndex, sessionNumber, roomIndex, slotIndex) => {
    if (!setScheduleDays) return;

    setScheduleDays(prevDays => {
      const copy = JSON.parse(JSON.stringify(prevDays));
      const day = copy[dayIndex];
      if (!day) return prevDays;
      const session = (day.sessions || []).find(s => s.sessionNumber === sessionNumber);
      if (!session || !session.rooms[roomIndex]) return prevDays;

      const targetRoom = session.rooms[roomIndex];
      if (Array.isArray(targetRoom.assignedProctors) && targetRoom.assignedProctors[slotIndex] !== undefined) {
        targetRoom.assignedProctors[slotIndex] = '';
      }
      targetRoom.proctor = (targetRoom.assignedProctors || []).filter(Boolean).join(' / ');
      return copy;
    });

    showToast(`✓ تم إلغاء التعيين وأصبحت القاعة شاغرة.`);
  };

  return (
    <div className="space-y-6">

      {/* Realtime Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-600 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screen Controls Header (Hidden in Print) */}
      <div className="no-print space-y-4">
        
        {/* Top Actions & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
              <span>كشوفات النتائج والتبديل المباشر</span>
              <span className="text-[11px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Quick Swap متاح
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              يمكنك النقر على زر التبديل ⇄ أمام أي قاعة لمبادلة أو استبدال المراقب فورياً مع التحديث التلقائي.
            </p>
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
                <span>أدوات الفلترة والتخصيص قبل الطباعة أو التبديل:</span>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
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
                  <option value="assigned">المسندة بمراقبين</option>
                  <option value="unassigned">التي تحوي شواغر</option>
                </select>
              </div>

            </div>

            {/* Filter stats pill */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
              <div className="flex items-center gap-3">
                <span>المطابق للفلاتر: <strong className="text-slate-800 font-bold">{filteredStats.totalRooms}</strong> قاعة</span>
                <span>• شواغر المراقبين: <strong className="text-slate-800 font-bold">{filteredStats.totalSlots}</strong> شاغر</span>
                <span>• مسند: <strong className="text-emerald-700 font-bold">{filteredStats.filledSlots}</strong></span>
                {filteredStats.unassignedSlots > 0 && (
                  <span>• شاغر: <strong className="text-amber-700 font-bold">{filteredStats.unassignedSlots}</strong></span>
                )}
              </div>
              {selectedProctor && (
                <div className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>كشف مراقبة مخصص للمراقب: <strong>{selectedProctor}</strong> ({liveProctorCounts[selectedProctor] || 0} مراقبة)</span>
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
                جامعة القدس المفتوحة — فرع الخليل
              </h2>
              <h3 className="text-sm font-bold text-qou-primary">
                قسم الامتحانات
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
              <div>إجمالي القاعات: <strong>{filteredStats.totalRooms}</strong></div>
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
                  <th className="py-2.5 px-3 w-32 text-center border-l border-slate-200">القاعة</th>
                  <th className="py-2.5 px-4 border-l border-slate-200">المراقبون المسندون (مع التبديل السريع)</th>
                  <th className="py-2.5 px-3 w-36 text-center print-only-col">توقيع المراقب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-8 text-center text-slate-400 font-bold">
                      لا توجد بيانات مطابقة لخيارات الفلترة الحالية.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((item, idx) => {
                    const capacity = item.capacity;
                    const proctorList = item.proctors;

                    return (
                      <tr 
                        key={idx}
                        className={`hover:bg-slate-50 transition-colors ${
                          !item.isFullyAssigned ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono border-l border-slate-200 align-middle">
                          {idx + 1}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-slate-800 border-l border-slate-200 align-middle">
                          {item.dayName} <span className="text-[11px] font-mono text-slate-500">({item.date})</span>
                        </td>

                        <td className="py-2.5 px-3 text-center border-l border-slate-200 align-middle">
                          <span className="bg-slate-100 font-extrabold text-slate-700 px-2.5 py-0.5 rounded border border-slate-200">
                            جلسة {item.sessionNumber}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center font-bold text-slate-800 border-l border-slate-200 align-middle">
                          <div className="font-extrabold text-slate-900 text-xs">
                            قاعة {item.room}
                          </div>
                          {capacity === 2 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold border border-amber-300 mt-1">
                              <Users className="w-3 h-3 text-amber-700" />
                              <span>مراقبَين (2)</span>
                            </span>
                          )}
                          {capacity === 3 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-full font-bold border border-blue-300 mt-1">
                              <Users className="w-3 h-3 text-blue-700" />
                              <span>3 مراقبين (3)</span>
                            </span>
                          )}
                        </td>

                        {/* Proctors Column with Quick Swap Buttons */}
                        <td className="py-2.5 px-4 border-l border-slate-200 align-middle">
                          <div className="space-y-1.5">
                            {Array.from({ length: capacity }).map((_, slotIdx) => {
                              const pName = proctorList[slotIdx] || '';
                              const isAssigned = Boolean(pName && pName.trim());
                              const isHighlightedProctor = selectedProctor && pName === selectedProctor;

                              return (
                                <div 
                                  key={slotIdx}
                                  className={`flex items-center justify-between gap-2 p-1.5 rounded-xl border ${
                                    isHighlightedProctor 
                                      ? 'bg-emerald-100/80 border-emerald-300 font-black' 
                                      : isAssigned 
                                      ? 'bg-slate-50/80 border-slate-200' 
                                      : 'bg-amber-50 border-amber-200 border-dashed'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    {capacity > 1 && (
                                      <span className="text-[10px] bg-white border border-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                                        مراقب {slotIdx + 1}:
                                      </span>
                                    )}

                                    {isAssigned ? (
                                      <span className="font-extrabold text-slate-900 text-xs truncate">
                                        {pName}
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-bold text-[11px] flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                                        <span>شاغر / لم يُحدد</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Quick Swap Trigger Button (Hidden in Print) */}
                                  <div className="no-print flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSwapModal(item, slotIdx)}
                                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs ${
                                        isAssigned 
                                          ? 'bg-white hover:bg-qou-primary hover:text-white text-slate-700 border border-slate-200' 
                                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                                      }`}
                                      title={isAssigned ? "تبديل أو تعديل هذا المراقب" : "تعيين مراقب في هذه الخانة"}
                                    >
                                      <ArrowLeftRight className="w-3 h-3" />
                                      <span>{isAssigned ? 'تبديل / تعديل' : 'تعيين مراقب'}</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* Signature Column for Print */}
                        <td className="py-2.5 px-3 text-center border-l border-slate-200 print-only-col text-slate-300 align-middle">
                          {Array.from({ length: capacity }).map((_, slotIdx) => (
                            <div key={slotIdx} className="py-1 text-[11px]">
                              {capacity > 1 ? `توقيع (${slotIdx + 1}): ____________` : '____________'}
                            </div>
                          ))}
                        </td>

                      </tr>
                    );
                  })
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
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">التصنيف</th>
                  <th className="py-2.5 px-3 w-24 text-center border-l border-slate-200">الحالة</th>
                  <th className="py-2.5 px-3 w-32 text-center border-l border-slate-200">النصاب الأكاديمي / السقف الإداري</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">المنفذ فعلياً</th>
                  <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200">الفرق والتطابق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {liveProctorStats.map((p, idx) => {
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
                          (p.type || 'academic') === 'academic'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {(p.type || 'academic') === 'academic' ? '🎓 أكاديمي' : '💼 إداري'}
                        </span>
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
                            {(p.type || 'academic') === 'administrative' ? 'مستوفى السقف 100%' : 'مستوفى العقد 100%'}
                          </span>
                        ) : isUnder ? (
                          (p.type || 'academic') === 'administrative' ? (
                            <span className="text-emerald-700 bg-emerald-50/70 px-2 py-0.5 rounded text-[11px] border border-emerald-200" title="سقف أقصى تم توزيعه بعدالة">
                              ✓ استيفاء عادل (دون السقف بـ {quota - assigned})
                            </span>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                              متبقي من النصاب {quota - assigned}
                            </span>
                          )
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

      {/* Quick Swap & Reassignment Modal */}
      {activeSwapSlot && (
        <QuickSwapModal
          isOpen={Boolean(activeSwapSlot)}
          onClose={() => setActiveSwapSlot(null)}
          slotData={activeSwapSlot}
          scheduleDays={scheduleDays}
          proctors={proctors}
          onApplyReassign={handleApplyReassign}
          onApplySwap={handleApplySwap}
          onApplyClear={handleApplyClear}
        />
      )}

    </div>
  );
}