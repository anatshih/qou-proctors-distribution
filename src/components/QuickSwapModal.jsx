import React, { useState, useMemo } from 'react';
import { 
  X, ArrowLeftRight, UserCheck, AlertTriangle, Search, 
  Users, Trash2, CheckCircle, ShieldAlert, Sparkles, Building
} from 'lucide-react';
import { sortProctors } from '../utils/proctorsHelper.js';
import ConfirmModal from './ConfirmModal';

export default function QuickSwapModal({
  isOpen,
  onClose,
  slotData,
  scheduleDays,
  proctors,
  onApplyReassign,
  onApplySwap,
  onApplyClear
}) {
  if (!isOpen || !slotData) return null;

  const [activeSubTab, setActiveSubTab] = useState('swap'); // 'swap' | 'roster'
  const [searchTerm, setSearchTerm] = useState('');
  const [rosterFilter, setRosterFilter] = useState('available'); // 'available' | 'all' | 'exceptions'
  const [confirmWarning, setConfirmWarning] = useState(null); // { type: 'exception' | 'conflict', proctorName, proceedFn }
  const [confirmConfig, setConfirmConfig] = useState(null);

  // Extract session object
  const currentDay = scheduleDays[slotData.dayIndex];
  const currentSession = currentDay?.sessions?.find(s => s.sessionNumber === slotData.sessionNumber);

  // Helper to extract proctors of any room
  const getProctorListForRoom = (roomObj) => {
    if (Array.isArray(roomObj.assignedProctors) && roomObj.assignedProctors.length > 0) {
      return [...roomObj.assignedProctors];
    }
    if (roomObj.proctor && roomObj.proctor.trim()) {
      return roomObj.proctor.split('/').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  // 1. Find all other slots in this exact session for Mutual Swap
  const sessionSlotsForSwap = useMemo(() => {
    if (!currentSession || !currentSession.rooms) return [];
    const list = [];

    currentSession.rooms.forEach((r, rIdx) => {
      const rCap = Math.max(1, Number(r.capacity) || 1);
      const rProctors = getProctorListForRoom(r);

      for (let sIdx = 0; sIdx < rCap; sIdx++) {
        const isCurrentSlot = (rIdx === slotData.roomIndex && sIdx === slotData.slotIndex);
        if (isCurrentSlot) continue;

        const assignedName = rProctors[sIdx] || '';
        list.push({
          roomIndex: rIdx,
          roomName: r.room,
          capacity: rCap,
          slotIndex: sIdx,
          slotLabel: rCap > 1 ? `(مراقب ${sIdx + 1})` : '',
          assignedProctor: assignedName,
          isAssigned: Boolean(assignedName && assignedName.trim())
        });
      }
    });

    return list;
  }, [currentSession, slotData]);

  // 2. Count total assignments across all scheduleDays for all proctors
  const proctorTotalCounts = useMemo(() => {
    const counts = {};
    (scheduleDays || []).forEach(day => {
      (day.sessions || []).forEach(sess => {
        (sess.rooms || []).forEach(room => {
          const names = getProctorListForRoom(room);
          names.forEach(name => {
            counts[name] = (counts[name] || 0) + 1;
          });
        });
      });
    });
    return counts;
  }, [scheduleDays]);

  // 3. Status map of proctors in this specific session
  const proctorsInSessionMap = useMemo(() => {
    const map = {};
    if (!currentSession || !currentSession.rooms) return map;

    currentSession.rooms.forEach((r, rIdx) => {
      const rCap = Math.max(1, Number(r.capacity) || 1);
      const rProctors = getProctorListForRoom(r);

      rProctors.forEach((pName, sIdx) => {
        if (pName && pName.trim()) {
          map[pName] = {
            roomName: r.room,
            roomIndex: rIdx,
            slotIndex: sIdx
          };
        }
      });
    });

    return map;
  }, [currentSession]);

  // Proctors already assigned in any room on the current day
  const proctorSessionsToday = useMemo(() => {
    const map = {}; // proctorName -> Set of sessionNumbers on currentDay
    if (!currentDay) return map;
    (currentDay.sessions || []).forEach(sess => {
      const sessNum = Number(sess.sessionNumber) || 1;
      (sess.rooms || []).forEach(r => {
        const list = Array.isArray(r.assignedProctors) 
          ? r.assignedProctors 
          : (r.assignedProctor ? [r.assignedProctor] : []);
        list.filter(Boolean).forEach(name => {
          const trimmed = name.trim();
          if (!map[trimmed]) map[trimmed] = new Set();
          map[trimmed].add(sessNum);
        });
      });
    });
    return map;
  }, [currentDay]);

  // 4. Enrich proctor roster with real-time conflict & exception data
  const enrichedProctors = useMemo(() => {
    return (proctors || []).map(p => {
      const assignedCount = proctorTotalCounts[p.name] || 0;
      const quota = Number(p.quota) || 0;
      const isCurrent = p.name === slotData.currentProctor;
      const sessionConflict = proctorsInSessionMap[p.name] || null;
      const isAcademic = p.type !== 'administrative';
      
      const dayWideKey = `${slotData.date}_all`;
      const sessionKey = `${slotData.date}_s${slotData.sessionNumber}`;
      const rawExceptions = p.exceptions || [];
      const hasException = rawExceptions.includes(dayWideKey) || 
                           rawExceptions.includes(sessionKey) ||
                           rawExceptions.some(ex => ex && ex.date === slotData.date && (!ex.sessionNumber || Number(ex.sessionNumber) === slotData.sessionNumber));

      const todaySessions = proctorSessionsToday[p.name] || new Set();
      const todaySessionCount = todaySessions.size;

      // Check daily limit overload for admin (> 2 sessions)
      const wouldOverloadAdmin = !isAcademic && todaySessionCount >= 2 && !todaySessions.has(slotData.sessionNumber);

      // Check excludeSession3
      const violatesExclude3 = p.excludeSession3 && slotData.sessionNumber === 3;

      // Check academic gap (Sessions 1 and 3 without 2)
      let wouldCreateGap = false;
      if (isAcademic) {
        const futureSessions = new Set(todaySessions);
        futureSessions.add(slotData.sessionNumber);
        if (futureSessions.has(1) && futureSessions.has(3) && !futureSessions.has(2)) {
          wouldCreateGap = true;
        }
      }

      // Check quota full
      const isQuotaFull = quota > 0 && assignedCount >= quota;

      let status = 'available'; // 'available' | 'in_session' | 'exception' | 'quota_reached' | 'inactive' | 'exclude3' | 'admin_overload'
      if (!p.isActive) {
        status = 'inactive';
      } else if (sessionConflict) {
        status = 'in_session';
      } else if (hasException) {
        status = 'exception';
      } else if (violatesExclude3) {
        status = 'exclude3';
      } else if (wouldOverloadAdmin) {
        status = 'admin_overload';
      } else if (isQuotaFull) {
        status = 'quota_reached';
      }

      return {
        ...p,
        isAcademic,
        assignedCount,
        quota,
        isCurrent,
        sessionConflict,
        hasException,
        violatesExclude3,
        wouldOverloadAdmin,
        wouldCreateGap,
        isQuotaFull,
        todaySessionCount,
        status
      };
    });
  }, [proctors, proctorTotalCounts, proctorsInSessionMap, proctorSessionsToday, slotData]);

  // Filtered proctor roster for selection (Sorted: Academics first, then Administrative, alphabetical in Arabic)
  const filteredProctorRoster = useMemo(() => {
    const list = enrichedProctors.filter(p => {
      if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (rosterFilter === 'available') {
        return p.isActive && 
               !p.sessionConflict && 
               !p.hasException && 
               !p.violatesExclude3 && 
               !p.wouldOverloadAdmin && 
               !p.isQuotaFull;
      }
      if (rosterFilter === 'exceptions') {
        return p.hasException || p.violatesExclude3;
      }
      return true;
    });
    return sortProctors(list);
  }, [enrichedProctors, searchTerm, rosterFilter]);

  // Actions
  const handlePerformSwap = (targetRoomIdx, targetSlotIdx) => {
    onApplySwap(
      slotData.dayIndex,
      slotData.sessionNumber,
      slotData.roomIndex,
      slotData.slotIndex,
      targetRoomIdx,
      targetSlotIdx
    );
    onClose();
  };

  const handleSelectProctor = (proctor) => {
    // If already current proctor, do nothing
    if (proctor.isCurrent) return;

    // 1. Check if in another room in this session
    if (proctor.sessionConflict) {
      setConfirmWarning({
        type: 'conflict',
        proctorName: proctor.name,
        message: `المراقب (${proctor.name}) معيّن حالياً في قاعة ${proctor.sessionConflict.roomName}. هل تريد إجراء تبديل متبادل بين القاعتين؟`,
        actionLabel: 'تبديل متبادل بين القاعتين',
        proceedFn: () => {
          handlePerformSwap(proctor.sessionConflict.roomIndex, proctor.sessionConflict.slotIndex);
        }
      });
      return;
    }

    // 2. Check if has exception
    if (proctor.hasException) {
      setConfirmWarning({
        type: 'exception',
        proctorName: proctor.name,
        message: `المراقب (${proctor.name}) لديه طلب اعتذار / استثناء مسجل في هذا اليوم (${slotData.dayName} ${slotData.date}). هل تود تأكيد تعيينه استثنائياً؟`,
        actionLabel: 'تأكيد التعيين بالرغم من الاستثناء',
        proceedFn: () => {
          onApplyReassign(
            slotData.dayIndex,
            slotData.sessionNumber,
            slotData.roomIndex,
            slotData.slotIndex,
            proctor.name
          );
          onClose();
        }
      });
      return;
    }

    // 3. Check if violates excludeSession3
    if (proctor.violatesExclude3) {
      setConfirmWarning({
        type: 'exclude3',
        proctorName: proctor.name,
        message: `المراقب (${proctor.name}) لديه استبعاد معتمد للجلسة الثالثة. هل تود تأكيد تعيينه في الجلسة الثالثة استثنائياً؟`,
        actionLabel: 'تأكيد التعيين في الجلسة الثالثة',
        proceedFn: () => {
          onApplyReassign(
            slotData.dayIndex,
            slotData.sessionNumber,
            slotData.roomIndex,
            slotData.slotIndex,
            proctor.name
          );
          onClose();
        }
      });
      return;
    }

    // 4. Check if would overload admin (> 2 sessions)
    if (proctor.wouldOverloadAdmin) {
      setConfirmWarning({
        type: 'admin_overload',
        proctorName: proctor.name,
        message: `المراقب الإداري (${proctor.name}) لديه بالفعل جلستان في هذا اليوم (${slotData.dayName})، وتعيينه سيتجاوز السقف الأقصى (جلستان يومياً). هل تود المتابعة؟`,
        actionLabel: 'تأكيد التعيين وتجاوز السقف اليومي',
        proceedFn: () => {
          onApplyReassign(
            slotData.dayIndex,
            slotData.sessionNumber,
            slotData.roomIndex,
            slotData.slotIndex,
            proctor.name
          );
          onClose();
        }
      });
      return;
    }

    // 5. Check if would create academic gap (1 & 3 without 2)
    if (proctor.wouldCreateGap) {
      setConfirmWarning({
        type: 'gap',
        proctorName: proctor.name,
        message: `تعيين الزميل الأكاديمي (${proctor.name}) في هذه الجلسة سيصنع فجوة انتظار في يومه (جلسة 1 وجلسة 3 دون جلسة 2). هل تود المتابعة؟`,
        actionLabel: 'تأكيد التعيين مع قبول الفجوة',
        proceedFn: () => {
          onApplyReassign(
            slotData.dayIndex,
            slotData.sessionNumber,
            slotData.roomIndex,
            slotData.slotIndex,
            proctor.name
          );
          onClose();
        }
      });
      return;
    }

    // 6. Check if quota is full
    if (proctor.isQuotaFull) {
      setConfirmWarning({
        type: 'quota',
        proctorName: proctor.name,
        message: `المراقب (${proctor.name}) استوفى نصابه/سقفه بالكامل بواقع (${proctor.assignedCount} من أصل ${proctor.quota} جلسة). هل تود تكليفه بزيادة فوق النصاب؟`,
        actionLabel: 'تأكيد التكليف بزيادة فوق النصاب',
        proceedFn: () => {
          onApplyReassign(
            slotData.dayIndex,
            slotData.sessionNumber,
            slotData.roomIndex,
            slotData.slotIndex,
            proctor.name
          );
          onClose();
        }
      });
      return;
    }

    // Normal direct reassignment
    onApplyReassign(
      slotData.dayIndex,
      slotData.sessionNumber,
      slotData.roomIndex,
      slotData.slotIndex,
      proctor.name
    );
    onClose();
  };

  const handleClearSlot = () => {
    setConfirmConfig({
      title: 'تأكيد تفريغ المقعد',
      message: `هل أنت متأكد من رغبتك في تفريغ المقعد المسند للزميل (${slotData.currentProctor || ''})؟`,
      variant: 'warning',
      confirmText: 'نعم، تفريغ المقعد',
      cancelText: 'إلغاء وتراجع',
      consequences: [
        `سيتم إزالة الزميل من قاعة (${slotData.roomName}) في الجلسة (${slotData.sessionNumber}) يوم (${slotData.dayName} ${slotData.date}).`,
        'سيعود المقعد شاغراً وينقص عدد الجلسات المنفذة للزميل بمقدار (-1).'
      ],
      onConfirm: () => {
        onApplyClear(
          slotData.dayIndex,
          slotData.sessionNumber,
          slotData.roomIndex,
          slotData.slotIndex
        );
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="bg-gradient-to-l from-qou-primary to-qou-dark text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md">
              <ArrowLeftRight className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-black text-base flex items-center gap-2">
                <span>تعديل وتبديل المراقب (Quick Swap)</span>
                <span className="bg-white/20 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  فوري ومباشر
                </span>
              </h3>
              <p className="text-xs text-white/80 mt-0.5">
                {slotData.dayName} ({slotData.date}) • <strong className="text-white">جلسة {slotData.sessionNumber}</strong> • <strong className="text-amber-300">قاعة {slotData.roomName}</strong> {slotData.capacity > 1 ? `(مراقب ${slotData.slotIndex + 1})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Proctor Card */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
              slotData.currentProctor ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {slotData.currentProctor ? slotData.currentProctor[0] : '?'}
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">المراقب الحالي في هذه الخانة:</span>
              <span className="font-extrabold text-slate-900 text-sm">
                {slotData.currentProctor || 'شاغر / لم يتم تعيين مراقب'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {slotData.currentProctor && (
              <button
                type="button"
                onClick={handleClearSlot}
                className="text-xs text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="إلغاء التعيين وجعل هذه القاعة شاغرة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إلغاء التعيين (شاغر)</span>
              </button>
            )}
          </div>
        </div>

        {/* Warning Confirmation Overlay */}
        {confirmWarning && (
          <div className="p-4 bg-amber-50 border-b-2 border-amber-300 flex flex-col gap-2 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed font-semibold">
                {confirmWarning.message}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmWarning(null)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={confirmWarning.proceedFn}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
                {confirmWarning.actionLabel}
              </button>
            </div>
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-4 bg-white">
          <button
            type="button"
            onClick={() => { setActiveSubTab('swap'); setConfirmWarning(null); }}
            className={`py-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition ${
              activeSubTab === 'swap' 
                ? 'border-qou-primary text-qou-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>تبديل فوري بنفس الجلسة ({sessionSlotsForSwap.filter(s => s.isAssigned).length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('roster'); setConfirmWarning(null); }}
            className={`py-3 px-4 text-xs font-extrabold flex items-center gap-2 border-b-2 transition ${
              activeSubTab === 'roster' 
                ? 'border-qou-primary text-qou-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>اختيار مراقب بديل من القائمة</span>
          </button>
        </div>

        {/* Tab 1 Content: Instant Mutual Swap within Session */}
        {activeSubTab === 'swap' && (
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 p-2.5 rounded-xl flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>
                التبديل الفوري يتيح لك مبادلة المراقب الحالي مع مراقب آخر في أي قاعة أخرى في <strong>الجلسة {slotData.sessionNumber}</strong> دون أي تعارض زمني!
              </span>
            </div>

            {sessionSlotsForSwap.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                لا توجد قاعات أخرى في هذه الجلسة.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {sessionSlotsForSwap.map((other, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-2xl border border-slate-200 hover:border-qou-primary/50 hover:shadow-sm transition flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-900 text-xs">
                          قاعة {other.roomName}
                        </span>
                        {other.slotLabel && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">
                            {other.slotLabel}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 font-bold mt-1">
                        {other.isAssigned ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5" />
                            {other.assignedProctor}
                          </span>
                        ) : (
                          <span className="text-amber-600">شاغر</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePerformSwap(other.roomIndex, other.slotIndex)}
                      className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-3 py-2 rounded-xl shadow-sm transition flex items-center gap-1 cursor-pointer flex-shrink-0"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5 text-amber-300" />
                      <span>تبديل فوري</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Select from Proctors Roster */}
        {activeSubTab === 'roster' && (
          <div className="p-4 overflow-y-auto flex-1 space-y-3">
            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث باسم المراقب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-qou-primary/20"
                />
              </div>

              <div className="flex bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setRosterFilter('available')}
                  className={`px-2.5 py-1 rounded-lg transition ${rosterFilter === 'available' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
                >
                  المتاحون فقط
                </button>
                <button
                  type="button"
                  onClick={() => setRosterFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${rosterFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
                >
                  الكل ({enrichedProctors.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRosterFilter('exceptions')}
                  className={`px-2.5 py-1 rounded-lg transition ${rosterFilter === 'exceptions' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
                >
                  لديهم استثناء
                </button>
              </div>
            </div>

            {/* Proctors List */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredProctorRoster.map(p => {
                const isSelected = p.isCurrent;

                return (
                  <div
                    key={p.id}
                    className={`p-2.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'bg-emerald-50 border-emerald-300' 
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        isSelected 
                          ? 'bg-emerald-600 text-white' 
                          : p.status === 'available'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.name[0]}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs truncate">
                            {p.name}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded">
                              الحالي
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px]">
                          <span className="text-slate-500 font-mono">
                            نصاب: {p.assignedCount}/{p.quota}
                          </span>

                          {p.status === 'available' && (
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold border border-emerald-200">
                              🟢 متاح
                            </span>
                          )}

                          {p.status === 'in_session' && (
                            <span className="text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-bold border border-rose-200">
                              ⛔ في قاعة {p.sessionConflict.roomName}
                            </span>
                          )}

                          {p.status === 'exception' && (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold border border-amber-200">
                              ⚠️ استثناء اليوم
                            </span>
                          )}

                          {p.status === 'exclude3' && (
                            <span className="text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-bold border border-purple-200">
                              🚫 الجلسة 3 مستبعدة
                            </span>
                          )}

                          {p.status === 'admin_overload' && (
                            <span className="text-orange-700 bg-orange-50 px-1.5 py-0.2 rounded font-bold border border-orange-200">
                              ⚠️ سقف اليوم (جلستان)
                            </span>
                          )}

                          {p.status === 'quota_reached' && (
                            <span className="text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                              مكتمل النصاب ({p.assignedCount})
                            </span>
                          )}

                          {p.wouldCreateGap && (
                            <span className="text-pink-700 bg-pink-50 px-1.5 py-0.2 rounded font-bold border border-pink-200">
                              ⚠️ سيصنع فجوة (1 و 3)
                            </span>
                          )}

                          {p.status === 'inactive' && (
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded font-bold">
                              مجمّد
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSelected}
                      onClick={() => handleSelectProctor(p)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex-shrink-0 ${
                        isSelected
                          ? 'bg-emerald-100 text-emerald-700 cursor-default'
                          : p.sessionConflict
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 hover:bg-qou-primary hover:text-white text-slate-800'
                      }`}
                    >
                      {isSelected 
                        ? 'المعيّن حالياً' 
                        : p.sessionConflict 
                        ? 'تبديل مع قاعته' 
                        : 'اختيار وتعيين'}
                    </button>
                  </div>
                );
              })}

              {filteredProctorRoster.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-xs font-bold">
                  لا يوجد مراقب مطابق للبحث والفلاتر.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            * أي تعديل يتم حفظه تلقائياً وتحديث إحصائيات وأنصبة المراقبين فوراً.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-xl transition"
          >
            إغلاق النافذة
          </button>
        </div>

        {/* Confirmation Modal */}
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          onClose={() => setConfirmConfig(null)}
          {...confirmConfig}
        />

      </div>
    </div>
  );
}