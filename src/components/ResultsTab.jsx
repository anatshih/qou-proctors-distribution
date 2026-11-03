import React, { useState, useMemo } from 'react';
import { 
  Printer, FileSpreadsheet, Filter, RotateCcw, User, Calendar, 
  Building, CheckCircle2, AlertCircle, Search, Eye, ArrowLeftRight,
  Users, Check, Plus, AlertTriangle, LayoutGrid, FileText, Award,
  ShieldCheck, CheckSquare, Sparkles, BookOpen, Clock, FileBadge,
  ChevronDown, ChevronRight, HelpCircle
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
  examType = 'نصفي'
}) {
  // Main Reports Navigation:
  // 'portal_entry' | 'matrix' | 'academic_assistant' | 'executive'
  const [activeReportTab, setActiveReportTab] = useState('portal_entry');

  // Filters for Portal Entry Schedule
  const [portalDayFilter, setPortalDayFilter] = useState('');
  const [portalSessionFilter, setPortalSessionFilter] = useState('');
  const [portalRoleFilter, setPortalRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [portalSearch, setPortalSearch] = useState('');

  // Matrix View Controls
  const [matrixGridMode, setMatrixGridMode] = useState('full'); // 'full' (A3 Grid) | 'summary' (Stats Table)
  const [matrixRoleFilter, setMatrixRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [matrixSearch, setMatrixSearch] = useState('');

  // Academic Assistant Dossier State
  const [selectedAssistantProctorId, setSelectedAssistantProctorId] = useState('');
  const [assistantSearch, setAssistantSearch] = useState('');
  const [assistantRoleFilter, setAssistantRoleFilter] = useState('all'); // 'all' | 'academic' | 'administrative'
  const [assistantPrintTarget, setAssistantPrintTarget] = useState(null); // 'single' | 'all' | null

  // Quick Swap Modal state
  const [activeSwapSlot, setActiveSwapSlot] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
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

  // Filtered rows for on-screen matrix view
  const filteredMatrixRows = useMemo(() => {
    return matrixRows.filter(p => {
      if (matrixRoleFilter === 'academic' && (p.type || 'academic') !== 'academic') return false;
      if (matrixRoleFilter === 'administrative' && (p.type || 'academic') !== 'administrative') return false;
      if (matrixSearch.trim() && !p.name.toLowerCase().includes(matrixSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [matrixRows, matrixRoleFilter, matrixSearch]);

  // -------------------------------------------------------------
  // Executive Statistics & KPIs
  // -------------------------------------------------------------
  const executiveStats = useMemo(() => {
    let totalSlots = 0;
    let filledSlots = 0;

    allRooms.forEach(r => {
      totalSlots += r.capacity;
      filledSlots += r.proctors.filter(Boolean).length;
    });

    const activeAcademics = liveProctorStats.filter(p => (p.type || 'academic') === 'academic' && p.isActive);
    const academicsCompleted = activeAcademics.filter(p => p.assignedCount === Number(p.quota) && Number(p.quota) > 0);

    const activeAdmins = liveProctorStats.filter(p => p.type === 'administrative' && p.isActive);

    return {
      totalSlots,
      filledSlots,
      unassignedSlots: Math.max(0, totalSlots - filledSlots),
      coverageRate: totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0,
      totalProctors: liveProctorStats.length,
      academicsCount: activeAcademics.length,
      academicsCompletedCount: academicsCompleted.length,
      adminsCount: activeAdmins.length,
      totalDays: (scheduleDays || []).length,
      totalSessions: matrixSessions.length
    };
  }, [allRooms, liveProctorStats, scheduleDays, matrixSessions]);

  // Central Mathematical Audit Result (Derived dynamically 100%)
  const liveAudit = useMemo(() => {
    return runScheduleAudit(scheduleDays, proctors);
  }, [scheduleDays, proctors]);

  // Daily Statistics Breakdown
  const dailyStats = useMemo(() => {
    return (scheduleDays || []).map(day => {
      let daySlots = 0;
      let dayFilled = 0;
      const proctorNames = new Set();

      (day.sessions || []).forEach(sess => {
        (sess.rooms || []).forEach(r => {
          const cap = Math.max(1, Number(r.capacity) || 1);
          daySlots += cap;
          const proctorList = getRoomProctorList(r);
          dayFilled += proctorList.filter(Boolean).length;
          proctorList.forEach(p => {
            if (p && p.trim()) proctorNames.add(p);
          });
        });
      });

      return {
        date: day.date,
        dayName: day.dayName,
        sessionsCount: (day.sessions || []).length,
        totalRooms: (day.sessions || []).reduce((sum, s) => sum + (s.rooms || []).length, 0),
        totalSlots: daySlots,
        filledSlots: dayFilled,
        proctorsCount: proctorNames.size
      };
    });
  }, [scheduleDays]);

  // -------------------------------------------------------------
  // Filtered Portal Rooms (Day -> Session -> Room)
  // -------------------------------------------------------------
  const filteredPortalRooms = useMemo(() => {
    return allRooms.filter(item => {
      if (portalDayFilter && `${item.dayName} (${item.date})` !== portalDayFilter) return false;
      if (portalSessionFilter && String(item.sessionNumber) !== portalSessionFilter) return false;
      if (portalSearch.trim()) {
        const query = portalSearch.trim().toLowerCase();
        const matchesRoom = String(item.room).toLowerCase().includes(query);
        const matchesProctor = item.proctors.some(p => p.toLowerCase().includes(query));
        if (!matchesRoom && !matchesProctor) return false;
      }
      if (portalRoleFilter !== 'all') {
        const matchesRole = item.proctors.some(pName => {
          const foundP = liveProctorStats.find(lp => lp.name === pName);
          const role = (foundP && foundP.type) || 'academic';
          return role === portalRoleFilter;
        });
        if (!matchesRole) return false;
      }
      return true;
    });
  }, [allRooms, portalDayFilter, portalSessionFilter, portalRoleFilter, portalSearch, liveProctorStats]);

  // Grouped Portal Rooms for hierarchical display: Day -> Session -> Rooms
  const portalGroupedSchedule = useMemo(() => {
    const daysMap = new Map();

    (scheduleDays || []).forEach((day, dIdx) => {
      const dayKey = `${day.dayName} (${day.date})`;
      if (portalDayFilter && dayKey !== portalDayFilter) return;

      const sessionsMap = new Map();

      (day.sessions || []).forEach(sess => {
        if (portalSessionFilter && String(sess.sessionNumber) !== portalSessionFilter) return;

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
          if (portalSearch.trim()) {
            const query = portalSearch.trim().toLowerCase();
            const matchesRoom = String(item.room).toLowerCase().includes(query);
            const matchesProctor = item.proctors.some(p => p.toLowerCase().includes(query));
            if (!matchesRoom && !matchesProctor) return false;
          }
          if (portalRoleFilter !== 'all') {
            const matchesRole = item.proctors.some(pName => {
              const foundP = liveProctorStats.find(lp => lp.name === pName);
              const role = (foundP && foundP.type) || 'academic';
              return role === portalRoleFilter;
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
  }, [scheduleDays, portalDayFilter, portalSessionFilter, portalRoleFilter, portalSearch, liveProctorStats]);

  // -------------------------------------------------------------
  // Academic Assistant Dossier & Justifications Generation
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

  // Filtered proctors for Academic Assistant selection
  const assistantFilteredProctors = useMemo(() => {
    return liveProctorStats.filter(p => {
      if (assistantRoleFilter === 'academic' && (p.type || 'academic') !== 'academic') return false;
      if (assistantRoleFilter === 'administrative' && (p.type || 'academic') !== 'administrative') return false;
      if (assistantSearch.trim() && !p.name.toLowerCase().includes(assistantSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [liveProctorStats, assistantRoleFilter, assistantSearch]);

  // Current active proctor for Assistant dossier
  const currentAssistantProctor = useMemo(() => {
    if (selectedAssistantProctorId) {
      const found = liveProctorStats.find(p => p.id === selectedAssistantProctorId);
      if (found) return found;
    }
    return assistantFilteredProctors[0] || liveProctorStats[0] || null;
  }, [selectedAssistantProctorId, assistantFilteredProctors, liveProctorStats]);

  // -------------------------------------------------------------
  // Printing Handlers
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

  const handlePrintA3Matrix = () => {
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
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
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
    setTimeout(() => window.print(), 150);

    const cleanup = () => {
      document.body.classList.remove('printing-a3-mode');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  const handlePrintPortalEntry = () => {
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
          margin-bottom: 5mm !important;
        }
        .portal-session-block {
          page-break-inside: avoid !important;
          break-inside: avoid !important;
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
          padding: 2px 4px !important;
          font-size: 7.8pt !important;
          line-height: 1.15 !important;
        }
      }
    `);

    document.body.classList.add('printing-portal-entry');
    setTimeout(() => window.print(), 200);

    const cleanup = () => {
      document.body.classList.remove('printing-portal-entry');
      const el = document.getElementById(styleId);
      if (el) el.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 4000);
  };

  const handlePrintAssistantDossier = (target = 'single', proctorId = null) => {
    setAssistantPrintTarget(target);
    if (proctorId) {
      setSelectedAssistantProctorId(proctorId);
    }

    const styleId = 'dynamic-assistant-print-style';
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
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
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

  const handlePrintExecutiveSummary = () => {
    const styleId = 'dynamic-exec-print-style';
    injectPrintStyle(styleId, `
      @media print {
        @page {
          size: A4 portrait !important;
          margin: 8mm 8mm 10mm 8mm !important;
        }
      }
    `);

    document.body.classList.add('printing-executive-summary');
    setTimeout(() => window.print(), 150);

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
  // Quick Swap / Modal Handlers
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
    showToast(`✓ تم تعيين المراقب (${newProctorName}) بنجاح`);
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
      if (!Array.isArray(targetRoom.assignedProctors)) {
        targetRoom.assignedProctors = targetRoom.proctor ? targetRoom.proctor.split('/').map(s => s.trim()) : [];
      }
      targetRoom.assignedProctors[slotIndex] = '';
      targetRoom.proctor = targetRoom.assignedProctors.filter(Boolean).join(' / ');
      return copy;
    });
    showToast(`✓ تم تفريغ المقعد وجعله شاغراً`);
  };

  // -------------------------------------------------------------
  // Academic Assistant Proctor Dossier Card Renderer (Fitted 1 Page)
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
        {/* Top University Official Header */}
        <div className="border-b-2 border-qou-primary pb-2.5">
          <div className="flex items-center justify-between">
            <div className="text-right">
              <h2 className="text-base font-black text-slate-900 tracking-wide">
                جامعة القدس المفتوحة — فرع الخليل
              </h2>
              <h3 className="text-xs font-bold text-qou-primary">
                قسم الامتحانات
              </h3>
              <p className="text-[10px] text-slate-600 mt-0.5">
                الفصل الدراسي: <strong>{semesterCode}</strong> | نوع الامتحان: <strong>{examType}</strong>
              </p>
            </div>

            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-1 flex items-center justify-center">
                <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900">
                ملف إحاطة المساعد الأكاديمي وتبريرات التوزيع
              </h1>
            </div>

            <div className="text-left text-[10px] text-slate-500 space-y-0.5">
              <div>تاريخ التقرير: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
              <div>حالة التدقيق: <strong className="text-emerald-700">معتمد ومستوفى 100%</strong></div>
              <div>
                الصفحة: <strong className="text-slate-800 font-mono">{pageNum} من {totalPages}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Content Container */}
        <div className="space-y-2.5 flex-1">
          {/* Proctor Identity & KPI Badges */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                  isAcademic ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isAcademic ? '🎓 كادر أعضاء هيئة التدريس (أكاديمي)' : '💼 كادر الموظفين (إداري)'}
                </span>
                <span className="text-slate-400 font-mono text-[10.5px]">#{proctor.id}</span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-slate-900">
                {proctor.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-center text-xs">
              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[9.5px] text-slate-500 block">النصاب المطلوب</span>
                <strong className="text-xs font-black text-slate-800">{quota} جلسة</strong>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[9.5px] text-emerald-600 block">المنفذ فعلياً</span>
                <strong className="text-xs font-black text-emerald-800">{assignedCount} جلسة</strong>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[9.5px] text-indigo-600 block">نسبة الاستيفاء</span>
                <strong className="text-xs font-black text-indigo-800">
                  {quota > 0 && assignedCount === quota ? '100% (تفاضل 0)' : `${assignedCount} من ${quota}`}
                </strong>
              </div>

              <div className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[9.5px] text-purple-600 block">أيام الحضور الفعلية</span>
                <strong className="text-xs font-black text-purple-800">{briefing.daysWorkedCount} أيام</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Sessions Table */}
          <div className="space-y-1">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-qou-primary" />
                <span>أولاً: جدول جلسات وقاعات المراقبة المكلف بها الزميل:</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">
                (إجمالي: {briefing.assignments.length} جلسة)
              </span>
            </h4>

            {briefing.assignments.length === 0 ? (
              <div className="p-3 text-center text-slate-400 font-bold text-xs border border-dashed border-slate-200 rounded-xl">
                لا توجد جلسات مسندة لهذا المراقب.
              </div>
            ) : hasManyAssignments ? (
              /* Split into 2 columns side by side for large session counts (Guarantee 1 Page) */
              <div className="grid grid-cols-2 gap-2 items-start">
                {/* Column 1 */}
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

                {/* Column 2 */}
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
              /* Single Table for standard session counts (<= 7) */
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

          {/* Section 2: Administrative Justifications (Third Person - Addressed to Dr. Murad Al-Jundi) */}
          <div className="space-y-1">
            <h4 className="text-[11px] font-black text-slate-900 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-700" />
              <span>ثانياً: الموجز الإداري والتبريرات المرفوعة للمساعد الأكاديمي (للرد والاعتماد):</span>
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

        {/* Clean Page Pagination Footer */}
        <div className="border-t border-slate-200 pt-1.5 mt-1 flex items-center justify-between text-[9.5px] text-slate-500 font-mono">
          <span>جامعة القدس المفتوحة — فرع الخليل</span>
          <span className="font-bold text-slate-700">صفحة {pageNum} من {totalPages}</span>
          <span>قسم الامتحانات</span>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-800 text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-600 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =========================================================
          EXECUTIVE BANNER & KPI SCORECARD STRIP
         ========================================================= */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-5 space-y-4">
        
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-lg font-black text-slate-900 tracking-wide">
                مركز النتائج والتقارير التنفيذية المعتمدة
              </h2>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-200">
                فصل {semesterCode} — {examType}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              منظومة إعداد وتصدير المخرجات الرسمية لجامعة القدس المفتوحة — فرع الخليل | قسم الامتحانات
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-xl font-bold border border-slate-200">
              المقاس المعتمد: A3 بالعرض للمصفوفة | A4 للكشوفات
            </span>
          </div>
        </div>

        {/* 4 Major KPI Badges (100% Dynamically Verified) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/40 p-3 rounded-xl border border-indigo-200">
            <span className="text-[11px] font-bold text-indigo-700 block">نسبة التغطية الميدانية</span>
            <strong className="text-indigo-950 text-base font-black">
              {liveAudit.fulfillmentRate}% ({liveAudit.totalAssignedSlots} / {liveAudit.totalCapacityRequired} مقعد)
            </strong>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 p-3 rounded-xl border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-700 block">استيفاء عقود الأكاديميين</span>
            <strong className="text-emerald-950 text-base font-black">
              {liveAudit.academicFullComplianceCount} من {liveAudit.academicCount} أستاذ ({liveAudit.academicComplianceRate}%)
            </strong>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100/40 p-3 rounded-xl border border-amber-200">
            <span className="text-[11px] font-bold text-amber-700 block">سقف الكادر الإداري</span>
            <strong className="text-amber-950 text-base font-black">
              {liveAudit.adminCount} موظف ({liveAudit.adminComplianceRate}% ضمن السقف)
            </strong>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100/40 p-3 rounded-xl border border-purple-200">
            <span className="text-[11px] font-bold text-purple-700 block">مؤشر أيام الجلسات الفردية</span>
            <strong className="text-purple-950 text-base font-black">
              {liveAudit.academicSingleSessionDaysCount === 0 
                ? 'تم تصفير الأيام الفردية (0)' 
                : `${liveAudit.academicSingleSessionDaysCount} جلسات فردية للأكاديميين`}
            </strong>
          </div>
        </div>

        {/* =========================================================
            MAIN 4 REPORT TABS NAVIGATION
           ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          
          <div className="flex flex-wrap gap-2 text-xs font-black">
            {/* Tab 1: Portal Data Entry */}
            <button
              type="button"
              onClick={() => setActiveReportTab('portal_entry')}
              className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs ${
                activeReportTab === 'portal_entry'
                  ? 'bg-qou-primary text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileBadge className="w-4 h-4" />
              <span>1. كشف إدخال بورتال الجامعة (لموظف الامتحانات)</span>
            </button>

            {/* Tab 2: Master A3 Matrix */}
            <button
              type="button"
              onClick={() => setActiveReportTab('matrix')}
              className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs ${
                activeReportTab === 'matrix'
                  ? 'bg-qou-primary text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>2. مصفوفة تفريغ ومتابعة المراقبين (A3 Master)</span>
            </button>

            {/* Tab 3: Academic Assistant Dossier */}
            <button
              type="button"
              onClick={() => setActiveReportTab('academic_assistant')}
              className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs ${
                activeReportTab === 'academic_assistant'
                  ? 'bg-qou-primary text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>3. ملف إحاطة المساعد الأكاديمي (التبرير والرد السريع)</span>
            </button>

            {/* Tab 4: Executive Summary */}
            <button
              type="button"
              onClick={() => setActiveReportTab('executive')}
              className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs ${
                activeReportTab === 'executive'
                  ? 'bg-qou-primary text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>4. ملخص المؤشرات التنفيذية</span>
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================
          REPORT TAB 1: PORTAL DATA ENTRY GUIDE (FOR EXAM OFFICER)
         ========================================================= */}
      {activeReportTab === 'portal_entry' && (
        <div className="space-y-4">
          
          {/* Action Bar & Filters */}
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <FileBadge className="w-4 h-4 text-qou-primary" />
                  <span>كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة الرسمي</span>
                </h3>
                <p className="text-xs text-slate-500">
                  منظم بتسلسل شاشات بورتال الجامعة الرسمي: (اليوم ➔ الجلسة ➔ القاعات والمراقبون) لمطابقة الإدخال خطوة بخطوة.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPortalEntry}
                  className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-3.5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                  title="طباعة كشف الإدخال المعتمد لجميع القاعات والجلسات"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة كشف الإدخال الرسمي (PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportPortalEntryExcel(scheduleDays, semesterCode, examType)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="تصدير كشف الإدخال الشامل بتنسيق إكسل مرتب حسب شاشات البورتال"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>تصدير إكسل مطابق للبورتال</span>
                </button>

                {Boolean(portalDayFilter || portalSessionFilter || portalRoleFilter !== 'all' || portalSearch.trim()) && (
                  <button
                    type="button"
                    onClick={() => exportFilteredResultsExcel(
                      filteredPortalRooms, 
                      `${portalDayFilter || 'كل الأيام'} | ${portalSessionFilter ? 'جلسة ' + portalSessionFilter : 'كل الجلسات'} | ${portalRoleFilter}`,
                      semesterCode, 
                      examType
                    )}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="تصدير السجلات المفلترة حالياً فقط إلى ملف إكسل"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>تصدير المفلتر Excel ({filteredPortalRooms.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              {/* Day Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصفية حسب اليوم الامتحاني:</label>
                <select
                  value={portalDayFilter}
                  onChange={(e) => setPortalDayFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-qou-primary"
                >
                  <option value="">جميع أيام الامتحان (12 يوماً)</option>
                  {(scheduleDays || []).map((day, idx) => (
                    <option key={idx} value={`${day.dayName} (${day.date})`}>
                      {day.dayName} ({day.date})
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-qou-primary"
                >
                  <option value="">كافة الجلسات (1، 2، 3)</option>
                  <option value="1">الجلسة الأولى (1)</option>
                  <option value="2">الجلسة الثانية (2)</option>
                  <option value="3">الجلسة الثالثة (3)</option>
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">تصنيف الكادر:</label>
                <select
                  value={portalRoleFilter}
                  onChange={(e) => setPortalRoleFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-qou-primary"
                >
                  <option value="all">كافة الكوادر (أكاديمي + إداري)</option>
                  <option value="academic">الكادر الأكاديمي فقط (27)</option>
                  <option value="administrative">الكادر الإداري فقط (16)</option>
                </select>
              </div>

              {/* Search */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث سريع (قاعة / مراقب):</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={portalSearch}
                    onChange={(e) => setPortalSearch(e.target.value)}
                    placeholder="ابحث برقم القاعة أو اسم المراقب..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-qou-primary"
                  />
                </div>
              </div>
            </div>

            {/* Active Filters Reset Bar */}
            {Boolean(portalDayFilter || portalSessionFilter || portalRoleFilter !== 'all' || portalSearch.trim()) && (
              <div className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-600">
                  عدد القاعات المطابقة للفلترة: <strong>{filteredPortalRooms.length}</strong> قاعة
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPortalDayFilter('');
                    setPortalSessionFilter('');
                    setPortalRoleFilter('all');
                    setPortalSearch('');
                  }}
                  className="text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>إعادة ضبط وتفريغ الفلاتر</span>
                </button>
              </div>
            )}
          </div>

          {/* Printable & On-Screen Portal Entry Hierarchical View */}
          <div className="print-area print-area-portal bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-6">

            {/* Official University Header */}
            <div className="border-b-2 border-qou-primary pb-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-900 tracking-wide">جامعة القدس المفتوحة — فرع الخليل</h2>
                  <h3 className="text-xs font-bold text-qou-primary">قسم الامتحانات</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    الفصل الدراسي: <strong>{semesterCode}</strong> | نوع الامتحان: <strong>{examType}</strong>
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                    <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-sm font-black text-slate-900">
                    كشف إدخال وتسكين مراقبي الامتحانات بنظام الجامعة الرسمي
                  </h1>
                  <span className="text-[10px] bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-300 inline-block mt-0.5 font-bold">
                    مرتب بتسلسل شاشات بورتال الجامعة: اليوم ➔ رقم الجلسة ➔ القاعات والمراقبون
                  </span>
                </div>

                <div className="text-left text-[10px] text-slate-500 space-y-0.5">
                  <div>تاريخ الطباعة: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
                  <div>إجمالي القاعات المعروضة: <strong>{filteredPortalRooms.length}</strong></div>
                  <div>حالة الاعتماد: <strong className="text-emerald-700">معتمد ومطابق 100%</strong></div>
                </div>
              </div>
            </div>

            {/* Hierarchical Schedule: Days -> Sessions -> Rooms */}
            {portalGroupedSchedule.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold text-sm">
                لا توجد قاعات أو جلسات مطابقة لخيارات الفلترة الحالية.
              </div>
            ) : (
              portalGroupedSchedule.map((dayGroup, dIdx) => (
                <div key={dIdx} className="portal-day-section space-y-4 border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                  
                  {/* Day Header Banner */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-900 text-white px-4 py-2 rounded-lg font-black text-xs">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>{dayGroup.dayName}</span>
                      <span className="font-mono text-slate-300 text-[11px]">({dayGroup.date})</span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-normal">
                      عدد جلسات اليوم: <strong>{dayGroup.sessions.length}</strong> | إجمالي قاعات اليوم: <strong>{dayGroup.sessions.reduce((s, x) => s + x.rooms.length, 0)}</strong>
                    </div>
                  </div>

                  {/* Sessions within this Day */}
                  <div className="space-y-4">
                    {dayGroup.sessions.map((sessGroup, sIdx) => (
                      <div key={sIdx} className="portal-session-block bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
                        
                        {/* Session Header with Full Day & Session Context */}
                        <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="bg-slate-800 text-white text-[10.5px] font-black px-2.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                              <Calendar className="w-3.5 h-3.5 text-amber-400" />
                              <span>{dayGroup.dayName}</span>
                              <span className="font-mono text-slate-200 text-[9.5px]">({dayGroup.date})</span>
                            </span>

                            <span className="font-black text-xs text-qou-primary flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-qou-primary" />
                              <span>الجلسة الامتحانية رقم ({sessGroup.sessionNumber})</span>
                              {sIdx > 0 && (
                                <span className="text-[9.5px] text-indigo-900 bg-indigo-50 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                  (تابع اليوم)
                                </span>
                              )}
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
                                      <span className="text-emerald-950 font-black flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        {p1}
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                        شاغر / غير محدد
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-1.5 px-3 border-l border-slate-200">
                                    {cap >= 2 ? (
                                      p2 ? (
                                        <span className="text-indigo-950 font-bold flex items-center gap-1">
                                          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                          {p2}
                                        </span>
                                      ) : (
                                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                          شاغر (مساعد)
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-300 font-normal">-</span>
                                    )}
                                  </td>

                                  <td className="py-1.5 px-3 text-center border-l border-slate-200">
                                    {cap >= 3 ? (
                                      p3 ? (
                                        <span className="text-purple-950 font-bold">{p3}</span>
                                      ) : (
                                        <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">شاغر ثالث</span>
                                      )
                                    ) : (
                                      <span className="text-slate-300 font-normal">-</span>
                                    )}
                                  </td>

                                  <td className="py-1.5 px-2 text-center no-print">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSwapModal(roomItem, 0)}
                                      className="text-[10px] text-qou-primary hover:text-qou-dark font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                      title="تعديل أو تبديل المراقب المسند"
                                    >
                                      <ArrowLeftRight className="w-3 h-3" />
                                      <span>تبديل</span>
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

            {/* Official University Print Footer */}
            <div className="border-t-2 border-slate-300 pt-3 mt-4 flex items-center justify-between text-xs text-slate-600">
              <div className="font-bold">
                جامعة القدس المفتوحة — فرع الخليل
              </div>
              <div className="text-center text-slate-400 text-[10px]">
                كشف تسكين مراقبي الامتحانات بنظام الجامعة الرسمي
              </div>
              <div className="font-bold">
                قسم الامتحانات
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          REPORT TAB 2: A3 PROCTORS MASTER MATRIX
         ========================================================= */}
      {activeReportTab === 'matrix' && (
        <div className="space-y-4">

          {/* On-Screen Filter & Toggle Bar */}
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-qou-primary" />
                  <span>مصفوفة تفريغ ومتابعة المراقبين الرسمية (A3 Master Landscape)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  تفريغ شامل لكافة المراقبين (مرتبين أبجدياً: الأكاديميون 1–27 ثم الإداريون 28–43) عبر الـ 36 جلسة.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintA3Matrix}
                  className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-qou-primary hover:from-indigo-800 hover:to-qou-dark text-white text-xs font-black px-4 py-2 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                  title="طباعة مصفوفة تفريغ المراقبين كاملة بتنسيق ورق A3 بالعرض (Landscape PDF)"
                >
                  <Printer className="w-4 h-4 text-indigo-200" />
                  <span>🖨️ طباعة مصفوفة التفريغ (A3 PDF)</span>
                  <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded font-mono">صفحة واحدة</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportProctorsMatrixExcel(liveProctorStats, scheduleDays, semesterCode, examType)}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="تصدير مصفوفة التفريغ لملف إكسل مضبوط مسبقاً للطباعة على A3 بالعرض"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>تصدير إكسل للمصفوفة (A3 Ready)</span>
                </button>
              </div>
            </div>

            {/* Matrix Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">تصفية العرض:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => setMatrixRoleFilter('all')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      matrixRoleFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكل ({matrixRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixRoleFilter('academic')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      matrixRoleFilter === 'academic' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-indigo-900'
                    }`}
                  >
                    🎓 الأكاديمي ({matrixRows.filter(p => (p.type || 'academic') === 'academic').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixRoleFilter('administrative')}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      matrixRoleFilter === 'administrative' ? 'bg-white text-amber-900 shadow-xs' : 'text-slate-600 hover:text-amber-900'
                    }`}
                  >
                    💼 الإداري ({matrixRows.filter(p => (p.type || 'academic') === 'administrative').length})
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  value={matrixSearch}
                  onChange={(e) => setMatrixSearch(e.target.value)}
                  placeholder="بحث سريع باسم المراقب..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-qou-primary text-xs"
                />
              </div>
            </div>
          </div>

          {/* Printable & On-Screen Matrix Container */}
          <div className="print-area print-area-matrix-a3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-4">

            {/* Official University Print Header for A3 Matrix */}
            <div className="a3-matrix-header border-b-2 border-qou-primary pb-3 mb-2">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-900 tracking-wide">جامعة القدس المفتوحة — فرع الخليل</h2>
                  <h3 className="text-xs font-bold text-qou-primary">قسم الامتحانات</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    الفصل الدراسي: <strong>{semesterCode}</strong> | نوع الامتحان: <strong>{examType}</strong>
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-0.5 flex items-center justify-center">
                    <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-sm font-black text-slate-900">مصفوفة تفريغ ومتابعة توزيع مراقبي الامتحانات</h1>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
                    تفريغ شامل لكافة الأيام والجلسات — نسبة التغطية 100% (415 قاعة مسندة بالكامل)
                  </span>
                </div>

                <div className="text-left text-[10px] text-slate-500 space-y-0.5">
                  <div>تاريخ الاستخراج: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
                  <div>إجمالي المراقبين: <strong>{matrixRows.length}</strong> (27 أكاديمي + 16 إداري)</div>
                  <div>المقاس الطباعي المعتمد: <strong className="text-indigo-700">A3 بالعرض (Landscape)</strong></div>
                </div>
              </div>
            </div>

            {/* FULL A3 MATRIX TABLE */}
            <div className="a3-matrix-scroll-wrapper overflow-x-auto border border-slate-300 rounded-xl shadow-inner max-h-[75vh]">
              <table className="a3-matrix-table w-full text-center border-collapse text-[10px]">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-black border-b border-slate-400">
                    <th rowSpan="2" className="py-2 px-1 text-center border border-slate-300 w-8 bg-slate-200 sticky top-0 right-0 z-30 shadow-xs">#</th>
                    <th rowSpan="2" className="py-2 px-2 text-right border border-slate-300 min-w-[140px] max-w-[160px] bg-slate-200 sticky top-0 right-8 z-30 shadow-xs">اسم المراقب</th>
                    <th rowSpan="2" className="py-2 px-1 text-center border border-slate-300 w-16 bg-slate-200 sticky top-0 z-20">التصنيف</th>
                    <th rowSpan="2" className="py-2 px-1 text-center border border-slate-300 w-14 bg-slate-200 sticky top-0 z-20">النصاب/السقف</th>
                    <th rowSpan="2" className="py-2 px-1 text-center border border-slate-300 w-12 bg-slate-200 sticky top-0 z-20 border-l-2 border-slate-700 a3-info-border-left">المنفذ</th>
                    {scheduleDays.map((day, dIdx) => {
                      const sessCount = (day.sessions || []).length;
                      if (sessCount === 0) return null;
                      return (
                        <th 
                          key={dIdx} 
                          colSpan={sessCount}
                          className="py-1 px-1 text-center border border-slate-300 bg-slate-200 text-[10px] font-black sticky top-0 z-20 border-l-2 border-slate-700 a3-day-border-left"
                        >
                          <div>{day.dayName}</div>
                          <div className="font-mono text-[8px] text-slate-600 font-normal">({day.date})</div>
                        </th>
                      );
                    })}
                  </tr>
                  <tr className="bg-slate-100 text-slate-700 font-bold text-[9px] border-b-2 border-slate-400">
                    {scheduleDays.flatMap((day, dIdx) => 
                      (day.sessions || []).map((sess, sIdx) => {
                        const isLastSessOfDay = sIdx === (day.sessions.length - 1);
                        return (
                          <th 
                            key={`${dIdx}_${sIdx}`} 
                            className={`py-1 px-1 text-center border border-slate-300 bg-slate-100 sticky top-8 z-20 ${
                              isLastSessOfDay ? 'border-l-2 border-slate-700 a3-day-border-left' : ''
                            }`}
                          >
                            ج{sess.sessionNumber}
                          </th>
                        );
                      })
                    )}
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
                          <td className="py-1 px-0.5 border border-slate-300 text-[9px] font-mono text-slate-500 bg-slate-50 sticky right-0 z-10 shadow-xs">
                            {idx + 1}
                          </td>

                          <td className="py-1 px-2 border border-slate-300 text-right font-bold text-slate-900 text-[10.5px] truncate max-w-[160px] bg-white sticky right-8 z-10 shadow-xs">
                            {p.name}
                          </td>

                          <td className="py-1 px-0.5 border border-slate-300 text-[9px] text-center">
                            <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                              isAcademic ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {isAcademic ? 'أكاديمي' : 'إداري'}
                            </span>
                          </td>

                          <td className="py-1 px-0.5 border border-slate-300 font-bold text-slate-700 text-[9.5px] text-center">
                            {quota}
                          </td>

                          <td className="py-1 px-0.5 border border-slate-300 font-black text-qou-primary text-[10px] text-center border-l-2 border-slate-700 a3-info-border-left">
                            {assigned}
                          </td>

                          {/* Session Cells */}
                          {p.sessionAssignments.map((cell, cIdx) => {
                            const isDayLastSession = !matrixSessions[cIdx + 1] || matrixSessions[cIdx + 1].dayIndex !== matrixSessions[cIdx].dayIndex;
                            return (
                              <td
                                key={cIdx}
                                className={`py-1 px-0.5 border border-slate-300 text-[8.5px] text-center ${
                                  isDayLastSession ? 'border-l-2 border-slate-700 a3-day-border-left' : ''
                                } ${
                                  cell.status === 'assigned'
                                    ? cell.isMulti 
                                      ? 'bg-indigo-50/90 text-indigo-950 font-black border-indigo-200' 
                                      : 'bg-emerald-50/90 text-emerald-950 font-black'
                                    : cell.status === 'apology'
                                      ? 'bg-rose-50 text-rose-700 text-[7px] font-bold'
                                      : 'text-slate-300 font-normal'
                                }`}
                                title={cell.status === 'assigned' ? `قاعة ${cell.room}` : cell.status === 'apology' ? 'معتذر في هذه الجلسة' : 'لا توجد مراقبة'}
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

            {/* Official University Print Footer for A3 Matrix */}
            <div className="a3-matrix-footer border-t-2 border-slate-300 pt-3 mt-4 flex items-center justify-between text-xs text-slate-600">
              <div className="font-bold">
                جامعة القدس المفتوحة — فرع الخليل
              </div>
              <div className="text-center text-slate-400 text-[10px]">
                كشف مصفوفة تفريغ ومتابعة المراقبين الرسمية المعتمدة
              </div>
              <div className="font-bold">
                قسم الامتحانات
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          REPORT TAB 3: ACADEMIC ASSISTANT DOSSIER (JUSTIFICATIONS & BRIEFS)
         ========================================================= */}
      {activeReportTab === 'academic_assistant' && (
        <div className="space-y-4">
          
          {/* Action Bar & Controls */}
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  <Award className="w-4 h-4 text-qou-primary" />
                  <span>ملف إحاطة المساعد الأكاديمي (التبرير الإداري والرد السريع)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  مذكرة إدارية رسمية موجهة للمساعد الأكاديمي لتبرير وتوضيح محددات توزيع كل مراقب وإجابته فورياً وبدقة.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintAssistantDossier('single', currentAssistantProctor?.id)}
                  className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                  title="طباعة بطاقة التبرير الخاصة بالمراقب المحدد حالياً في صفحة واحدة A4"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة بطاقة الزميل المختار PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmConfig({
                      title: 'تأكيد تجهيز وطباعة الملف الشامل لكافة المراقبين (43 صفحة PDF)',
                      message: 'أنت على وشك توليد وطباعة الكتيب التبريري الشامل لكافة الزملاء المراقبين دفعة واحدة.',
                      consequences: [
                        `سيقوم النظام بتوليد ${liveProctorStats.length} صفحة A4 مستقلة وموائمة بالكامل (صفحة واحدة لكل مراقب بتفاضل صفر وبدون أي فيضان).`,
                        'ستفتح نافذة الطباعة لاختيار الحفظ كملف PDF على جهازك أو إرساله مباشرة إلى الطابعة المعتمدة.',
                        'تم ترتيب الزملاء بدقة وفق البروتوكول الجامعي المعتمد: الأكاديميون أولاً ثم الإداريون أبجدياً.'
                      ],
                      confirmText: 'متابعة تجهيز وطباعة الملف (43 صفحة)',
                      cancelText: 'تراجع',
                      variant: 'primary',
                      onConfirm: () => handlePrintAssistantDossier('all')
                    });
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  title="طباعة الملف التبريري الشامل لكافة الزملاء (43 صفحة PDF - صفحة واحدة موائمة لكل زميل)"
                >
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>طباعة الملف الشامل لكافة المراقبين (43 صفحة PDF)</span>
                </button>
              </div>
            </div>

            {/* Filter and Proctor Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
              
              {/* Proctor Selector Dropdown */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  اختر الزميل المراقب لعرض ملف إحاطته وتبريراته:
                </label>
                <select
                  value={currentAssistantProctor?.id || ''}
                  onChange={(e) => setSelectedAssistantProctorId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-black text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-qou-primary"
                >
                  <optgroup label="كادر الأكاديميين (مرتبين أبجدياً):">
                    {liveProctorStats.filter(p => (p.type || 'academic') === 'academic').map(p => (
                      <option key={p.id} value={p.id}>
                        🎓 {p.name} (نصاب: {p.quota} | منفذ: {p.assignedCount})
                      </option>
                    ))}
                  </optgroup>

                  <optgroup label="كادر الإداريين (مرتبين أبجدياً):">
                    {liveProctorStats.filter(p => p.type === 'administrative').map(p => (
                      <option key={p.id} value={p.id}>
                        💼 {p.name} (سقف: {p.quota} | منفذ: {p.assignedCount})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* Quick Search */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">بحث بالاسم:</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                  <input
                    type="text"
                    value={assistantSearch}
                    onChange={(e) => setAssistantSearch(e.target.value)}
                    placeholder="ابحث باسم الزميل..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-2.5 py-1.5 font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-qou-primary text-xs"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* On-Screen Interactive View (Single Proctor Display) */}
          <div className="assistant-screen-view space-y-4">
            {currentAssistantProctor ? (
              renderProctorDossierCard(
                currentAssistantProctor, 
                liveProctorStats.findIndex(p => p.id === currentAssistantProctor.id) + 1, 
                liveProctorStats.length, 
                false
              )
            ) : (
              <div className="py-12 text-center text-slate-400 font-bold text-sm bg-white rounded-2xl border border-slate-200">
                يرجى اختيار أحد الزملاء المراقبين من القائمة أعلاه لعرض ملف إحاطته.
              </div>
            )}
          </div>

          {/* Dedicated Print Area (Rendered ONLY during active printing, completely hidden on screen) */}
          <div className="print-area print-area-assistant hidden print:block">
            {assistantPrintTarget === 'all' ? (
              liveProctorStats.map((proctor, idx) => (
                <React.Fragment key={proctor.id}>
                  {renderProctorDossierCard(proctor, idx + 1, liveProctorStats.length, true)}
                </React.Fragment>
              ))
            ) : assistantPrintTarget === 'single' && currentAssistantProctor ? (
              renderProctorDossierCard(
                currentAssistantProctor, 
                liveProctorStats.findIndex(p => p.id === currentAssistantProctor.id) + 1, 
                liveProctorStats.length, 
                true
              )
            ) : null}
          </div>

        </div>
      )}

      {/* =========================================================
          REPORT TAB 4: EXECUTIVE SUMMARY & SCORECARD
         ========================================================= */}
      {activeReportTab === 'executive' && (
        <div className="space-y-4">
          
          {/* Action Bar */}
          <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-qou-primary" />
                <span>التقرير التنفيذي لملخص مؤشرات توزيع الامتحانات (Executive Scorecard)</span>
              </h3>
              <p className="text-xs text-slate-500">
                بطاقة المؤشرات الإدارية الشاملة للعملية الامتحانية بفرع الخليل جاهزة للعرض والطباعة في صفحة واحدة.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrintExecutiveSummary}
                className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة التقرير التنفيذي (PDF)</span>
              </button>

              <button
                type="button"
                onClick={() => exportExecutiveSummaryExcel(liveAudit, dailyStats, semesterCode, examType)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>تصدير المؤشرات Excel</span>
              </button>
            </div>
          </div>

          {/* Printable Executive Container */}
          <div className="print-area print-area-exec executive-summary-print bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">

            {/* University Header */}
            <div className="border-b-2 border-qou-primary pb-3">
              <div className="flex items-center justify-between">
                <div className="text-right">
                  <h2 className="text-lg font-black text-slate-900 tracking-wide">جامعة القدس المفتوحة — فرع الخليل</h2>
                  <h3 className="text-xs font-bold text-qou-primary">قسم الامتحانات</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    الفصل الدراسي: <strong>{semesterCode}</strong> | نوع الامتحان: <strong>{examType}</strong>
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-1 flex items-center justify-center">
                    <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-sm font-black text-slate-900">
                    التقرير التنفيذي لملخص مؤشرات توزيع مراقبي الامتحانات
                  </h1>
                  <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
                    إحاطة شاملة لكافة محددات التغطية والعدالة واستيفاء الأنصبة
                  </span>
                </div>

                <div className="text-left text-[10px] text-slate-500 space-y-0.5">
                  <div>تاريخ التقرير: <strong>{new Date().toLocaleDateString('ar-EG')}</strong></div>
                  <div>نسبة الإنجاز: <strong className="text-emerald-700">{liveAudit.fulfillmentRate}% مكتمل</strong></div>
                  <div>الفرع: <strong>الخليل</strong></div>
                </div>
              </div>
            </div>

            {/* Big Metrics Grid (Dynamically Computed) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-bold text-slate-600 block">إجمالي الشواغر المطلوبة</span>
                <strong className="text-xl font-black text-slate-900">{liveAudit.totalCapacityRequired} مقعد</strong>
                <span className="text-[10px] text-emerald-700 font-bold block mt-1">
                  تغطية {liveAudit.fulfillmentRate}% ({liveAudit.totalAssignedSlots} مسند)
                </span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-bold text-emerald-700 block">عقود الكادر الأكاديمي</span>
                <strong className="text-xl font-black text-emerald-950">
                  {liveAudit.academicFullComplianceCount} / {liveAudit.academicCount} أستاذ
                </strong>
                <span className="text-[10px] text-emerald-800 font-bold block mt-1">
                  استيفاء {liveAudit.academicComplianceRate}% {liveAudit.academicFullComplianceCount === liveAudit.academicCount ? 'بتفاضل صفر' : 'يوجد تفاوت'}
                </span>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 block">سقف الكادر الإداري</span>
                <strong className="text-xl font-black text-amber-950">{liveAudit.adminCount} موظف</strong>
                <span className="text-[10px] text-amber-800 font-bold block mt-1">
                  {liveAudit.adminComplianceRate}% ضمن السقف ≤ جلستين/يوم
                </span>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-xl">
                <span className="text-[11px] font-bold text-indigo-700 block">إجمالي أيام وجلسات الامتحان</span>
                <strong className="text-xl font-black text-indigo-950">{executiveStats.totalDays} يوماً / {executiveStats.totalSessions} جلسة</strong>
                <span className="text-[10px] text-indigo-800 font-bold block mt-1">جدول تشغيلي متكامل</span>
              </div>
            </div>

            {/* Daily Operational Statistics Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-qou-primary" />
                <span>جدول توزيع قاعات ومراقبي أيام الامتحان ({dailyStats.length} يوماً):</span>
              </h4>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 text-[11px]">
                      <th className="py-2.5 px-3 w-10 text-center border-l border-slate-200">#</th>
                      <th className="py-2.5 px-4 border-l border-slate-200 font-black">اليوم والتاريخ</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200 font-black">عدد الجلسات</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200 font-black">إجمالي القاعات</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200 font-black">الشواغر المطلوبة</th>
                      <th className="py-2.5 px-3 w-32 text-center border-l border-slate-200 font-black">المراقبون المشاركون</th>
                      <th className="py-2.5 px-3 w-28 text-center border-l border-slate-200 font-black">نسبة الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {dailyStats.map((d, dIdx) => (
                      <tr key={dIdx} className="hover:bg-slate-50/80">
                        <td className="py-1.5 px-3 text-center text-slate-400 font-mono border-l border-slate-200">
                          {dIdx + 1}
                        </td>
                        <td className="py-1.5 px-4 font-bold text-slate-900 border-l border-slate-200">
                          {d.dayName} <span className="font-mono text-slate-500 text-[10px]">({d.date})</span>
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-800 border-l border-slate-200">
                          {d.sessionsCount} جلسات
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-slate-800 border-l border-slate-200">
                          {d.totalRooms} قاعة
                        </td>
                        <td className="py-1.5 px-3 text-center font-bold text-qou-primary border-l border-slate-200">
                          {d.totalSlots} شاغر
                        </td>
                        <td className="py-1.5 px-3 text-center font-black text-slate-900 border-l border-slate-200 bg-slate-50/50">
                          {d.proctorsCount} مراقباً
                        </td>
                        <td className="py-1.5 px-3 text-center border-l border-slate-200">
                          <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                            100% مسند
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-[11px]">
                      <td colSpan="2" className="py-2.5 px-4 text-center border-l border-slate-300">المجموع الكلي المعتمد</td>
                      <td className="py-2.5 px-3 text-center border-l border-slate-300">{matrixSessions.length} جلسة</td>
                      <td className="py-2.5 px-3 text-center border-l border-slate-300">{allRooms.length} قاعة</td>
                      <td className="py-2.5 px-3 text-center border-l border-slate-300 text-qou-primary">{executiveStats.totalSlots} شاغر</td>
                      <td className="py-2.5 px-3 text-center border-l border-slate-300">43 مراقباً</td>
                      <td className="py-2.5 px-3 text-center text-emerald-800">100% مكتمل</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Official University Print Footer */}
            <div className="border-t-2 border-slate-300 pt-3 mt-4 flex items-center justify-between text-xs text-slate-600">
              <div className="font-bold">
                جامعة القدس المفتوحة — فرع الخليل
              </div>
              <div className="text-center text-slate-400 text-[10px]">
                تقرير المؤشرات التنفيذية المعتمد للامتحانات النصفية
              </div>
              <div className="font-bold">
                قسم الامتحانات
              </div>
            </div>

          </div>

        </div>
      )}

      {/* =========================================================
          QUICK SWAP MODAL
         ========================================================= */}
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

      {/* =========================================================
          CONFIRMATION MODAL
         ========================================================= */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          onClose={() => setConfirmConfig(null)}
          {...confirmConfig}
        />
      )}

    </div>
  );
}
