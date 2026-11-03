import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, AlertTriangle, ArrowLeft, Search, UserCheck, 
  UserPlus, UserMinus, Plus, Sparkles, Filter, Calendar, Building, 
  RotateCcw, Check, X, ShieldAlert, Award, Clock
} from 'lucide-react';
import { sortProctors } from '../utils/proctorsHelper.js';

export default function ReviewTab({
  scheduleDays,
  setScheduleDays,
  proctors,
  setProctors,
  totalRoomSlots,
  onNavigateNext
}) {
  const [filterMode, setFilterMode] = useState('unassigned'); // 'unassigned' | 'all' | 'overtime'
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSession, setSelectedSession] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [customNameInputSlot, setCustomNameInputSlot] = useState(null); // { dayIndex, sessionNumber, roomIndex, slotIndex }
  const [customNameValue, setCustomNameValue] = useState('');
  const [feedbackToast, setFeedbackToast] = useState(null);

  const showToast = (msg) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Helper to extract array of proctors from room object
  const getProctorListForRoom = (roomObj) => {
    if (Array.isArray(roomObj.assignedProctors) && roomObj.assignedProctors.length > 0) {
      return [...roomObj.assignedProctors];
    }
    if (roomObj.proctor && roomObj.proctor.trim()) {
      return roomObj.proctor.split('/').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  // Helper to get room capacity
  const getRoomCapacity = (roomObj) => {
    const list = getProctorListForRoom(roomObj);
    return Math.max(1, Number(roomObj.capacity) || list.length || 1);
  };

  // 1. Flatten all room slots across the entire schedule
  const allSlots = useMemo(() => {
    const list = [];
    (scheduleDays || []).forEach((day, dayIndex) => {
      (day.sessions || []).forEach(session => {
        (session.rooms || []).forEach((room, roomIndex) => {
          const proctorList = getProctorListForRoom(room);
          const capacity = getRoomCapacity(room);

          for (let slotIndex = 0; slotIndex < capacity; slotIndex++) {
            const assignedName = proctorList[slotIndex] || '';
            const isAssigned = Boolean(assignedName && assignedName.trim());

            list.push({
              dayIndex,
              date: day.date,
              dayName: day.dayName,
              sessionNumber: session.sessionNumber,
              roomIndex,
              roomName: room.room,
              capacity,
              slotIndex,
              slotLabel: capacity > 1 ? `(مراقب ${slotIndex + 1} من ${capacity})` : '',
              assignedProctor: assignedName,
              isAssigned,
              rawRoom: room
            });
          }
        });
      });
    });
    return list;
  }, [scheduleDays]);

  // 2. Count proctor assignments dynamically in real time
  const proctorAssignmentsCount = useMemo(() => {
    const counts = {};
    allSlots.forEach(slot => {
      if (slot.isAssigned) {
        counts[slot.assignedProctor] = (counts[slot.assignedProctor] || 0) + 1;
      }
    });
    return counts;
  }, [allSlots]);

  // 3. Proctors mapped by session to detect time conflicts
  const sessionProctorMap = useMemo(() => {
    const map = {}; // key: "date_sX" -> Set of names
    allSlots.forEach(slot => {
      if (slot.isAssigned) {
        const key = `${slot.date}_s${slot.sessionNumber}`;
        if (!map[key]) map[key] = new Set();
        map[key].add(slot.assignedProctor);
      }
    });
    return map;
  }, [allSlots]);

  // 4. Overtime / Over-quota proctors
  const overtimeProctors = useMemo(() => {
    return (proctors || []).map(p => {
      const assigned = proctorAssignmentsCount[p.name] || 0;
      const quota = Number(p.quota) || 0;
      const diff = assigned - quota;
      return {
        ...p,
        assigned,
        quota,
        diff,
        isOvertime: diff > 0
      };
    }).filter(p => p.isOvertime);
  }, [proctors, proctorAssignmentsCount]);

  // General counts
  const totalSlotsCount = allSlots.length;
  const assignedSlotsCount = allSlots.filter(s => s.isAssigned).length;
  const unassignedSlotsCount = totalSlotsCount - assignedSlotsCount;
  const coverageRate = totalSlotsCount > 0 ? Math.round((assignedSlotsCount / totalSlotsCount) * 100) : 0;

  // Unique days for dropdown
  const uniqueDays = useMemo(() => {
    const set = new Set();
    scheduleDays.forEach(d => set.add(`${d.dayName} (${d.date})`));
    return Array.from(set);
  }, [scheduleDays]);

  // Filtered slots for display
  const filteredSlots = useMemo(() => {
    return allSlots.filter(slot => {
      // Day filter
      if (selectedDay && `${slot.dayName} (${slot.date})` !== selectedDay) return false;
      // Session filter
      if (selectedSession && String(slot.sessionNumber) !== selectedSession) return false;
      // Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesRoom = slot.roomName.toLowerCase().includes(term);
        const matchesProctor = slot.assignedProctor.toLowerCase().includes(term);
        if (!matchesRoom && !matchesProctor) return false;
      }

      // Mode filter
      if (filterMode === 'unassigned') return !slot.isAssigned;
      if (filterMode === 'overtime') {
        if (!slot.isAssigned) return false;
        const matchedP = proctors.find(p => p.name === slot.assignedProctor);
        if (!matchedP) return true; // custom external proctor
        const quota = Number(matchedP.quota) || 0;
        const assigned = proctorAssignmentsCount[matchedP.name] || 0;
        return assigned > quota;
      }

      return true;
    });
  }, [allSlots, filterMode, selectedDay, selectedSession, searchTerm, proctors, proctorAssignmentsCount]);

  // -------------------------------------------------------------
  // Manual Assignment Handlers
  // -------------------------------------------------------------
  const handleAssignProctorToSlot = (slot, proctorName) => {
    if (!proctorName || !proctorName.trim()) return;
    const cleanName = proctorName.trim();

    setScheduleDays(prevDays => {
      const nextDays = JSON.parse(JSON.stringify(prevDays));
      const targetDay = nextDays[slot.dayIndex];
      if (!targetDay) return prevDays;

      const targetSession = targetDay.sessions.find(s => s.sessionNumber === slot.sessionNumber);
      if (!targetSession) return prevDays;

      const targetRoom = targetSession.rooms[slot.roomIndex];
      if (!targetRoom) return prevDays;

      const capacity = Math.max(1, Number(targetRoom.capacity) || 1);
      targetRoom.capacity = capacity;

      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor 
          ? targetRoom.proctor.split('/').map(s => s.trim()).filter(Boolean)
          : [];
      }

      // Ensure array length
      while (targetRoom.assignedProctors.length < capacity) {
        targetRoom.assignedProctors.push('');
      }

      targetRoom.assignedProctors[slot.slotIndex] = cleanName;
      targetRoom.proctor = targetRoom.assignedProctors.join(' / ');

      return nextDays;
    });

    showToast(`تم تعيين (${cleanName}) في قاعة ${slot.roomName} بنجاح ✓`);
    setCustomNameInputSlot(null);
    setCustomNameValue('');
  };

  const handleClearSlot = (slot) => {
    const oldName = slot.assignedProctor;
    setScheduleDays(prevDays => {
      const nextDays = JSON.parse(JSON.stringify(prevDays));
      const targetDay = nextDays[slot.dayIndex];
      if (!targetDay) return prevDays;

      const targetSession = targetDay.sessions.find(s => s.sessionNumber === slot.sessionNumber);
      if (!targetSession) return prevDays;

      const targetRoom = targetSession.rooms[slot.roomIndex];
      if (!targetRoom) return prevDays;

      if (Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors[slot.slotIndex] = '';
        targetRoom.proctor = targetRoom.assignedProctors.join(' / ');
      }

      return nextDays;
    });

    showToast(`تم تفريغ الخانة من (${oldName})`);
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Top Status & Completion Hero Banner */}
      <div className={`p-6 rounded-3xl border shadow-sm transition-all ${
        unassignedSlotsCount === 0
          ? 'bg-gradient-to-r from-emerald-900 via-qou-primary to-emerald-800 text-white border-emerald-700'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                unassignedSlotsCount === 0 ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                الخطوة 4: المراجعة والتعيين اليدوي
              </span>
              <span className="text-xs font-bold opacity-80">
                سد الشواغر وإسناد المراقبات الإضافية يدوياً
              </span>
            </div>

            <h2 className="text-xl lg:text-2xl font-black">
              {unassignedSlotsCount === 0 ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                  اكتملت تغطية كافة شواغر القاعات بنسبة 100%!
                </span>
              ) : (
                <span className="text-slate-900">
                  متبقي <strong className="text-amber-600 font-black">{unassignedSlotsCount}</strong> شاغر بحاجة لتسكين يدوي لسد العجز
                </span>
              )}
            </h2>

            <p className={`text-xs max-w-2xl ${unassignedSlotsCount === 0 ? 'text-emerald-100' : 'text-slate-500'}`}>
              يمكنك هنا تسكين أي مراقب في القاعات الشاغرة مباشرة، أو كتابة اسم مراقب خارجي، أو إسناد مراقبات فوق الرصيد للمراقبين المستوفين.
            </p>
          </div>

          {/* Quick Metrics & Next Action */}
          <div className="flex flex-wrap items-center gap-3">
            <div className={`p-3 rounded-2xl border text-center min-w-[120px] ${
              unassignedSlotsCount === 0 
                ? 'bg-white/10 border-white/20 text-white' 
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="text-2xl font-black">{assignedSlotsCount} / {totalSlotsCount}</div>
              <div className="text-[11px] font-bold opacity-80">شواغر مسندة ({coverageRate}%)</div>
            </div>

            {unassignedSlotsCount === 0 && (
              <button
                type="button"
                onClick={() => onNavigateNext?.('results')}
                className="bg-qou-accent hover:bg-qou-accentDark text-slate-950 font-black text-sm px-6 py-3.5 rounded-2xl shadow-lg transition flex items-center gap-2 cursor-pointer"
              >
                <span>الانتقال للخطوة 5: الكشوفات والطباعة</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Filter & Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* View Filter Mode Chips */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600 gap-1">
            <button
              type="button"
              onClick={() => setFilterMode('unassigned')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'unassigned' ? 'bg-white text-amber-900 shadow-xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>الشواغر غير المسندة ({unassignedSlotsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <span>جميع القاعات والشواغر ({totalSlotsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('overtime')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                filterMode === 'overtime' ? 'bg-white text-blue-900 shadow-xs font-black' : 'hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-blue-600" />
              <span>مراقبات فوق الرصيد ({overtimeProctors.length})</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم القاعة أو المراقب..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
            />
          </div>

        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">اليوم والتاريخ:</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">جميع الأيام ({uniqueDays.length})</option>
              {uniqueDays.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">الجلسة:</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none"
            >
              <option value="">جميع الجلسات</option>
              <option value="1">جلسة 1</option>
              <option value="2">جلسة 2</option>
              <option value="3">جلسة 3</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSelectedDay('');
                setSelectedSession('');
                setSearchTerm('');
              }}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط الفلاتر</span>
            </button>
          </div>
        </div>

      </div>

      {/* Review Slots Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4 w-44">اليوم والتاريخ</th>
                <th className="py-3 px-3 w-24 text-center">الجلسة</th>
                <th className="py-3 px-4 w-48">القاعة والسعة</th>
                <th className="py-3 px-4">المراقب الحالي وحالته</th>
                <th className="py-3 px-4 w-80 text-center">الإسناد اليدوي والتعيين المباشر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-xs font-bold">
                    {filterMode === 'unassigned' 
                      ? 'تهانينا! لا توجد أي شواغر غير مسندة تطابق الفلاتر. كافة القاعات مكتملة 100%.' 
                      : 'لا توجد قاعات تطابق خيارات البحث.'}
                  </td>
                </tr>
              ) : (
                filteredSlots.map((slot, idx) => {
                  const sessionKey = `${slot.date}_s${slot.sessionNumber}`;
                  const currentProctorsInSession = sessionProctorMap[sessionKey] || new Set();
                  const isAssigned = slot.isAssigned;

                  // Find proctor details if in roster
                  const matchedProctor = isAssigned ? proctors.find(p => p.name === slot.assignedProctor) : null;
                  const quota = matchedProctor ? Number(matchedProctor.quota) || 0 : 0;
                  const assignedTotal = isAssigned ? (proctorAssignmentsCount[slot.assignedProctor] || 0) : 0;
                  const isOverQuota = isAssigned && matchedProctor && assignedTotal > quota;
                  const isCustomExternal = isAssigned && !matchedProctor;

                  const isCustomInputOpen = customNameInputSlot && 
                    customNameInputSlot.dayIndex === slot.dayIndex &&
                    customNameInputSlot.sessionNumber === slot.sessionNumber &&
                    customNameInputSlot.roomIndex === slot.roomIndex &&
                    customNameInputSlot.slotIndex === slot.slotIndex;

                  return (
                    <tr 
                      key={`${slot.dayIndex}_${slot.sessionNumber}_${slot.roomIndex}_${slot.slotIndex}`}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !isAssigned ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Day & Date */}
                      <td className="py-3 px-4 font-bold text-slate-800 text-xs">
                        <div>{slot.dayName}</div>
                        <div className="text-[11px] text-slate-400 font-normal">{slot.date}</div>
                      </td>

                      {/* Session */}
                      <td className="py-3 px-3 text-center">
                        <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2 py-1 rounded-md">
                          جلسة {slot.sessionNumber}
                        </span>
                      </td>

                      {/* Room & Capacity */}
                      <td className="py-3 px-4 font-bold text-slate-800 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>{slot.roomName}</span>
                          {slot.slotLabel && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              {slot.slotLabel}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Proctor Status */}
                      <td className="py-3 px-4 text-xs">
                        {isAssigned ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900">{slot.assignedProctor}</span>
                            
                            {matchedProctor && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                (matchedProctor.type || 'academic') === 'academic'
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {(matchedProctor.type || 'academic') === 'academic' ? '🎓 أكاديمي' : '💼 إداري'}
                              </span>
                            )}

                            {isOverQuota && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-1.5 py-0.2 rounded border border-blue-200">
                                ⭐ إضافي (+{assignedTotal - quota})
                              </span>
                            )}

                            {isCustomExternal && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-1.5 py-0.2 rounded border border-purple-200">
                                متعاون / خارجي
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleClearSlot(slot)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition cursor-pointer mr-1"
                              title="تفريغ الخانة وإلغاء التعيين"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>شاغر بحاجة لمراقب</span>
                          </span>
                        )}
                      </td>

                      {/* Manual Assignment Column (Dropdown + Custom Name) */}
                      <td className="py-2.5 px-4 text-xs">
                        {isCustomInputOpen ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              autoFocus
                              placeholder="اكتب اسم المراقب..."
                              value={customNameValue}
                              onChange={(e) => setCustomNameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAssignProctorToSlot(slot, customNameValue);
                                }
                              }}
                              className="flex-1 bg-white border border-qou-primary text-xs px-2.5 py-1.5 rounded-lg focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAssignProctorToSlot(slot, customNameValue)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg cursor-pointer transition"
                              title="تأكيد التعيين"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomNameInputSlot(null)}
                              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Fast Select Dropdown */}
                            <select
                              value=""
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  setCustomNameInputSlot({
                                    dayIndex: slot.dayIndex,
                                    sessionNumber: slot.sessionNumber,
                                    roomIndex: slot.roomIndex,
                                    slotIndex: slot.slotIndex
                                  });
                                  setCustomNameValue('');
                                } else if (val) {
                                  handleAssignProctorToSlot(slot, val);
                                }
                              }}
                              className={`flex-1 text-xs font-semibold py-1.5 px-2 bg-white border rounded-xl focus:outline-none focus:ring-1 focus:ring-qou-primary cursor-pointer ${
                                !isAssigned ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                              }`}
                            >
                              <option value="">
                                {isAssigned ? '🔄 تغيير المراقب...' : '👈 اختر مراقباً من الكادر...'}
                              </option>

                              {/* Available Proctors - Academics Alphabetical */}
                              <optgroup label="كادر الأكاديميين (مرتب أبجدياً):">
                                {sortProctors(proctors.filter(p => p.isActive && (p.type || 'academic') === 'academic')).map(p => {
                                  const count = proctorAssignmentsCount[p.name] || 0;
                                  const pQuota = Number(p.quota) || 0;
                                  const hasConflict = currentProctorsInSession.has(p.name) && p.name !== slot.assignedProctor;
                                  const isOver = pQuota > 0 && count >= pQuota;

                                  let labelSuffix = `(${count}/${pQuota})`;
                                  if (hasConflict) labelSuffix += ' ⛔ مشغول بالجلسة';
                                  else if (isOver) labelSuffix += ' ⭐ إضافي فوق الرصيد';

                                  return (
                                    <option 
                                      key={p.id} 
                                      value={p.name}
                                      disabled={hasConflict}
                                    >
                                      {p.name} {labelSuffix}
                                    </option>
                                  );
                                })}
                              </optgroup>

                              {/* Available Proctors - Administrative Alphabetical */}
                              <optgroup label="كادر الإداريين (مرتب أبجدياً):">
                                {sortProctors(proctors.filter(p => p.isActive && p.type === 'administrative')).map(p => {
                                  const count = proctorAssignmentsCount[p.name] || 0;
                                  const pQuota = Number(p.quota) || 0;
                                  const hasConflict = currentProctorsInSession.has(p.name) && p.name !== slot.assignedProctor;
                                  const isOver = pQuota > 0 && count >= pQuota;

                                  let labelSuffix = `(${count}/سقف ${pQuota})`;
                                  if (hasConflict) labelSuffix += ' ⛔ مشغول بالجلسة';
                                  else if (isOver) labelSuffix += ' ⭐ فوق السقف';

                                  return (
                                    <option 
                                      key={p.id} 
                                      value={p.name}
                                      disabled={hasConflict}
                                    >
                                      {p.name} {labelSuffix}
                                    </option>
                                  );
                                })}
                              </optgroup>

                              <option value="__custom__">
                                ✍️ كتابة اسم يدوي حر (مراقب خارجي / متعاون)...
                              </option>
                            </select>

                            {/* Direct button to open custom input */}
                            <button
                              type="button"
                              onClick={() => {
                                setCustomNameInputSlot({
                                  dayIndex: slot.dayIndex,
                                  sessionNumber: slot.sessionNumber,
                                  roomIndex: slot.roomIndex,
                                  slotIndex: slot.slotIndex
                                });
                                setCustomNameValue('');
                              }}
                              className="text-slate-500 hover:text-qou-primary p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer flex-shrink-0"
                              title="كتابة اسم مراقب يدوي حر"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Bottom Action Card */}
      <div className="p-5 bg-gradient-to-l from-slate-50 to-emerald-50/40 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-black text-slate-900">
            {unassignedSlotsCount === 0 ? (
              <span className="text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                تم ضبط ومراجعة وتسكين جميع القاعات بنجاح 100%!
              </span>
            ) : (
              <span>
                متبقي <strong>{unassignedSlotsCount}</strong> شاغر غير مسندة في الجدول.
              </span>
            )}
          </h4>
          <p className="text-xs text-slate-500">
            بعد استكمال المراجعة وسد الشواغر، انتقل للخطوة 5 لطباعة وتصدير الكشوفات والتقارير المعتمدة.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateNext?.('results')}
          className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3.5 rounded-2xl shadow-md shadow-qou-primary/20 transition flex items-center gap-2 cursor-pointer"
        >
          <span>الانتقال للخطوة 5: الكشوفات والطباعة المعتمدة</span>
          <ArrowLeft className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
}
