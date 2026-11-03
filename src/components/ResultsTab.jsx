import React, { useState, useMemo, useEffect } from 'react';
import { 
  Printer, FileSpreadsheet, Filter, RotateCcw, User, Calendar, 
  Building, CheckCircle2, AlertCircle, Search, Eye, ArrowLeftRight,
  Users, Check, Plus, AlertTriangle, LayoutGrid, FileText, Award,
  ShieldCheck, CheckSquare, Sparkles, BookOpen, Clock, FileBadge,
  ChevronDown, ChevronRight, HelpCircle, Layers, ListChecks, CheckCheck,
  RefreshCw, Info
} from 'lucide-react';
import { 
  exportDistributedScheduleExcel, 
  exportProctorsMatrixExcel,
  exportPortalEntryExcel,
  exportFilteredResultsExcel,
  exportExecutiveSummaryExcel
} from '../utils/excelHandler';
import { sortProctors } from '../utils/proctorsHelper.js';
import { runScheduleAudit } from '../utils/auditEngine.js';
import QuickSwapModal from './QuickSwapModal';
import ConfirmModal from './ConfirmModal';

export default function ResultsTab({
  scheduleDays = [],
  setScheduleDays,
  proctors = [],
  distributionResult,
  semesterCode = '1261',
  examType = 'نصفي',
  onLogActivity
}) {
  // -------------------------------------------------------------
  // 1. Report Selection: 5 Main Approved Reports
  // 'schedule_audit' | 'portal_entry' | 'matrix' | 'academic_assistant' | 'executive'
  // -------------------------------------------------------------
  const [activeReportTab, setActiveReportTab] = useState('schedule_audit');

  // -------------------------------------------------------------
  // 2. Execution State (Empty on open until user clicks "عرض النتائج")
  // -------------------------------------------------------------
  const [hasExecutedView, setHasExecutedView] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(null);

  // -------------------------------------------------------------
  // 3. Filters State (Default is 'all' / 'الجميع' for all filters)
  // -------------------------------------------------------------
  // Filters for Schedule Audit & Portal Entry
  const [portalDayFilter, setPortalDayFilter] = useState('all');
  const [portalSessionFilter, setPortalSessionFilter] = useState('all');
  const [portalRoleFilter, setPortalRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [portalSearch, setPortalSearch] = useState('');

  // Filters for Matrix View
  const [matrixRoleFilter, setMatrixRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [matrixSearch, setMatrixSearch] = useState('');

  // Filters for Academic Assistant Dossier
  const [selectedAssistantProctorId, setSelectedAssistantProctorId] = useState('all'); // 'all' (الجميع) or specific proctor id
  const [assistantRoleFilter, setAssistantRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [assistantSearch, setAssistantSearch] = useState('');
  const [assistantPrintTarget, setAssistantPrintTarget] = useState(null); // 'single' | 'all' | null

  // Filters for Executive Summary
  const [execRoleFilter, setExecRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'

  // Quick Swap Modal state
  const [activeSwapSlot, setActiveSwapSlot] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // -------------------------------------------------------------
  // Track Filter Changes (Detect Stale View)
  // -------------------------------------------------------------
  const currentFiltersSnapshot = useMemo(() => ({
    activeReportTab,
    portalDayFilter,
    portalSessionFilter,
    portalRoleFilter,
    portalSearch: portalSearch.trim(),
    matrixRoleFilter,
    matrixSearch: matrixSearch.trim(),
    selectedAssistantProctorId,
    assistantRoleFilter,
    assistantSearch: assistantSearch.trim(),
    execRoleFilter
  }), [
    activeReportTab,
    portalDayFilter, portalSessionFilter, portalRoleFilter, portalSearch,
    matrixRoleFilter, matrixSearch,
    selectedAssistantProctorId, assistantRoleFilter, assistantSearch,
    execRoleFilter
  ]);

  const isFiltersDirty = useMemo(() => {
    if (!hasExecutedView || !appliedFilters) return false;
    return JSON.stringify(currentFiltersSnapshot) !== JSON.stringify(appliedFilters);
  }, [hasExecutedView, appliedFilters, currentFiltersSnapshot]);

  // When user clicks "عرض النتائج" or "تحديث العرض"
  const handleExecuteView = () => {
    setAppliedFilters({ ...currentFiltersSnapshot });
    setHasExecutedView(true);
    showToast('✓ تم تحديث وعرض نتائج التقرير المحددة بنجاح');
  };

  // When user resets filters
  const handleResetFilters = () => {
    setPortalDayFilter('all');
    setPortalSessionFilter('all');
    setPortalRoleFilter('all');
    setPortalSearch('');
    setMatrixRoleFilter('all');
    setMatrixSearch('');
    setSelectedAssistantProctorId('all');
    setAssistantRoleFilter('all');
    setAssistantSearch('');
    setExecRoleFilter('all');
  };

  // When changing report tab, we keep filter states but prompt to view
  const handleTabChange = (newTab) => {
    setActiveReportTab(newTab);
    setHasExecutedView(false);
    setAppliedFilters(null);
  };

  // -------------------------------------------------------------
  // Data Extraction & Computation Helpers
  // -------------------------------------------------------------
  const getRoomProctorList = (roomObj) => {
    if (Array.isArray(roomObj.assignedProctors) && roomObj.assignedProctors.length > 0) {
      return [...roomObj.assignedProctors];
    }
    if (roomObj.proctor && roomObj.proctor.trim()) {
      return roomObj.proctor.split('/').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const getRoomCapacity = (roomObj) => {
    const list = getRoomProctorList(roomObj);
    return Math.max(1, Number(roomObj.capacity) || list.length || 1);
  };

  // Flattened rooms list
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
            rawProctor: room.proctor || '',
            isFullyAssigned,
            hasAnyAssigned,
            slotId: `${day.date}_s${session.sessionNumber}_r${roomIndex}`
          });
        });
      });
    });
    return list;
  }, [scheduleDays]);

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

  // Sorted live proctor stats (Academics 1-27 first, Administrative 28-43 second, alphabetical)
  const liveProctorStats = useMemo(() => {
    const list = proctors.map(p => {
      const assignedCount = liveProctorCounts[p.name] || 0;
      const quota = Number(p.quota) || 0;
      const difference = assignedCount - quota;
      return {
        ...p,
        assignedCount,
        difference
      };
    });
    return sortProctors(list);
  }, [proctors, liveProctorCounts]);

  // Pre-flattened sessions list for matrix columns (Days -> Sessions)
  const matrixSessions = useMemo(() => {
    const list = [];
    (scheduleDays || []).forEach((day, dayIndex) => {
      (day.sessions || []).forEach(sess => {
        list.push({
          dayIndex,
          date: day.date,
          dayName: day.dayName,
          sessionNumber: sess.sessionNumber,
          rooms: sess.rooms || []
        });
      });
    });
    return list;
  }, [scheduleDays]);

  // Matrix rows with room cell states per session matching Excel export
  const matrixRows = useMemo(() => {
    return liveProctorStats.map(p => {
      const pExceptions = new Set(p.exceptions || []);
      const sessionAssignments = matrixSessions.map(ms => {
        const foundRoom = ms.rooms.find(r => {
          if (Array.isArray(r.assignedProctors) && r.assignedProctors.includes(p.name)) return true;
          if (r.proctor === p.name) return true;
          if (r.proctor && r.proctor.split('/').map(x => x.trim()).includes(p.name)) return true;
          return false;
        });

        const dayWideKey = `${ms.date}_all`;
        const sessionKey = `${ms.date}_s${ms.sessionNumber}`;
        const isExcluded3 = ms.sessionNumber === 3 && p.excludeSession3;
        const isApologized = pExceptions.has(dayWideKey) || pExceptions.has(sessionKey) || isExcluded3;

        if (foundRoom) {
          const cap = Math.max(1, Number(foundRoom.capacity) || 1);
          return {
            status: 'assigned',
            room: foundRoom.room,
            isMulti: cap > 1,
            text: cap > 1 ? `${foundRoom.room}*` : foundRoom.room
          };
        } else if (isApologized) {
          return {
            status: 'apology',
            text: 'معتذر'
          };
        } else {
          return {
            status: 'empty',
            text: '-'
          };
        }
      });

      return {
        ...p,
        sessionAssignments
      };
    });
  }, [liveProctorStats, matrixSessions]);

  // Central Mathematical Audit Result (Derived dynamically 100%)
  const liveAudit = useMemo(() => {
    return runScheduleAudit(scheduleDays, proctors);
  }, [scheduleDays, proctors]);

  // -------------------------------------------------------------
  // Filtered Data based on APPLIED filters (guarantees match on print)
  // -------------------------------------------------------------
  const activeFiltersToUse = appliedFilters || currentFiltersSnapshot;

  // 1. Filtered Schedule for Schedule Audit & Portal Entry
  const filteredScheduleData = useMemo(() => {
    const { portalDayFilter: dFilter, portalSessionFilter: sFilter, portalRoleFilter: rFilter, portalSearch: qSearch } = activeFiltersToUse;

    const daysMap = new Map();

    (scheduleDays || []).forEach((day, dIdx) => {
      const dayKey = `${day.dayName} (${day.date})`;
      if (dFilter && dFilter !== 'all' && dayKey !== dFilter && day.date !== dFilter) return;

      const sessionsMap = new Map();

      (day.sessions || []).forEach(sess => {
        if (sFilter && sFilter !== 'all' && String(sess.sessionNumber) !== String(sFilter)) return;

        const filteredSessRooms = (sess.rooms || []).map((r, rIdx) => {
          const proctorList = getRoomProctorList(r);
          const capacity = getRoomCapacity(r);
          return {
            dayIndex: dIdx,
            date: day.date,
            dayName: day.dayName,
            sessionNumber: sess.sessionNumber,
            roomIndex: rIdx,
            room: r.room,
            capacity,
            proctors: proctorList
          };
        }).filter(item => {
          if (qSearch) {
            const query = qSearch.toLowerCase();
            const matchesRoom = String(item.room).toLowerCase().includes(query);
            const matchesProctor = item.proctors.some(p => p.toLowerCase().includes(query));
            if (!matchesRoom && !matchesProctor) return false;
          }
          if (rFilter && rFilter !== 'all') {
            const matchesRole = item.proctors.some(pName => {
              const foundP = liveProctorStats.find(lp => lp.name === pName);
              const role = (foundP && foundP.type) || 'academic';
              return role === rFilter;
            });
            if (!matchesRole) return false;
          }
          return true;
        });

        if (filteredSessRooms.length > 0) {
          sessionsMap.set(sess.sessionNumber, filteredSessRooms);
        }
      });

      if (sessionsMap.size > 0) {
        daysMap.set(dayKey, {
          dayName: day.dayName,
          date: day.date,
          sessions: Array.from(sessionsMap.entries()).map(([sessNum, rooms]) => ({
            sessionNumber: sessNum,
            rooms
          }))
        });
      }
    });

    return Array.from(daysMap.values());
  }, [scheduleDays, activeFiltersToUse, liveProctorStats]);

  // Aggregate stats of filtered schedule
  const filteredScheduleStats = useMemo(() => {
    let roomsCount = 0;
    let proctorSlotsCount = 0;
    let singleRooms = 0;
    let multi2Rooms = 0;
    let multi3Rooms = 0;
    let assignedSlots = 0;

    filteredScheduleData.forEach(day => {
      day.sessions.forEach(sess => {
        sess.rooms.forEach(r => {
          roomsCount++;
          proctorSlotsCount += r.capacity;
          if (r.capacity === 1) singleRooms++;
          else if (r.capacity === 2) multi2Rooms++;
          else if (r.capacity >= 3) multi3Rooms++;
          assignedSlots += r.proctors.filter(Boolean).length;
        });
      });
    });

    return {
      roomsCount,
      proctorSlotsCount,
      singleRooms,
      multi2Rooms,
      multi3Rooms,
      assignedSlots,
      vacantSlots: Math.max(0, proctorSlotsCount - assignedSlots)
    };
  }, [filteredScheduleData]);

  // 2. Filtered Matrix Rows
  const filteredMatrixRows = useMemo(() => {
    const { matrixRoleFilter: rFilter, matrixSearch: qSearch } = activeFiltersToUse;
    return matrixRows.filter(p => {
      if (rFilter === 'academic' && (p.type || 'academic') !== 'academic') return false;
      if (rFilter === 'administrative' && (p.type || 'academic') !== 'administrative') return false;
      if (qSearch && !p.name.toLowerCase().includes(qSearch.toLowerCase())) return false;
      return true;
    });
  }, [matrixRows, activeFiltersToUse]);

  // 3. Filtered Proctors for Academic Assistant
  const filteredAssistantProctors = useMemo(() => {
    const { selectedAssistantProctorId: pId, assistantRoleFilter: rFilter, assistantSearch: qSearch } = activeFiltersToUse;

    return liveProctorStats.filter(p => {
      if (pId && pId !== 'all' && p.id !== pId) return false;
      if (rFilter === 'academic' && (p.type || 'academic') !== 'academic') return false;
      if (rFilter === 'administrative' && (p.type || 'academic') !== 'administrative') return false;
      if (qSearch && !p.name.toLowerCase().includes(qSearch.toLowerCase())) return false;
      return true;
    });
  }, [liveProctorStats, activeFiltersToUse]);

  // 4. Executive Summary Filtered Stats
  const executiveFilteredStats = useMemo(() => {
    const { execRoleFilter: rFilter } = activeFiltersToUse;
    const isAcademicOnly = rFilter === 'academic';
    const isAdminOnly = rFilter === 'administrative';

    const academics = liveProctorStats.filter(p => (p.type || 'academic') === 'academic');
    const admins = liveProctorStats.filter(p => p.type === 'administrative');

    let targetProctors = liveProctorStats;
    if (isAcademicOnly) targetProctors = academics;
    if (isAdminOnly) targetProctors = admins;

    const totalTargetQuota = targetProctors.reduce((sum, p) => sum + (Number(p.quota) || 0), 0);
    const totalTargetAssigned = targetProctors.reduce((sum, p) => sum + (p.assignedCount || 0), 0);

    return {
      filterRole: rFilter,
      targetProctors,
      proctorsCount: targetProctors.length,
      totalTargetQuota,
      totalTargetAssigned,
      complianceRate: totalTargetQuota > 0 ? Math.round((totalTargetAssigned / totalTargetQuota) * 100) : 100
    };
  }, [liveProctorStats, activeFiltersToUse]);

  // -------------------------------------------------------------
  // Academic Assistant Dossier Generator (Strictly Dynamic)
  // -------------------------------------------------------------
  const generateProctorBriefing = (proctor) => {
    const isAcademic = (proctor.type || 'academic') === 'academic';
    const quota = Number(proctor.quota) || 0;
    const assignedCount = Number(proctor.assignedCount) || 0;

    // Extract all room assignments for this proctor
    const assignments = [];
    allRooms.forEach(r => {
      if (r.proctors.includes(proctor.name)) {
        assignments.push({
          date: r.date,
          dayName: r.dayName,
          sessionNumber: r.sessionNumber,
          room: r.room,
          capacity: r.capacity,
          coProctor: r.proctors.find(name => name !== proctor.name) || null
        });
      }
    });

    // Group by date
    const assignmentsByDate = {};
    assignments.forEach(asgn => {
      if (!assignmentsByDate[asgn.date]) assignmentsByDate[asgn.date] = [];
      assignmentsByDate[asgn.date].push(asgn);
    });

    const datesWorked = Object.keys(assignmentsByDate);
    const daysWorkedCount = datesWorked.length;

    const threeSessionDays = [];
    const twoSessionDays = [];
    const singleSessionDays = [];

    datesWorked.forEach(dStr => {
      const sessCount = assignmentsByDate[dStr].length;
      if (sessCount >= 3) threeSessionDays.push(dStr);
      else if (sessCount === 2) twoSessionDays.push(dStr);
      else if (sessCount === 1) singleSessionDays.push(dStr);
    });

    const points = [];

    // 1. Quota & Contract Fulfilled (Strictly dynamic check)
    if (isAcademic) {
      if (assignedCount === quota) {
        points.push({
          title: 'استيفاء النصاب التعاقدي بدقة 100%:',
          text: `تم استيفاء النصاب التدريسي المقرر للزميل بالكامل (${assignedCount} جلسة من أصل ${quota} جلسة مطلوبة) بتفاضل صفر (لا يوجد أي عجز أو زيادة).`
        });
      } else if (assignedCount < quota) {
        points.push({
          title: `عجز في استيفاء النصاب التعاقدي (${quota - assignedCount} جلسة):`,
          text: `تنبيه تدقيق: جدول الزميل يحتوي على عجز بواقع (${quota - assignedCount}) جلسة (${assignedCount} منفذة من أصل ${quota} مطلوبة).`
        });
      } else {
        points.push({
          title: `زيادة فوق النصاب التعاقدي (+${assignedCount - quota} جلسة):`,
          text: `تنبيه تدقيق: تم تكليف الزميل بزيادة قدرها (${assignedCount - quota}) جلسة فوق النصاب المقرر (${assignedCount} منفذة من أصل ${quota} مطلوبة).`
        });
      }
    } else {
      if (assignedCount <= quota) {
        points.push({
          title: 'استيفاء السقف الإداري العادل:',
          text: `تم توزيع تكليفات الزميل بعدالة تامة ضمن كادر الإداريين بواقع (${assignedCount} جلسة من سقف ${quota} جلسة)، مع الالتزام بحد أقصى جلستين في اليوم الواحد لحماية تفرغه لمهامه الوظيفية.`
        });
      } else {
        points.push({
          title: `تجاوز السقف الإداري المحدد (+${assignedCount - quota} جلسة):`,
          text: `تنبيه تدقيق: تم تكليف الزميل بزيادة عن السقف الإداري المحدد بواقع (${assignedCount} منفذة من سقف ${quota}).`
        });
      }
    }

    // 2. Attendance Days & Sessions Clustering
    if (isAcademic) {
      if (quota <= 3 && daysWorkedCount === 1) {
        points.push({
          title: 'حصر النصاب في يوم دوام واحد:',
          text: `نظراً لأن نصاب الزميل قليل (${quota} جلسات)، تم حصر كامل مراقباته في يوم دوام واحد متتالٍ لتوفير وقته وجهده وتفريغ باقي أيام فترة الامتحانات بالكامل لصالحه.`
        });
      } else {
        if (twoSessionDays.length > 0) {
          points.push({
            title: `تجميع المراقبات في ثنائيات مريحة (${twoSessionDays.length} يوم):`,
            text: `تم تجميع جلسات الزميل في أيام ثنائية متصلة (1+2 أو 2+3) لتفادي إلزامه بالحضور إلى الجامعة من أجل جلسة واحدة منفردة، ولضمان استثمار يوم حضوره بأفضل صورة ممكنة.`
          });
        }
        if (threeSessionDays.length > 0) {
          points.push({
            title: `اليوم الثلاثي المبرر لتوفير أيام الحضور (${threeSessionDays.length} يوم):`,
            text: `تم تكليف الزميل بثلاث جلسات متتالية (1+2+3) في يوم واحد فقط بهدف تقليص إجمالي أيام مجيئه إلى الجامعة إلى (${daysWorkedCount} أيام فقط)، وتوفير يوم دوام كامل عليه.`
          });
        }
        if (singleSessionDays.length > 0) {
          points.push({
            title: `جلسات دوام منفردة (${singleSessionDays.length} يوم):`,
            text: `يتضمن جدول الزميل جلسة واحدة منفردة في الأيام: (${singleSessionDays.join('، ')}).`
          });
        }
      }
    }

    // 3. Dynamic Gap verification (Session 1 & 3 without 2)
    const gapDays = [];
    datesWorked.forEach(dStr => {
      const sessList = (assignmentsByDate[dStr] || []).map(a => Number(a.sessionNumber));
      if (sessList.includes(1) && sessList.includes(3) && !sessList.includes(2)) {
        gapDays.push(dStr);
      }
    });

    if (gapDays.length === 0) {
      points.push({
        title: 'خلو الجدول من فترات الفراغ والانتظار:',
        text: `تم التحقق رياضياً من عدم وجود أي فترات فراغ متباعدة في جدول الزميل (لا يوجد تكليف في الجلسة الأولى والثالثة مع فراغ الجلسة الثانية في أي يوم).`
      });
    } else {
      points.push({
        title: 'تنبيه: وجود فترات فراغ وانتظار (فجوة جلسات):',
        text: `يحتوي جدول الزميل على فترات انتظار متباعدة (جلسة 1 وجلسة 3 دون جلسة 2) في الأيام التالية: (${gapDays.join('، ')}).`
      });
    }

    // 4. Exclude Session 3 check
    if (proctor.excludeSession3) {
      const s3ViolatedDays = assignments.filter(a => Number(a.sessionNumber) === 3).map(a => `${a.dayName} (${a.date})`);
      if (s3ViolatedDays.length === 0) {
        points.push({
          title: 'احترام طلب استبعاد الجلسة الثالثة:',
          text: `تم تفعيل طلب الزميل باستبعاد الجلسة الثالثة بالكامل، ولم يتم تكليفه في أي جلسة ثالثة على الإطلاق طوال فترة الامتحانات.`
        });
      } else {
        points.push({
          title: 'تنبيه: مخالفة استبعاد الجلسة الثالثة:',
          text: `تم تكليف الزميل في الجلسة الثالثة في الأيام: (${s3ViolatedDays.join('، ')}) بالرغم من وجود استثناء مسجل.`
        });
      }
    }

    // 5. Apologies & Exceptions verification
    const exList = proctor.exceptions || [];
    if (exList.length > 0) {
      const exSet = new Set();
      exList.forEach(ex => {
        if (typeof ex === 'string') exSet.add(ex);
        else if (ex && ex.date) {
          if (ex.sessionNumber) exSet.add(`${ex.date}_s${ex.sessionNumber}`);
          else exSet.add(`${ex.date}_all`);
        }
      });

      const violatedDays = assignments
        .filter(a => exSet.has(`${a.date}_all`) || exSet.has(`${a.date}_s${a.sessionNumber}`))
        .map(a => `${a.date} (جلسة ${a.sessionNumber})`);

      if (violatedDays.length === 0) {
        points.push({
          title: 'احترام الاعتذارات والاستثناءات المدخلة مسبقاً بنسبة 100%:',
          text: `تم الالتزام بكافة طلبات الاعتذار والغياب المسجلة باسم الزميل مسبقاً (${exList.length} فترات/أيام)، ولم يتم إدراجه في أي جلسة منها نهائياً.`
        });
      } else {
        points.push({
          title: 'تنبيه: وجود تكليفات في فترات اعتذار مسجلة مسبقاً:',
          text: `تم تكليف الزميل في فترات اعتذار سابقة في: (${violatedDays.join('، ')}).`
        });
      }
    } else {
      points.push({
        title: 'الاعتذارات والاستثناءات المسبقة:',
        text: `لم يتقدم الزميل بأي اعتذارات أو استثناءات مسبقة قبل التوزيع، وجدول المواعيد جاء ملائماً ومطابقاً للجاهزية الكاملة.`
      });
    }

    return {
      assignments,
      daysWorkedCount,
      threeSessionDays,
      twoSessionDays,
      singleSessionDays,
      points
    };
  };

  // -------------------------------------------------------------
  // Printing Handlers (Strict Anti-Fragmentation & Pagination)
  // -------------------------------------------------------------
  const injectPrintStyle = (styleId, cssText) => {
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = cssText;
    return styleEl;
  };

  // 1. Print Schedule Audit (A4 Portrait)
  const handlePrintScheduleAudit = () => {
    if (isFiltersDirty) {
      showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
      return;
    }
    const styleId = 'dynamic-schedule-audit-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 7mm 7mm 7mm 7mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          font-size: 8.5pt !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .report-session-card {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          break-inside: avoid-page !important;
          margin-bottom: 5mm !important;
        }
        .report-session-card table {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .report-session-card table tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        * {
          overflow: visible !important;
          scrollbar-width: none !important;
        }
      }
    `);

    document.body.classList.add('printing-schedule-audit');
    setTimeout(() => window.print(), 180);

    const cleanup = () => {
      document.body.classList.remove('printing-schedule-audit');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  // 2. Print Portal Entry (A4 Portrait, Continuous Full Session, Session Unbroken)
  const handlePrintPortalEntry = () => {
    if (isFiltersDirty) {
      showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
      return;
    }
    const styleId = 'dynamic-portal-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 6mm 6mm 6mm 6mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          font-size: 8pt !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .portal-day-section {
          page-break-inside: auto !important;
          break-inside: auto !important;
          margin-bottom: 4mm !important;
        }
        .portal-session-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          break-inside: avoid-page !important;
          margin-bottom: 4mm !important;
        }
        .portal-session-block table {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .portal-session-block table tr {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .portal-session-block table th,
        .portal-session-block table td {
          padding: 2.5px 4px !important;
          font-size: 7.8pt !important;
          line-height: 1.15 !important;
        }
        * {
          overflow: visible !important;
          scrollbar-width: none !important;
        }
      }
    `);

    document.body.classList.add('printing-portal-entry');
    setTimeout(() => window.print(), 180);

    const cleanup = () => {
      document.body.classList.remove('printing-portal-entry');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  // 3. Print A3 Matrix (A3 Landscape - STRICT 1 PAGE)
  const handlePrintA3Matrix = () => {
    if (isFiltersDirty) {
      showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
      return;
    }
    const styleId = 'dynamic-a3-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A3 landscape !important;
          margin: 4mm 4mm 4mm 4mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-area-matrix {
          width: 100% !important;
          max-width: 412mm !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        .a3-matrix-table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-size: 6.8pt !important;
          line-height: 1.08 !important;
        }
        .a3-matrix-table th, .a3-matrix-table td {
          padding: 1.5px 1px !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          overflow: visible !important;
          scrollbar-width: none !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      }
    `);

    document.body.classList.add('printing-a3-mode');
    setTimeout(() => window.print(), 180);

    const cleanup = () => {
      document.body.classList.remove('printing-a3-mode');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  // 4. Print Academic Assistant Dossier (A4 Portrait - 1 Page per proctor)
  const handlePrintAssistantDossier = (target = 'single') => {
    if (isFiltersDirty) {
      showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
      return;
    }
    setAssistantPrintTarget(target);

    const styleId = 'dynamic-assistant-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 5mm 5mm 5mm 5mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .assistant-dossier-card {
          page-break-after: always !important;
          break-after: page !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          height: 98vh !important;
          max-height: 285mm !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          scrollbar-width: none !important;
        }
      }
    `);

    document.body.classList.add('printing-assistant-dossier');
    setTimeout(() => window.print(), 250);

    const cleanup = () => {
      document.body.classList.remove('printing-assistant-dossier');
      setAssistantPrintTarget(null);
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 5000);
  };

  // 5. Print Executive Summary (A4 Portrait - 1 Page)
  const handlePrintExecutiveSummary = () => {
    if (isFiltersDirty) {
      showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
      return;
    }
    const styleId = 'dynamic-exec-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 8mm 8mm 8mm 8mm !important;
        }
        html, body {
          width: 100% !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .executive-summary-page {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          scrollbar-width: none !important;
        }
      }
    `);

    document.body.classList.add('printing-executive-summary');
    setTimeout(() => window.print(), 180);

    const cleanup = () => {
      document.body.classList.remove('printing-executive-summary');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  // -------------------------------------------------------------
  // Quick Slot Mutation Helpers
  // -------------------------------------------------------------
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

      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor ? targetRoom.proctor.split('/').map(s => s.trim()) : [];
      }
      while (targetRoom.assignedProctors.length < cap) {
        targetRoom.assignedProctors.push('');
      }

      const oldName = targetRoom.assignedProctors[slotIndex] || '';
      targetRoom.assignedProctors[slotIndex] = newProctorName;
      targetRoom.proctor = targetRoom.assignedProctors.filter(Boolean).join(' / ');

      if (onLogActivity) {
        onLogActivity({
          action: 'reassign',
          dayName: day.dayName,
          date: day.date,
          sessionNumber,
          roomName: targetRoom.room || targetRoom.roomName,
          proctorName: newProctorName,
          details: `تعيين يدوي للزميل (${newProctorName || 'شاغر'}) مكان (${oldName || 'شاغر'}) في قاعة ${targetRoom.room || targetRoom.roomName} (جلسة ${sessionNumber})`
        });
      }

      return copy;
    });
    showToast(`✓ تم تحديث مقعد المراقبة بنجاح: ${newProctorName}`);
  };

  const handleApplySwap = (dayIndex, sessionNumber, sourceRoomIdx, sourceSlotIdx, targetRoomIdx, targetSlotIdx) => {
    if (!setScheduleDays) return;
    setScheduleDays(prevDays => {
      const copy = JSON.parse(JSON.stringify(prevDays));
      const day = copy[dayIndex];
      if (!day) return prevDays;
      const session = (day.sessions || []).find(s => s.sessionNumber === sessionNumber);
      if (!session) return prevDays;

      const rSource = session.rooms[sourceRoomIdx];
      const rTarget = session.rooms[targetRoomIdx];
      if (!rSource || !rTarget) return prevDays;

      const capS = Math.max(1, Number(rSource.capacity) || 1);
      const capT = Math.max(1, Number(rTarget.capacity) || 1);

      if (!Array.isArray(rSource.assignedProctors)) {
        rSource.assignedProctors = rSource.proctor ? rSource.proctor.split('/').map(s => s.trim()) : [];
      }
      if (!Array.isArray(rTarget.assignedProctors)) {
        rTarget.assignedProctors = rTarget.proctor ? rTarget.proctor.split('/').map(s => s.trim()) : [];
      }

      while (rSource.assignedProctors.length < capS) rSource.assignedProctors.push('');
      while (rTarget.assignedProctors.length < capT) rTarget.assignedProctors.push('');

      const p1 = rSource.assignedProctors[sourceSlotIdx] || '';
      const p2 = rTarget.assignedProctors[targetSlotIdx] || '';

      rSource.assignedProctors[sourceSlotIdx] = p2;
      rTarget.assignedProctors[targetSlotIdx] = p1;

      rSource.proctor = rSource.assignedProctors.filter(Boolean).join(' / ');
      rTarget.proctor = rTarget.assignedProctors.filter(Boolean).join(' / ');

      if (onLogActivity) {
        onLogActivity({
          action: 'swap',
          dayName: day.dayName,
          date: day.date,
          sessionNumber,
          roomName: `${rSource.room || rSource.roomName} ⇄ ${rTarget.room || rTarget.roomName}`,
          details: `تبديل متبادل بين (${p1 || 'شاغر'}) في ${rSource.room || rSource.roomName} و (${p2 || 'شاغر'}) في ${rTarget.room || rTarget.roomName} (جلسة ${sessionNumber})`
        });
      }

      return copy;
    });
    showToast(`⇄ تمت مبادلة المراقبين بين القاعتين بنجاح`);
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
      const oldName = (targetRoom.assignedProctors && targetRoom.assignedProctors[slotIndex]) || '';

      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor ? targetRoom.proctor.split('/').map(s => s.trim()) : [];
      }
      targetRoom.assignedProctors[slotIndex] = '';
      targetRoom.proctor = targetRoom.assignedProctors.filter(Boolean).join(' / ');

      if (onLogActivity && oldName) {
        onLogActivity({
          action: 'clear',
          dayName: day.dayName,
          date: day.date,
          sessionNumber,
          roomName: targetRoom.room || targetRoom.roomName,
          proctorName: oldName,
          details: `تفريغ مقعد الزميل (${oldName}) في قاعة ${targetRoom.room || targetRoom.roomName} (جلسة ${sessionNumber})`
        });
      }

      return copy;
    });
    showToast(`✓ تم تفريغ المقعد وجعله شاغراً`);
  };

  // -------------------------------------------------------------
  // Standard Official University Header (No Personal Names/Signatures)
  // -------------------------------------------------------------
  const renderOfficialHeader = (reportTitle, scopeDescription, extraRight = null) => {
    return (
      <div className="border-b-2 border-qou-primary pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-wide">
              جامعة القدس المفتوحة — فرع الخليل
            </h2>
            <h3 className="text-xs sm:text-sm font-bold text-qou-primary">
              قسم الامتحانات
            </h3>
            <p className="text-[10px] text-slate-600 mt-0.5">
              الفصل الدراسي: <strong>{semesterCode}</strong> | نوع الامتحان: <strong>{examType}</strong>
            </p>
          </div>

          <div className="text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1 flex items-center justify-center">
              <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xs sm:text-base font-black text-slate-900">
              {reportTitle}
            </h1>
            <div className="text-[10px] text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 inline-block mt-0.5 font-bold">
              نطاق المخرجات: {scopeDescription}
            </div>
          </div>

          <div className="text-left text-[10px] text-slate-500 space-y-0.5">
            <div>تاريخ الاستخراج: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
            {extraRight}
          </div>
        </div>
      </div>
    );
  };

  // Standard Official University Footer (Clean, No Signatures, No Personal Names)
  const renderOfficialFooter = (pageInfo = null) => {
    return (
      <div className="border-t border-slate-200 pt-2 mt-4 flex items-center justify-between text-[10px] text-slate-500 font-bold font-mono">
        <span>جامعة القدس المفتوحة — فرع الخليل</span>
        {pageInfo && <span className="text-slate-700">{pageInfo}</span>}
        <span>قسم الامتحانات</span>
      </div>
    );
  };

  // -------------------------------------------------------------
  // Dossier Card Single Page Renderer (Academic Assistant)
  // -------------------------------------------------------------
  const renderProctorDossierCard = (proctor, pageNum, totalPages, isPrint = false) => {
    if (!proctor) return null;
    const briefing = generateProctorBriefing(proctor);
    const isAcademic = (proctor.type || 'academic') === 'academic';
    const quota = Number(proctor.quota) || 0;
    const assignedCount = Number(proctor.assignedCount) || 0;
    const hasManyAssignments = briefing.assignments.length > 7;

    const half = Math.ceil(briefing.assignments.length / 2);
    const col1 = briefing.assignments.slice(0, half);
    const col2 = briefing.assignments.slice(half);

    return (
      <div 
        key={proctor.id} 
        className={`assistant-dossier-card bg-white rounded-2xl border border-slate-200 shadow-sm ${
          isPrint ? 'p-3.5' : 'p-6'
        } space-y-3 flex flex-col justify-between`}
      >
        {/* Official Header */}
        {renderOfficialHeader(
          'ملف إحاطة المساعد الأكاديمي وتبريرات التوزيع',
          `الزميل: ${proctor.name} (${isAcademic ? 'كادر أكاديمي' : 'كادر إداري'})`,
          <div>الصفحة: <strong className="text-slate-800 font-mono">{pageNum} من {totalPages}</strong></div>
        )}

        <div className="space-y-3 flex-1">
          {/* Proctor Metadata Strip */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px]">اسم الزميل:</span>
              <strong className="text-slate-900 font-black">{proctor.name}</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">التصنيف الوظيفي:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-[10px] inline-block ${
                isAcademic ? 'bg-indigo-100 text-indigo-900' : 'bg-amber-100 text-amber-900'
              }`}>
                {isAcademic ? 'عضو هيئة تدريسية (نصاب تعاقدي)' : 'كادر إداري (سقف تفرغ)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">النصاب / المنفذ:</span>
              <strong className="text-slate-900 font-mono">
                {assignedCount} من {quota} جلسة
              </strong>
              <span className={`mr-1 text-[10px] font-bold ${
                proctor.difference === 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                ({proctor.difference === 0 ? 'مستوفى 100%' : `${proctor.difference > 0 ? '+' : ''}${proctor.difference}`})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">أيام الحضور الفعلية:</span>
              <strong className="text-slate-900 font-mono">
                {briefing.daysWorkedCount} أيام من أصل {scheduleDays.length}
              </strong>
            </div>
          </div>

          {/* Section 1: Detailed Schedule Table */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-qou-primary" />
                <span>أولاً: جدول مواعيد وقاعات المراقبة المسندة للزميل:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                إجمالي التكليفات: <strong>{briefing.assignments.length}</strong> جلسة
              </span>
            </h4>

            {hasManyAssignments ? (
              /* Two columns for dense schedules */
              <div className="grid grid-cols-2 gap-2">
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-right text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[9.5px]">
                        <th className="py-1 px-1.5 w-6 text-center border-l border-slate-200">#</th>
                        <th className="py-1 px-2 border-l border-slate-200 font-black">اليوم والتاريخ</th>
                        <th className="py-1 px-1.5 w-14 text-center border-l border-slate-200 font-black">الجلسة</th>
                        <th className="py-1 px-1.5 w-16 text-center border-l border-slate-200 font-black">القاعة</th>
                        <th className="py-1 px-2">الزميل المشترك</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {col1.map((asgn, aIdx) => (
                        <tr key={aIdx} className="hover:bg-slate-50/80">
                          <td className="py-0.5 px-1.5 text-center text-slate-400 font-mono border-l border-slate-200">
                            {aIdx + 1}
                          </td>
                          <td className="py-0.5 px-2 font-bold text-slate-900 border-l border-slate-200 whitespace-nowrap">
                            {asgn.dayName} <span className="text-[8.5px] font-mono text-slate-500">({asgn.date})</span>
                          </td>
                          <td className="py-0.5 px-1.5 text-center border-l border-slate-200">
                            <span className="bg-slate-100 px-1 py-0.5 rounded text-[9px] font-bold text-slate-700">
                              جلسة {asgn.sessionNumber}
                            </span>
                          </td>
                          <td className="py-0.5 px-1.5 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/50 whitespace-nowrap">
                            قاعة {asgn.room}
                          </td>
                          <td className="py-0.5 px-2 truncate max-w-[100px]" title={asgn.coProctor || 'منفردة'}>
                            {asgn.coProctor ? (
                              <span className="text-indigo-900 font-semibold text-[9px]">
                                {asgn.coProctor}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[9px]">منفردة</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-right text-[10px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[9.5px]">
                        <th className="py-1 px-1.5 w-6 text-center border-l border-slate-200">#</th>
                        <th className="py-1 px-2 border-l border-slate-200 font-black">اليوم والتاريخ</th>
                        <th className="py-1 px-1.5 w-14 text-center border-l border-slate-200 font-black">الجلسة</th>
                        <th className="py-1 px-1.5 w-16 text-center border-l border-slate-200 font-black">القاعة</th>
                        <th className="py-1 px-2">الزميل المشترك</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {col2.map((asgn, aIdx) => (
                        <tr key={aIdx} className="hover:bg-slate-50/80">
                          <td className="py-0.5 px-1.5 text-center text-slate-400 font-mono border-l border-slate-200">
                            {half + aIdx + 1}
                          </td>
                          <td className="py-0.5 px-2 font-bold text-slate-900 border-l border-slate-200 whitespace-nowrap">
                            {asgn.dayName} <span className="text-[8.5px] font-mono text-slate-500">({asgn.date})</span>
                          </td>
                          <td className="py-0.5 px-1.5 text-center border-l border-slate-200">
                            <span className="bg-slate-100 px-1 py-0.5 rounded text-[9px] font-bold text-slate-700">
                              جلسة {asgn.sessionNumber}
                            </span>
                          </td>
                          <td className="py-0.5 px-1.5 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/50 whitespace-nowrap">
                            قاعة {asgn.room}
                          </td>
                          <td className="py-0.5 px-2 truncate max-w-[100px]" title={asgn.coProctor || 'منفردة'}>
                            {asgn.coProctor ? (
                              <span className="text-indigo-900 font-semibold text-[9px]">
                                {asgn.coProctor}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[9px]">منفردة</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-[10.5px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[10px]">
                      <th className="py-1 px-3 w-10 text-center border-l border-slate-200">#</th>
                      <th className="py-1 px-3 border-l border-slate-200 font-black">اليوم والتاريخ</th>
                      <th className="py-1 px-3 w-24 text-center border-l border-slate-200 font-black">رقم الجلسة</th>
                      <th className="py-1 px-3 w-28 text-center border-l border-slate-200 font-black">القاعة المسندة</th>
                      <th className="py-1 px-3 border-l border-slate-200">طبيعة التكليف والزميل المشترك</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {briefing.assignments.map((asgn, aIdx) => (
                      <tr key={aIdx} className="hover:bg-slate-50/80">
                        <td className="py-1 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                          {aIdx + 1}
                        </td>
                        <td className="py-1 px-3 font-bold text-slate-900 border-l border-slate-200">
                          {asgn.dayName} <span className="font-mono text-slate-500 text-[9.5px]">({asgn.date})</span>
                        </td>
                        <td className="py-1 px-3 text-center border-l border-slate-200">
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-700 text-[9.5px]">
                            جلسة {asgn.sessionNumber}
                          </span>
                        </td>
                        <td className="py-1 px-3 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/50">
                          قاعة {asgn.room}
                        </td>
                        <td className="py-1 px-3 border-l border-slate-200">
                          {asgn.coProctor ? (
                            <span className="text-indigo-900 font-bold flex items-center gap-1 text-[9.5px]">
                              <Users className="w-3 h-3 text-indigo-600 shrink-0" />
                              <span>مشتركة مع الزميل: <strong>{asgn.coProctor}</strong></span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[9.5px]">مراقبة منفردة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Administrative Justifications */}
          <div className="space-y-1">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              <span>ثانياً: الموجز الإداري وتبريرات التوزيع للمساعد الأكاديمي:</span>
            </h4>

            <div className="bg-gradient-to-r from-emerald-50/40 to-indigo-50/30 border border-emerald-200/80 rounded-xl p-2.5 space-y-1">
              {briefing.points.map((pt, pIdx) => (
                <div key={pIdx} className="flex items-start gap-2 text-[10px]">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-[8.5px] mt-0.5">
                    {pIdx + 1}
                  </span>
                  <div className="space-y-0.5 leading-snug">
                    <strong className="text-slate-900 font-black">{pt.title} </strong>
                    <span className="text-slate-700">{pt.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Official Clean Footer */}
        {renderOfficialFooter(`صفحة ${pageNum} من ${totalPages}`)}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Report Tab 1: Schedule & Room Capacity Audit (كشف تدقيق القاعات والجلسات)
  // -------------------------------------------------------------
  const renderScheduleAuditReport = () => {
    return (
      <div className="print-area print-area-schedule-audit bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-6">
        
        {/* Official University Header */}
        {renderOfficialHeader(
          'كشف تدقيق القاعات والجلسات الامتحانية',
          appliedFilters?.portalDayFilter !== 'all' || appliedFilters?.portalSessionFilter !== 'all' || appliedFilters?.portalSearch
            ? 'مخرجات مفلترة حسب الخيارات المحددة'
            : 'شامل (كافة الأيام والجلسات الامتحانية)',
          <div>
            <div>إجمالي القاعات: <strong>{filteredScheduleStats.roomsCount}</strong></div>
            <div>مقاعد المراقبة المطلوبة: <strong>{filteredScheduleStats.proctorSlotsCount}</strong></div>
          </div>
        )}

        {/* Clear Mathematical Distinction Strip: Rooms vs Proctor Slots */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="border-l border-slate-200 last:border-l-0">
            <span className="text-[11px] text-slate-500 block font-bold">عدد القاعات الفعلية المجدولة</span>
            <strong className="text-slate-900 text-lg font-black">{filteredScheduleStats.roomsCount} قاعة</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">ظهور القاعات بالجلسات</span>
          </div>

          <div className="border-l border-slate-200 last:border-l-0">
            <span className="text-[11px] text-qou-primary block font-bold">مقاعد المراقبة المطلوبة (وفق السعات)</span>
            <strong className="text-qou-primary text-lg font-black">{filteredScheduleStats.proctorSlotsCount} مقعداً</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">بما فيها القاعات متعددة السعة</span>
          </div>

          <div className="border-l border-slate-200 last:border-l-0">
            <span className="text-[11px] text-emerald-700 block font-bold">المقاعد المسندة فعلياً</span>
            <strong className="text-emerald-950 text-lg font-black">{filteredScheduleStats.assignedSlots} مقعداً</strong>
            <span className="text-[10px] text-emerald-700 block mt-0.5">
              تغطية {filteredScheduleStats.proctorSlotsCount > 0 ? Math.round((filteredScheduleStats.assignedSlots / filteredScheduleStats.proctorSlotsCount) * 100) : 0}%
            </span>
          </div>

          <div>
            <span className="text-[11px] text-indigo-700 block font-bold">تفصيل سعات القاعات</span>
            <div className="text-[10px] text-slate-700 space-y-0.5 mt-1 font-bold">
              <span>{filteredScheduleStats.singleRooms} منفردة (1)</span> | 
              <span className="text-amber-800"> {filteredScheduleStats.multi2Rooms} مزدوجة (2)</span> | 
              <span className="text-purple-800"> {filteredScheduleStats.multi3Rooms} مدرج (3)</span>
            </div>
          </div>
        </div>

        {/* Days and Sessions Detailed Breakdown */}
        {filteredScheduleData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-bold text-sm">
            لا توجد قاعات أو جلسات مطابقة لخيارات الفلترة الحالية.
          </div>
        ) : (
          filteredScheduleData.map((dayGroup, dIdx) => (
            <div key={dIdx} className="space-y-4">
              
              {/* Day Header Banner */}
              <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-2 rounded-lg font-black text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>{dayGroup.dayName}</span>
                  <span className="font-mono text-slate-300 text-[11px]">({dayGroup.date})</span>
                </div>
                <div className="text-[11px] text-slate-300 font-normal">
                  عدد جلسات اليوم: <strong>{dayGroup.sessions.length}</strong> | 
                  إجمالي قاعات اليوم: <strong>{dayGroup.sessions.reduce((acc, s) => acc + s.rooms.length, 0)}</strong> | 
                  مقاعد المراقبة المطلوبة: <strong>{dayGroup.sessions.reduce((acc, s) => acc + s.rooms.reduce((rAcc, r) => rAcc + r.capacity, 0), 0)}</strong>
                </div>
              </div>

              {/* Sessions in this day */}
              <div className="space-y-4">
                {dayGroup.sessions.map((sessGroup, sIdx) => {
                  const sessRoomsCount = sessGroup.rooms.length;
                  const sessSlotsCount = sessGroup.rooms.reduce((acc, r) => acc + r.capacity, 0);

                  return (
                    <div key={sIdx} className="report-session-card bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                      
                      {/* Session Title Bar */}
                      <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-800 text-white text-[10px] font-black px-2 py-0.5 rounded">
                            {dayGroup.dayName} ({dayGroup.date})
                          </span>
                          <span className="font-black text-qou-primary">
                            الجلسة الامتحانية رقم ({sessGroup.sessionNumber})
                          </span>
                        </div>
                        <div className="text-[10.5px] text-slate-600 font-bold space-x-2 space-x-reverse">
                          <span>عدد القاعات: <strong>{sessRoomsCount}</strong></span>
                          <span>•</span>
                          <span>مقاعد المراقبة المطلوبة: <strong>{sessSlotsCount}</strong></span>
                        </div>
                      </div>

                      {/* Rooms and Capacities Table */}
                      <table className="w-full text-right text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                            <th className="py-2 px-2.5 w-10 text-center border-l border-slate-200">#</th>
                            <th className="py-2 px-3 w-28 text-center border-l border-slate-200 font-black">رقم القاعة</th>
                            <th className="py-2 px-3 w-32 text-center border-l border-slate-200 font-black">السعة المقررة</th>
                            <th className="py-2 px-4 border-l border-slate-200 font-black">المراقبون المسندون للمقاعد</th>
                            <th className="py-2 px-3 w-28 text-center border-l border-slate-200">حالة التغطية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px]">
                          {sessGroup.rooms.map((roomItem, rIdx) => {
                            const cap = roomItem.capacity;
                            const assignedList = roomItem.proctors.filter(Boolean);
                            const isFull = assignedList.length >= cap;

                            return (
                              <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-1.5 px-2 text-center text-slate-400 font-mono border-l border-slate-200">
                                  {rIdx + 1}
                                </td>

                                <td className="py-1.5 px-3 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/40">
                                  قاعة {roomItem.room}
                                </td>

                                <td className="py-1.5 px-3 text-center border-l border-slate-200">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    cap >= 3 ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                                    cap === 2 ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                    'bg-slate-100 text-slate-700'
                                  }`}>
                                    {cap >= 3 ? '3 مراقبين (مدرج)' : cap === 2 ? 'مراقبان (مشترك)' : 'مراقب منفرد (1)'}
                                  </span>
                                </td>

                                <td className="py-1.5 px-4 font-bold text-slate-900 border-l border-slate-200">
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {Array.from({ length: cap }).map((_, slotIdx) => {
                                      const pName = roomItem.proctors[slotIdx] || '';
                                      return (
                                        <span 
                                          key={slotIdx}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                            pName 
                                              ? 'bg-slate-50 text-slate-900 border-slate-200' 
                                              : 'bg-rose-50 text-rose-700 border-rose-200'
                                          }`}
                                        >
                                          {pName ? `مراقب ${slotIdx + 1}: ${pName}` : `مقعد ${slotIdx + 1}: شاغر`}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </td>

                                <td className="py-1.5 px-3 text-center border-l border-slate-200 font-bold">
                                  {isFull ? (
                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                                      مكتمل ({assignedList.length}/{cap})
                                    </span>
                                  ) : (
                                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200">
                                      شاغر ({assignedList.length}/{cap})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Clean Official Footer */}
        {renderOfficialFooter()}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Report Tab 2: Portal Entry Guide (كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة)
  // -------------------------------------------------------------
  const renderPortalEntryReport = () => {
    return (
      <div className="print-area print-area-portal bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-6">
        
        {/* Official University Header */}
        {renderOfficialHeader(
          'كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة الرسمي',
          appliedFilters?.portalDayFilter !== 'all' || appliedFilters?.portalSessionFilter !== 'all' || appliedFilters?.portalRoleFilter !== 'all' || appliedFilters?.portalSearch
            ? 'مخرجات مفلترة حسب الخيارات المحددة'
            : 'شامل (كافة الأيام والجلسات والمراقبين)',
          <div>
            <div>إجمالي القاعات المعروضة: <strong>{filteredScheduleStats.roomsCount}</strong></div>
            <div>مقاعد المراقبة: <strong>{filteredScheduleStats.proctorSlotsCount}</strong></div>
          </div>
        )}

        {/* Hierarchical Schedule: Days -> Sessions -> Rooms */}
        {filteredScheduleData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-bold text-sm">
            لا توجد قاعات أو جلسات مطابقة لخيارات الفلترة الحالية.
          </div>
        ) : (
          filteredScheduleData.map((dayGroup, dIdx) => (
            <div key={dIdx} className="portal-day-section space-y-4">
              
              {/* Day Header Banner */}
              <div className="flex items-center justify-between bg-slate-800 text-white px-4 py-2 rounded-lg font-black text-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400" />
                  <span>{dayGroup.dayName}</span>
                  <span className="font-mono text-slate-300 text-[11px]">({dayGroup.date})</span>
                </div>
                <div className="text-[11px] text-slate-300 font-normal">
                  عدد جلسات اليوم: <strong>{dayGroup.sessions.length}</strong> | 
                  إجمالي قاعات اليوم: <strong>{dayGroup.sessions.reduce((s, x) => s + x.rooms.length, 0)}</strong>
                </div>
              </div>

              {/* Sessions within this Day */}
              <div className="space-y-4">
                {dayGroup.sessions.map((sessGroup, sIdx) => (
                  <div key={sIdx} className="portal-session-block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                    
                    {/* Session Header with Day & Session Context - Continuous and Unbroken */}
                    <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-800 text-white text-[10.5px] font-black px-2.5 py-0.5 rounded flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span>{dayGroup.dayName}</span>
                          <span className="font-mono text-slate-200 text-[9.5px]">({dayGroup.date})</span>
                        </span>

                        <span className="font-black text-xs text-qou-primary flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-qou-primary" />
                          <span>الجلسة الامتحانية رقم ({sessGroup.sessionNumber})</span>
                        </span>
                      </div>

                      <span className="text-[10.5px] text-slate-600 font-bold">
                        {sessGroup.rooms.length} قاعات مجدولة
                      </span>
                    </div>

                    {/* Rooms Table */}
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                          <th className="py-2 px-2.5 w-10 text-center border-l border-slate-200">#</th>
                          <th className="py-2 px-3 w-28 text-center border-l border-slate-200 font-black">القاعة</th>
                          <th className="py-2 px-2.5 w-24 text-center border-l border-slate-200">السعة المطلوبة</th>
                          <th className="py-2 px-3 border-l border-slate-200 font-black">المراقب الأول (الأساسي)</th>
                          <th className="py-2 px-3 border-l border-slate-200">المراقب الثاني (إن وجد)</th>
                          <th className="py-2 px-3 w-40 text-center border-l border-slate-200">المراقب الثالث (إن وجد)</th>
                          <th className="py-2 px-2 text-center w-24 no-print">إجراء سريع</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {sessGroup.rooms.map((roomItem, rIdx) => {
                          const cap = roomItem.capacity;
                          const p1 = roomItem.proctors[0] || '';
                          const p2 = roomItem.proctors[1] || '';
                          const p3 = roomItem.proctors[2] || '';

                          return (
                            <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-1.5 px-2 text-center text-slate-400 font-mono border-l border-slate-200">
                                {rIdx + 1}
                              </td>

                              <td className="py-1.5 px-3 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/40">
                                قاعة {roomItem.room}
                              </td>

                              <td className="py-1.5 px-2.5 text-center border-l border-slate-200">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  cap >= 3 ? 'bg-purple-100 text-purple-900 border border-purple-200' :
                                  cap === 2 ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {cap >= 3 ? '3 مراقبين (مدرج)' : cap === 2 ? 'مراقبان (مشترك)' : 'مراقب منفرد'}
                                </span>
                              </td>

                              <td className="py-1.5 px-3 font-bold text-slate-900 border-l border-slate-200">
                                {p1 ? (
                                  <span className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                    <span>{p1}</span>
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-bold text-[10px]">-- شاغر --</span>
                                )}
                              </td>

                              <td className="py-1.5 px-3 border-l border-slate-200">
                                {cap >= 2 ? (
                                  p2 ? (
                                    <span className="flex items-center gap-1.5 font-bold text-slate-900">
                                      <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span>{p2}</span>
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold text-[10px]">-- شاغر (المراقب الثاني) --</span>
                                  )
                                ) : (
                                  <span className="text-slate-300 font-mono text-[10px]">-</span>
                                )}
                              </td>

                              <td className="py-1.5 px-3 text-center border-l border-slate-200">
                                {cap >= 3 ? (
                                  p3 ? (
                                    <span className="flex items-center justify-center gap-1.5 font-bold text-slate-900">
                                      <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                      <span>{p3}</span>
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-bold text-[10px]">-- شاغر (المراقب الثالث) --</span>
                                  )
                                ) : (
                                  <span className="text-slate-300 font-mono text-[10px]">-</span>
                                )}
                              </td>

                              <td className="py-1.5 px-2 text-center no-print">
                                <button
                                  type="button"
                                  onClick={() => setActiveSwapSlot({
                                    dayIndex: roomItem.dayIndex,
                                    date: roomItem.date,
                                    dayName: roomItem.dayName,
                                    sessionNumber: roomItem.sessionNumber,
                                    roomIndex: roomItem.roomIndex,
                                    roomName: roomItem.room,
                                    slotIndex: 0,
                                    currentProctor: p1
                                  })}
                                  className="text-indigo-700 hover:text-indigo-900 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 cursor-pointer"
                                  title="تعديل أو تبديل المراقب المسند"
                                >
                                  تبديل / تعيين
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {/* Clean Official Footer */}
        {renderOfficialFooter()}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Report Tab 3: A3 Matrix (مصفوفة تفريغ ومتابعة المراقبين)
  // -------------------------------------------------------------
  const renderMatrixReport = () => {
    return (
      <div className="print-area print-area-matrix bg-white rounded-2xl border border-slate-200 shadow-sm p-3 lg:p-4 space-y-4">
        
        {/* Official University Header */}
        {renderOfficialHeader(
          'كشف مصفوفة تفريغ ومتابعة المراقبين الرسمية المعتمدة',
          appliedFilters?.matrixRoleFilter !== 'all' || appliedFilters?.matrixSearch
            ? 'مخرجات مفلترة حسب الخيارات المحددة'
            : 'شامل (كافة المراقبين والأيام والجلسات)',
          <div>
            <div>عدد المراقبين: <strong>{filteredMatrixRows.length}</strong></div>
            <div>المقاس المعتمد للطباعة: <strong>صفحة واحدة A3 بالعرض</strong></div>
          </div>
        )}

        {/* Dense Grid matching single page A3 Landscape */}
        <div className="overflow-x-auto border border-slate-300 rounded-lg">
          <table className="a3-matrix-table w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white text-[9.5px] font-black border-b border-slate-700">
                <th rowSpan="2" className="py-1 px-1 w-6 text-center border-l border-slate-700">#</th>
                <th rowSpan="2" className="py-1 px-2.5 w-36 text-right border-l border-slate-700">اسم الزميل المراقب</th>
                <th rowSpan="2" className="py-1 px-1 w-12 text-center border-l border-slate-700">الكادر</th>
                <th rowSpan="2" className="py-1 px-1 w-10 text-center border-l border-slate-700">النصاب</th>
                <th rowSpan="2" className="py-1 px-1 w-10 text-center border-l-2 border-slate-900 bg-slate-900">المنفذ</th>

                {/* Day Header Cells */}
                {(scheduleDays || []).map((day, dIdx) => (
                  <th 
                    key={dIdx} 
                    colSpan={(day.sessions || []).length}
                    className="py-1 px-1 text-center border-l-2 border-slate-900 bg-slate-700 text-white font-bold"
                  >
                    <div>{day.dayName}</div>
                    <div className="text-[7.5px] text-slate-300 font-mono font-normal">({day.date})</div>
                  </th>
                ))}
              </tr>

              {/* Subheader: Sessions 1, 2, 3 */}
              <tr className="bg-slate-700 text-white text-[8px] font-bold border-b border-slate-600">
                {matrixSessions.map((sess, sIdx) => {
                  const isDayLast = !matrixSessions[sIdx + 1] || matrixSessions[sIdx + 1].dayIndex !== sess.dayIndex;
                  return (
                    <th 
                      key={sIdx}
                      className={`py-0.5 px-0.5 text-center ${isDayLast ? 'border-l-2 border-slate-900' : 'border-l border-slate-600'}`}
                    >
                      ج{sess.sessionNumber}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMatrixRows.length === 0 ? (
                <tr>
                  <td colSpan={5 + matrixSessions.length} className="py-8 text-center text-slate-400 font-bold">
                    لا توجد نتائج مطابقة لخيارات البحث أو الفلترة.
                  </td>
                </tr>
              ) : (
                filteredMatrixRows.map((p, idx) => {
                  const quota = Number(p.quota) || 0;
                  const assigned = p.assignedCount || 0;
                  const isAcademic = (p.type || 'academic') === 'academic';

                  return (
                    <tr key={p.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-0.5 px-0.5 border border-slate-300 text-[8.5px] font-mono text-slate-500 text-center bg-slate-50">
                        {idx + 1}
                      </td>

                      <td className="py-0.5 px-2 border border-slate-300 text-right font-black text-slate-900 text-[9.5px] truncate max-w-[140px] bg-white">
                        {p.name}
                      </td>

                      <td className="py-0.5 px-0.5 border border-slate-300 text-[8px] text-center">
                        <span className={`px-1 py-0.2 rounded font-bold ${
                          isAcademic ? 'bg-indigo-50 text-indigo-800' : 'bg-amber-50 text-amber-800'
                        }`}>
                          {isAcademic ? 'أكاديمي' : 'إداري'}
                        </span>
                      </td>

                      <td className="py-0.5 px-0.5 border border-slate-300 font-bold text-slate-700 text-[9px] text-center">
                        {quota}
                      </td>

                      <td className="py-0.5 px-0.5 border border-slate-300 font-black text-qou-primary text-[9.5px] text-center border-l-2 border-slate-800 bg-slate-50">
                        {assigned}
                      </td>

                      {/* Session Assignments */}
                      {p.sessionAssignments.map((cell, cIdx) => {
                        const isDayLast = !matrixSessions[cIdx + 1] || matrixSessions[cIdx + 1].dayIndex !== matrixSessions[cIdx].dayIndex;
                        return (
                          <td
                            key={cIdx}
                            className={`py-0.5 px-0.5 border border-slate-300 text-[8pt] text-center ${
                              isDayLast ? 'border-l-2 border-slate-800' : ''
                            } ${
                              cell.status === 'assigned'
                                ? cell.isMulti 
                                  ? 'bg-indigo-50/90 text-indigo-950 font-black' 
                                  : 'bg-emerald-50/90 text-emerald-950 font-black'
                                : cell.status === 'apology'
                                  ? 'bg-rose-50 text-rose-700 text-[6.5pt] font-bold'
                                  : 'text-slate-300 font-normal'
                            }`}
                            title={cell.status === 'assigned' ? `قاعة ${cell.room}` : cell.status === 'apology' ? 'معتذر' : 'فارغ'}
                          >
                            {cell.status === 'assigned' ? (
                              <span>{cell.text}</span>
                            ) : cell.status === 'apology' ? (
                              <span>معتذر</span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Clean Official Footer */}
        {renderOfficialFooter()}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Report Tab 4: Academic Assistant Dossier (ملف إحاطة المساعد الأكاديمي)
  // -------------------------------------------------------------
  const renderAcademicAssistantReport = () => {
    return (
      <div className="space-y-6">
        {filteredAssistantProctors.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 font-bold">
            لا يوجد مراقبون مطابقون لخيارات الفلترة المحددة.
          </div>
        ) : (
          filteredAssistantProctors.map((proctor, pIdx) =>
            renderProctorDossierCard(
              proctor, 
              pIdx + 1, 
              filteredAssistantProctors.length,
              assistantPrintTarget !== null
            )
          )
        )}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Report Tab 5: Executive Summary (التقرير التنفيذي)
  // -------------------------------------------------------------
  const renderExecutiveReport = () => {
    return (
      <div className="executive-summary-page bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8 space-y-6">
        
        {/* Official University Header */}
        {renderOfficialHeader(
          'التقرير التنفيذي لمؤشرات وإحصائيات خطة المراقبات',
          appliedFilters?.execRoleFilter !== 'all'
            ? `نطاق مصفى (${appliedFilters?.execRoleFilter === 'academic' ? 'الكادر الأكاديمي' : 'الكادر الإداري'})`
            : 'شامل (كافة الكوادر والمقاعد المجدولة)',
          <div>
            <div>تاريخ الاعتماد: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
            <div>حالة التغطية: <strong className="text-emerald-700">{liveAudit.fulfillmentRate}%</strong></div>
          </div>
        )}

        {/* 4 Analytical KPI Metric Blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-600 block">إجمالي المقاعد المطلوبة</span>
            <strong className="text-slate-900 text-lg font-black">{liveAudit.totalCapacityRequired} مقعداً</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">{liveAudit.totalRoomsCount} قاعة مجدولة</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-600 block">المقاعد المغطاة والمسندة</span>
            <strong className="text-slate-900 text-lg font-black">{liveAudit.totalAssignedSlots} مقعداً</strong>
            <span className="text-[10px] text-emerald-700 block mt-0.5 font-bold">نسبة التغطية {liveAudit.fulfillmentRate}%</span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-600 block">استيفاء الكادر الأكاديمي</span>
            <strong className="text-slate-900 text-lg font-black">
              {liveAudit.academicFullComplianceCount} / {liveAudit.academicCount} أستاذ
            </strong>
            <span className="text-[10px] text-indigo-700 block mt-0.5 font-bold">
              {liveAudit.academicTotalAssigned} من {liveAudit.academicTotalQuota} جلسة
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
            <span className="text-[11px] font-bold text-slate-600 block">التكليفات الإدارية</span>
            <strong className="text-slate-900 text-lg font-black">
              {liveAudit.adminCount} موظف
            </strong>
            <span className="text-[10px] text-amber-700 block mt-0.5 font-bold">
              {liveAudit.adminTotalAssigned} جلسة من سقف {liveAudit.adminTotalQuota}
            </span>
          </div>
        </div>

        {/* Audit Engine Live Findings Breakdown */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>نتائج التدقيق الرياضي والتحقق من القيود المؤسسية:</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700">تعارضات المراقب في نفس الجلسة:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  liveAudit.sameSessionConflicts.length === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {liveAudit.sameSessionConflicts.length === 0 ? 'صفر تعارض (سليم)' : `${liveAudit.sameSessionConflicts.length} تعارضات`}
                </span>
              </div>

              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700">فجوات انتظار الأكاديميين (جلسة 1 و 3 دون 2):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  liveAudit.academicGapViolationsCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {liveAudit.academicGapViolationsCount === 0 ? 'صفر فجوات (سليم)' : `${liveAudit.academicGapViolationsCount} فجوات`}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700">احترام طلبات الاعتذار والغياب المسجلة:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  liveAudit.exceptionViolationsTotal === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {liveAudit.exceptionViolationsTotal === 0 ? 'احترام كامل (صفر مخالفات)' : `${liveAudit.exceptionViolationsTotal} مخالفة`}
                </span>
              </div>

              <div className="flex items-center justify-between font-bold">
                <span className="text-slate-700">تجاوز الحد اليومي للإداريين (أكثر من جلستين):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  liveAudit.adminDailyOverloadCount === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {liveAudit.adminDailyOverloadCount === 0 ? 'صفر تجاوزات (سليم)' : `${liveAudit.adminDailyOverloadCount} تجاوزات`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Days Distribution Summary Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-qou-primary" />
            <span>توزيع التغطية الميدانية يوماً بيوم:</span>
          </h4>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold text-[11px] border-b border-slate-200">
                  <th className="py-2 px-3 border-l border-slate-200">اليوم والتاريخ</th>
                  <th className="py-2 px-3 text-center border-l border-slate-200">عدد الجلسات</th>
                  <th className="py-2 px-3 text-center border-l border-slate-200">عدد القاعات</th>
                  <th className="py-2 px-3 text-center border-l border-slate-200 font-black">المقاعد المطلوبة</th>
                  <th className="py-2 px-3 text-center border-l border-slate-200">المقاعد المسندة</th>
                  <th className="py-2 px-3 text-center">حالة التغطية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {(scheduleDays || []).map((day, dIdx) => {
                  let dayRooms = 0;
                  let daySlots = 0;
                  let dayFilled = 0;

                  (day.sessions || []).forEach(s => {
                    (s.rooms || []).forEach(r => {
                      dayRooms++;
                      const cap = Math.max(1, Number(r.capacity) || 1);
                      daySlots += cap;
                      const assigned = Array.isArray(r.assignedProctors) 
                        ? r.assignedProctors.filter(Boolean).length 
                        : (r.proctor ? 1 : 0);
                      dayFilled += assigned;
                    });
                  });

                  return (
                    <tr key={dIdx} className="hover:bg-slate-50">
                      <td className="py-1.5 px-3 font-bold text-slate-900 border-l border-slate-200">
                        {day.dayName} <span className="text-[10px] text-slate-500 font-mono">({day.date})</span>
                      </td>
                      <td className="py-1.5 px-3 text-center border-l border-slate-200">
                        {(day.sessions || []).length}
                      </td>
                      <td className="py-1.5 px-3 text-center border-l border-slate-200">
                        {dayRooms}
                      </td>
                      <td className="py-1.5 px-3 text-center font-black text-slate-900 border-l border-slate-200">
                        {daySlots}
                      </td>
                      <td className="py-1.5 px-3 text-center font-bold text-emerald-800 border-l border-slate-200">
                        {dayFilled}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        {dayFilled >= daySlots ? (
                          <span className="text-emerald-700 font-bold text-[10px]">مكتمل 100%</span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[10px]">شواغر ({daySlots - dayFilled})</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clean Official Footer */}
        {renderOfficialFooter()}
      </div>
    );
  };

  // -------------------------------------------------------------
  // Filter Scope Description Builder
  // -------------------------------------------------------------
  const currentScopeDescription = useMemo(() => {
    if (activeReportTab === 'schedule_audit' || activeReportTab === 'portal_entry') {
      const parts = [];
      if (portalDayFilter && portalDayFilter !== 'all') parts.push(portalDayFilter);
      if (portalSessionFilter && portalSessionFilter !== 'all') parts.push(`جلسة ${portalSessionFilter}`);
      if (portalRoleFilter && portalRoleFilter !== 'all') parts.push(portalRoleFilter === 'academic' ? 'كادر أكاديمي' : 'كادر إداري');
      if (portalSearch.trim()) parts.push(`بحث: "${portalSearch.trim()}"`);
      return parts.length > 0 ? parts.join(' | ') : 'شامل (الجميع)';
    }

    if (activeReportTab === 'matrix') {
      const parts = [];
      if (matrixRoleFilter && matrixRoleFilter !== 'all') parts.push(matrixRoleFilter === 'academic' ? 'كادر أكاديمي' : 'كادر إداري');
      if (matrixSearch.trim()) parts.push(`بحث: "${matrixSearch.trim()}"`);
      return parts.length > 0 ? parts.join(' | ') : 'شامل (كافة المراقبين والأيام - 43 مراقباً)';
    }

    if (activeReportTab === 'academic_assistant') {
      if (selectedAssistantProctorId && selectedAssistantProctorId !== 'all') {
        const found = liveProctorStats.find(p => p.id === selectedAssistantProctorId);
        return found ? `الزميل: ${found.name}` : 'مراقب محدد';
      }
      const parts = ['شامل (كافة المراقبين - صفحة A4 مستقلة لكل زميل)'];
      if (assistantRoleFilter && assistantRoleFilter !== 'all') parts.push(assistantRoleFilter === 'academic' ? 'كادر أكاديمي' : 'كادر إداري');
      if (assistantSearch.trim()) parts.push(`بحث: "${assistantSearch.trim()}"`);
      return parts.join(' | ');
    }

    if (activeReportTab === 'executive') {
      if (execRoleFilter === 'academic') return 'الكادر الأكاديمي فقط';
      if (execRoleFilter === 'administrative') return 'الكادر الإداري فقط';
      return 'شامل (كافة الكوادر والمقاعد المجدولة)';
    }

    return 'شامل (الجميع)';
  }, [
    activeReportTab,
    portalDayFilter, portalSessionFilter, portalRoleFilter, portalSearch,
    matrixRoleFilter, matrixSearch,
    selectedAssistantProctorId, assistantRoleFilter, assistantSearch,
    execRoleFilter, liveProctorStats
  ]);

  // -------------------------------------------------------------
  // Render Main Layout
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================
          TOP CONTROL PANEL: REPORT SELECTOR & DYNAMIC FILTERS
          (Clean Interface: All 6 requested banner/KPI elements removed)
         ========================================================= */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5 space-y-4">
        
        {/* Top Header: Title & Semester Badge Only */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-qou-primary"></span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-wide">
              مركز التقارير والمخرجات الرسمية
            </h2>
            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-slate-200 font-mono">
              فصل {semesterCode} — {examType}
            </span>
          </div>

          <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
            <span className="text-slate-400">التقرير النشط:</span>
            <span className="text-qou-primary font-black">
              {activeReportTab === 'schedule_audit' && 'كشف تدقيق القاعات والجلسات'}
              {activeReportTab === 'portal_entry' && 'كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة'}
              {activeReportTab === 'matrix' && 'مصفوفة تفريغ ومتابعة المراقبين'}
              {activeReportTab === 'academic_assistant' && 'ملف إحاطة المساعد الأكاديمي'}
              {activeReportTab === 'executive' && 'التقرير التنفيذي'}
            </span>
          </div>
        </div>

        {/* 5 Official Reports Horizontal Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          
          {/* Report 1 */}
          <button
            type="button"
            onClick={() => handleTabChange('schedule_audit')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeReportTab === 'schedule_audit'
                ? 'border-qou-primary bg-qou-primary text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-80">تقرير 1</span>
              <FileText className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-xs font-black leading-snug">
              كشف تدقيق القاعات والجلسات
            </div>
            <div className="text-[10px] mt-1 opacity-80">
              A4 طولي (فصل القاعات عن المقاعد)
            </div>
          </button>

          {/* Report 2 */}
          <button
            type="button"
            onClick={() => handleTabChange('portal_entry')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeReportTab === 'portal_entry'
                ? 'border-qou-primary bg-qou-primary text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-80">تقرير 2</span>
              <FileBadge className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-xs font-black leading-snug">
              كشف إدخال بورتال الجامعة
            </div>
            <div className="text-[10px] mt-1 opacity-80">
              A4 طولي (تسكين المراقبين)
            </div>
          </button>

          {/* Report 3 */}
          <button
            type="button"
            onClick={() => handleTabChange('matrix')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeReportTab === 'matrix'
                ? 'border-qou-primary bg-qou-primary text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-80">تقرير 3</span>
              <LayoutGrid className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-xs font-black leading-snug">
              مصفوفة تفريغ ومتابعة المراقبين
            </div>
            <div className="text-[10px] mt-1 opacity-80">
              صفحة واحدة A3 بالعرض
            </div>
          </button>

          {/* Report 4 */}
          <button
            type="button"
            onClick={() => handleTabChange('academic_assistant')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeReportTab === 'academic_assistant'
                ? 'border-qou-primary bg-qou-primary text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-80">تقرير 4</span>
              <Award className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-xs font-black leading-snug">
              ملف إحاطة المساعد الأكاديمي
            </div>
            <div className="text-[10px] mt-1 opacity-80">
              صفحة A4 مستقلة لكل مراقب
            </div>
          </button>

          {/* Report 5 */}
          <button
            type="button"
            onClick={() => handleTabChange('executive')}
            className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between cursor-pointer ${
              activeReportTab === 'executive'
                ? 'border-qou-primary bg-qou-primary text-white shadow-md'
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono opacity-80">تقرير 5</span>
              <Sparkles className="w-4 h-4 opacity-90" />
            </div>
            <div className="text-xs font-black leading-snug">
              التقرير التنفيذي
            </div>
            <div className="text-[10px] mt-1 opacity-80">
              صفحة A4 (المؤشرات والحضور)
            </div>
          </button>

        </div>

        {/* Dynamic Filters Section (Tailored to active report) */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
          
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-qou-primary" />
              <span>فلاتر ومحددات التقرير المحدد:</span>
            </span>
            <span className="text-slate-500 font-normal">
              خيار «الجميع» يتيح استخراج وطباعة كامل البيانات الرسمية دون تقييد
            </span>
          </div>

          {/* FILTERS FOR REPORT 1 (Schedule Audit) & REPORT 2 (Portal Entry) */}
          {(activeReportTab === 'schedule_audit' || activeReportTab === 'portal_entry') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
              
              {/* Day Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">اليوم والتاريخ:</label>
                <select
                  value={portalDayFilter}
                  onChange={(e) => setPortalDayFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">📅 جميع الأيام (الجميع)</option>
                  {(scheduleDays || []).map((d, idx) => (
                    <option key={idx} value={`${d.dayName} (${d.date})`}>
                      {d.dayName} ({d.date})
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الجلسة:</label>
                <select
                  value={portalSessionFilter}
                  onChange={(e) => setPortalSessionFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">⏰ جميع الجلسات (الجميع)</option>
                  <option value="1">الجلسة الأولى (1)</option>
                  <option value="2">الجلسة الثانية (2)</option>
                  <option value="3">الجلسة الثالثة (3)</option>
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">نوع الكادر:</label>
                <select
                  value={portalRoleFilter}
                  onChange={(e) => setPortalRoleFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">👥 جميع الكوادر (الجميع)</option>
                  <option value="academic">الكادر الأكاديمي فقط</option>
                  <option value="administrative">الكادر الإداري فقط</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث برقم القاعة أو الاسم:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                  <input
                    type="text"
                    value={portalSearch}
                    onChange={(e) => setPortalSearch(e.target.value)}
                    placeholder="ابحث برقم القاعة أو اسم المراقب..."
                    className="w-full bg-white border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-bold text-slate-800 placeholder-slate-400 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                  />
                </div>
              </div>

            </div>
          )}

          {/* FILTERS FOR REPORT 3 (Matrix) */}
          {activeReportTab === 'matrix' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصنيف الكادر بالمصفوفة:</label>
                <select
                  value={matrixRoleFilter}
                  onChange={(e) => setMatrixRoleFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">👥 جميع المراقبين (43 مراقباً - الجميع)</option>
                  <option value="academic">الكادر الأكاديمي فقط (27 أستاذاً)</option>
                  <option value="administrative">الكادر الإداري فقط (16 موظفاً)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث باسم المراقب:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="اكتب اسم المراقب للتصفية المباشرة..."
                    className="w-full bg-white border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-bold text-slate-800 placeholder-slate-400 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <span className="text-[11px] text-slate-500 font-normal">
                  * تطبع مصفوفة المخرجات الكاملة أو المفلترة في <strong>صفحة واحدة A3 بالعرض</strong> بدقة كاملة.
                </span>
              </div>
            </div>
          )}

          {/* FILTERS FOR REPORT 4 (Academic Assistant Dossier) */}
          {activeReportTab === 'academic_assistant' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">نطاق المراقبين:</label>
                <select
                  value={selectedAssistantProctorId}
                  onChange={(e) => setSelectedAssistantProctorId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-black text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">📚 جميع المراقبين (الجميع - طباعة بطاقة مستقلة A4 لكل زميل)</option>
                  
                  <optgroup label="كادر الأكاديميين (27 أستاذاً):">
                    {liveProctorStats.filter(p => (p.type || 'academic') === 'academic').map(p => (
                      <option key={p.id} value={p.id}>
                        🎓 {p.name} (نصاب: {p.quota} | منفذ: {p.assignedCount})
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="كادر الإداريين (16 موظفاً):">
                    {liveProctorStats.filter(p => p.type === 'administrative').map(p => (
                      <option key={p.id} value={p.id}>
                        💼 {p.name} (سقف: {p.quota} | منفذ: {p.assignedCount})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث بالاسم:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2" />
                  <input
                    type="text"
                    value={assistantSearch}
                    onChange={(e) => setAssistantSearch(e.target.value)}
                    placeholder="ابحث باسم الزميل..."
                    className="w-full bg-white border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-bold text-slate-800 placeholder-slate-400 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                  />
                </div>
              </div>

            </div>
          )}

          {/* FILTERS FOR REPORT 5 (Executive Summary) */}
          {activeReportTab === 'executive' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">نطاق تحليل الكوادر:</label>
                <select
                  value={execRoleFilter}
                  onChange={(e) => setExecRoleFilter(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 text-xs focus:ring-1 focus:ring-qou-primary focus:outline-none"
                >
                  <option value="all">📊 شامل (كافة الكوادر والمقاعد)</option>
                  <option value="academic">الكادر الأكاديمي فقط</option>
                  <option value="administrative">الكادر الإداري فقط</option>
                </select>
              </div>

              <div className="flex items-end">
                <span className="text-[11px] text-slate-500 font-normal">
                  * التقرير التنفيذي ملخص فعلي ومستخرج حياً من محرك التدقيق الرياضي في صفحة واحدة A4.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* =========================================================
            OUTPUT ACTION BAR: SEPARATED VISUALLY FROM FILTERS
           ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          
          {/* Main Display & Update Action Button */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExecuteView}
              className={`text-xs font-black px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer ${
                isFiltersDirty || !hasExecutedView
                  ? 'bg-qou-primary hover:bg-qou-dark text-white ring-2 ring-qou-primary/40 animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <Eye className="w-4 h-4" />
              <span>{hasExecutedView && isFiltersDirty ? 'تحديث العرض (لتطبيق الفلاتر الجديدة)' : 'عرض النتائج'}</span>
            </button>

            {/* Reset Filters Button */}
            <button
              type="button"
              onClick={handleResetFilters}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="إعادة الفلاتر إلى خيار الجميع"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إلغاء الفلاتر</span>
            </button>
          </div>

          {/* Export & Print Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Print / PDF Button */}
            <button
              type="button"
              disabled={!hasExecutedView || isFiltersDirty}
              onClick={() => {
                if (isFiltersDirty) {
                  showToast('⚠️ يرجى الضغط على «تحديث العرض» أولاً لاعتماد التعديلات قبل الطباعة');
                  return;
                }
                if (activeReportTab === 'schedule_audit') handlePrintScheduleAudit();
                else if (activeReportTab === 'portal_entry') handlePrintPortalEntry();
                else if (activeReportTab === 'matrix') handlePrintA3Matrix();
                else if (activeReportTab === 'academic_assistant') handlePrintAssistantDossier('single');
                else if (activeReportTab === 'executive') handlePrintExecutiveSummary();
              }}
              className={`text-xs font-black px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-2 ${
                !hasExecutedView || isFiltersDirty
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-black text-white cursor-pointer'
              }`}
              title={
                !hasExecutedView 
                  ? 'اضغط عرض النتائج أولاً لتفعيل الطباعة' 
                  : isFiltersDirty 
                  ? 'يلزم تحديث العرض قبل الطباعة لمطابقة المخرجات' 
                  : 'طباعة النتائج المعروضة حالياً بصيغة PDF'
              }
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير (PDF)</span>
            </button>

            {/* Special Bulk Dossier Print for Academic Assistant */}
            {activeReportTab === 'academic_assistant' && hasExecutedView && selectedAssistantProctorId === 'all' && (
              <button
                type="button"
                disabled={isFiltersDirty}
                onClick={() => {
                  setConfirmConfig({
                    title: 'تأكيد تجهيز وطباعة ملف الإحاطة الشامل (43 صفحة PDF)',
                    message: 'أنت على وشك توليد وطباعة الكتيب التبريري الشامل لكافة الزملاء المراقبين دفعة واحدة.',
                    consequences: [
                      `سيقوم النظام بتوليد ${filteredAssistantProctors.length} صفحة A4 مستقلة (صفحة واحدة لكل مراقب بتفاضل صفر وبدون أي انقسام).`,
                      'ستفتح نافذة الطباعة لاختيار الحفظ كملف PDF على جهازك أو إرساله للطابعة.',
                      'تم ترتيب الزملاء وفق البروتوكول الجامعي المعتمد: الأكاديميون أولاً ثم الإداريون أبجدياً.'
                    ],
                    confirmText: `متابعة تجهيز الملف (${filteredAssistantProctors.length} صفحة)`,
                    cancelText: 'تراجع',
                    variant: 'primary',
                    onConfirm: () => handlePrintAssistantDossier('all')
                  });
                }}
                className={`text-xs font-bold px-3 py-2.5 rounded-xl border transition flex items-center gap-1.5 ${
                  isFiltersDirty
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200 cursor-pointer'
                }`}
                title="طباعة الملف الشامل لكافة الزملاء (صفحة مستقلة لكل زميل)"
              >
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>طباعة الملف الشامل (43 صفحة)</span>
              </button>
            )}

            {/* Excel Export Button (Matched with active report) */}
            {hasExecutedView && (
              <button
                type="button"
                onClick={() => {
                  if (activeReportTab === 'schedule_audit' || activeReportTab === 'portal_entry') {
                    if (appliedFilters?.portalDayFilter !== 'all' || appliedFilters?.portalSessionFilter !== 'all' || appliedFilters?.portalRoleFilter !== 'all') {
                      exportFilteredResultsExcel(
                        allRooms.filter(item => {
                          const { portalDayFilter: d, portalSessionFilter: s, portalRoleFilter: r } = appliedFilters;
                          if (d !== 'all' && `${item.dayName} (${item.date})` !== d) return false;
                          if (s !== 'all' && String(item.sessionNumber) !== String(s)) return false;
                          return true;
                        }),
                        currentScopeDescription,
                        semesterCode,
                        examType
                      );
                    } else {
                      exportPortalEntryExcel(scheduleDays, semesterCode, examType);
                    }
                  } else if (activeReportTab === 'matrix') {
                    exportProctorsMatrixExcel(scheduleDays, proctors, semesterCode, examType);
                  } else if (activeReportTab === 'executive') {
                    exportExecutiveSummaryExcel(scheduleDays, proctors, semesterCode, examType);
                  }
                }}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                title="تصدير بيانات التقرير الحالي إلى ملف Excel معتمد"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير إكسل (Excel)</span>
              </button>
            )}

          </div>

        </div>

      </div>

      {/* =========================================================
          WARNING BANNER: STALE FILTERS NOT APPLIED YET
         ========================================================= */}
      {hasExecutedView && isFiltersDirty && (
        <div className="no-print bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-bold">
              تم تعديل خيارات الفلترة أعلاه. يلزم الضغط على زر «تحديث العرض» لتطبيق الاختيارات الجديدة قبل استعراض النتائج أو طباعة الـ PDF.
            </span>
          </div>

          <button
            type="button"
            onClick={handleExecuteView}
            className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0"
          >
            تحديث العرض الآن
          </button>
        </div>
      )}

      {/* =========================================================
          VIEW STATE 1: INITIAL EMPTY STATE (PROMPT USER TO SELECT & VIEW)
         ========================================================= */}
      {!hasExecutedView && (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm animate-in fade-in duration-300">
          <div className="w-16 h-16 mx-auto bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-qou-primary">
            <ListChecks className="w-8 h-8" />
          </div>

          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">
              اختر التقرير وحدد الفلاتر ثم اضغط «عرض النتائج»
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              تتيح لك المنظومة تخصيص الفلاتر بدقة أو اختيار «الجميع» لاستعراض وطباعة كامل المخرجات الرسمية بنقاء ودقة متناهية ودون أي اجتزاء.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleExecuteView}
              className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3 rounded-xl shadow-md transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>عرض نتائج {
                activeReportTab === 'schedule_audit' ? 'كشف تدقيق القاعات والجلسات' :
                activeReportTab === 'portal_entry' ? 'كشف إدخال بورتال الجامعة' :
                activeReportTab === 'matrix' ? 'مصفوفة تفريغ ومتابعة المراقبين' :
                activeReportTab === 'academic_assistant' ? 'ملف إحاطة المساعد الأكاديمي' :
                'التقرير التنفيذي'
              }</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          VIEW STATE 2: RENDERED REPORT CONTENT (ONLY AFTER EXECUTION)
         ========================================================= */}
      {hasExecutedView && (
        <div className="space-y-6">
          {activeReportTab === 'schedule_audit' && renderScheduleAuditReport()}
          {activeReportTab === 'portal_entry' && renderPortalEntryReport()}
          {activeReportTab === 'matrix' && renderMatrixReport()}
          {activeReportTab === 'academic_assistant' && renderAcademicAssistantReport()}
          {activeReportTab === 'executive' && renderExecutiveReport()}
        </div>
      )}

      {/* Quick Swap & Slot Assignment Modal */}
      {activeSwapSlot && (
        <QuickSwapModal
          isOpen={Boolean(activeSwapSlot)}
          onClose={() => setActiveSwapSlot(null)}
          slot={activeSwapSlot}
          proctors={liveProctorStats}
          scheduleDays={scheduleDays}
          allRooms={allRooms}
          onApplyReassign={handleApplyReassign}
          onApplySwap={handleApplySwap}
          onApplyClear={handleApplyClear}
        />
      )}

      {/* Dual-choice Confirmation Modal */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          onClose={() => setConfirmConfig(null)}
          title={confirmConfig.title}
          message={confirmConfig.message}
          consequences={confirmConfig.consequences}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          variant={confirmConfig.variant}
          onConfirm={() => {
            confirmConfig.onConfirm?.();
            setConfirmConfig(null);
          }}
        />
      )}

    </div>
  );
}
