import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import LoginPage from './components/LoginPage';
import ProjectsHub from './components/ProjectsHub';
import Navbar from './components/Navbar';
import ConfirmModal from './components/ConfirmModal';

// Code-split tabs: Heavy components loaded asynchronously on demand
const ScheduleTab = lazy(() => import('./components/ScheduleTab'));
const ProctorsTab = lazy(() => import('./components/ProctorsTab'));
const DistributionTab = lazy(() => import('./components/DistributionTab'));
const ReviewTab = lazy(() => import('./components/ReviewTab'));
const ResultsTab = lazy(() => import('./components/ResultsTab'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

import { INITIAL_PROCTORS } from './data/initialProctors';
import { getStoredAccounts, saveStoredAccounts } from './utils/auth';
import { 
  subscribeToCloudProjects, 
  saveProjectToCloud, 
  seedLocalProjectsToCloudIfEmpty 
} from './utils/cloudSync';

export default function App() {
  // Accounts for authentication
  const [accounts, setAccounts] = useState(() => getStoredAccounts());

  // Current session user (null = show LoginPage)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem('qou_session_user');
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Active navigation tab within an open project
  const [activeTab, setActiveTab] = useState('proctors');

  // Projects Repository (Multi-Project storage)
  // Cleaned: Project 1261 Midterm has EMPTY rooms (0 slots) waiting for file upload
  const [projects, setProjects] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_all_projects');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If the default project has old preloaded rooms, ensure it is emptied as requested
          return parsed.map(p => {
            if (p.id === 'proj_1261_midterm_default' && p.scheduleDays && p.scheduleDays.length > 0 && !p.isUserUploaded) {
              return {
                ...p,
                scheduleDays: [],
                totalRoomSlots: 0,
                uploadedFileName: '',
                distributionResult: null
              };
            }
            return p;
          });
        }
      }
    } catch (e) {
      console.error(e);
    }

    // Default Project: Semester 1261 Midterm (Clean & Empty rooms, ready for testing upload)
    return [
      {
        id: 'proj_1261_midterm_default',
        semesterCode: '1261',
        examType: 'نصفي',
        createdAt: '3 نوفمبر 2026',
        updatedAt: new Date().toISOString(),
        scheduleDays: [],
        totalRoomSlots: 0,
        uploadedFileName: '',
        proctors: INITIAL_PROCTORS.map(p => ({
          ...p,
          quota: 0,
          isActive: true,
          exceptions: []
        })),
        distributionResult: null
      }
    ];
  });

  // Active Project ID (null = in ProjectsHub)
  const [activeProjectId, setActiveProjectId] = useState(() => {
    return sessionStorage.getItem('qou_active_proj_id') || null;
  });

  // Local Storage Sync Effects
  useEffect(() => {
    localStorage.setItem('qou_all_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    saveStoredAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    if (activeProjectId) {
      sessionStorage.setItem('qou_active_proj_id', activeProjectId);
    } else {
      sessionStorage.removeItem('qou_active_proj_id');
    }
  }, [activeProjectId]);

  // Handle Login & Logout
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    sessionStorage.setItem('qou_session_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveProjectId(null);
    sessionStorage.removeItem('qou_session_user');
    sessionStorage.removeItem('qou_active_proj_id');
  };

  // Find currently active project
  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // Workflow stats for the active project (Must be declared before any conditional return!)
  const workflowStats = useMemo(() => {
    if (!activeProject) return null;
    const days = activeProject.scheduleDays || [];
    const hasSchedule = days.length > 0;
    
    // Always compute totalSlots dynamically from room capacities to prevent drift
    const computedSlots = days.reduce((acc, d) => 
      acc + (d.sessions || []).reduce((sAcc, s) => 
        sAcc + (s.rooms || []).reduce((rAcc, r) => rAcc + Math.max(1, Number(r.capacity) || 1), 0), 0), 0);
    const totalSlots = computedSlots > 0 ? computedSlots : (activeProject.totalRoomSlots || 0);
    
    const activeProctors = (activeProject.proctors || []).filter(p => p.isActive);
    const totalQuotas = activeProctors.reduce((sum, p) => sum + (Number(p.quota) || 0), 0);
    const isQuotaMatched = hasSchedule && totalSlots > 0 && totalQuotas === totalSlots;
    const isDistributed = Boolean(
      activeProject.distributionResult && 
      (activeProject.distributionResult.success || activeProject.distributionResult.isSuccess)
    );

    return {
      hasSchedule,
      daysCount: days.length,
      totalSlots,
      totalQuotas,
      activeProctorsCount: activeProctors.length,
      isQuotaMatched,
      isDistributed
    };
  }, [activeProject]);

  const [cloudStatus, setCloudStatus] = useState('connecting');
  const [cloudSyncState, setCloudSyncState] = useState({
    status: 'connected', // 'connected' | 'saving' | 'saved' | 'conflict' | 'offline'
    lastSavedAt: null,
    conflictData: null
  });
  const [conflictModalConfig, setConflictModalConfig] = useState(null);

  // Real-time Cloud Synchronization with Google Cloud Firestore
  useEffect(() => {
    const unsubscribe = subscribeToCloudProjects(
      (cloudProjects) => {
        if (cloudProjects && cloudProjects.length > 0) {
          setProjects(cloudProjects);
        } else {
          // If Firestore is empty, seed existing local projects
          seedLocalProjectsToCloudIfEmpty(projects);
        }
        setCloudStatus('connected');
      },
      (err) => {
        console.warn('Firestore subscription fallback to local storage:', err);
        setCloudStatus('offline');
        setCloudSyncState(prev => ({ ...prev, status: 'offline' }));
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper to update fields of the active project with OCC (Optimistic Concurrency Control)
  const updateActiveProject = async (updater, force = false) => {
    if (!activeProjectId) return;

    let targetBaseVersion = null;
    let nextLocalProject = null;

    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        targetBaseVersion = p.version !== undefined ? p.version : null;
        const updated = typeof updater === 'function' ? updater(p) : { ...p, ...updater };
        nextLocalProject = updated;
        return updated;
      }
      return p;
    }));

    if (!nextLocalProject) return;

    setCloudSyncState(prev => ({ ...prev, status: 'saving' }));

    try {
      const res = await saveProjectToCloud(nextLocalProject, force ? null : targetBaseVersion, force);

      if (res.conflict) {
        setCloudSyncState(prev => ({
          ...prev,
          status: 'conflict',
          conflictData: res
        }));

        setConflictModalConfig({
          remoteVersion: res.remoteVersion,
          remoteUpdatedAt: res.remoteUpdatedAt,
          onAcceptRemote: () => {
            setProjects(prev => prev.map(p => p.id === activeProjectId ? res.remoteProject : p));
            setCloudSyncState({ status: 'connected', lastSavedAt: new Date(), conflictData: null });
            setConflictModalConfig(null);
          },
          onForceOverwrite: () => {
            updateActiveProject((p) => ({ ...p, version: res.remoteVersion }), true);
            setConflictModalConfig(null);
          }
        });
      } else if (res.success) {
        setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId) {
            return {
              ...p,
              version: res.version,
              updatedAt: res.updatedAt
            };
          }
          return p;
        }));

        setCloudSyncState({
          status: 'saved',
          lastSavedAt: new Date(),
          conflictData: null
        });

        setTimeout(() => {
          setCloudSyncState(prev => prev.status === 'saved' ? { ...prev, status: 'connected' } : prev);
        }, 3000);
      } else {
        setCloudSyncState(prev => ({ ...prev, status: 'offline' }));
      }
    } catch (err) {
      console.warn('saveProjectToCloud exception:', err);
      setCloudSyncState(prev => ({ ...prev, status: 'offline' }));
    }
  };

  // Helper to append to activity audit log
  const handleLogActivity = (entry) => {
    updateActiveProject(prev => ({
      ...prev,
      activityLog: [
        {
          id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          timestamp: new Date().toISOString(),
          actorName: currentUser?.name || 'مسؤول الامتحانات',
          ...entry
        },
        ...(prev.activityLog || []).slice(0, 99)
      ]
    }));
  };

  // If user is not logged in, render the Dedicated Login Gateway
  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // If logged in but no project is open, render the Projects Hub
  if (!activeProject) {
    return (
      <>
        <ProjectsHub
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          projects={projects}
          setProjects={setProjects}
          cloudStatus={cloudStatus}
          onOpenProject={(id) => {
            setActiveProjectId(id);
            setActiveTab('schedule'); // Jump to schedule tab so user can upload directly!
          }}
        />

        {/* Global Settings Modal */}
        <Suspense fallback={null}>
          {isSettingsModalOpen && (
            <SettingsModal
              isOpen={isSettingsModalOpen}
              onClose={() => setIsSettingsModalOpen(false)}
              semesterCode="1261"
              setSemesterCode={() => {}}
              examType="نصفي"
              setExamType={() => {}}
              proctors={INITIAL_PROCTORS}
              setProctors={() => {}}
              scheduleDays={[]}
              setScheduleDays={() => {}}
              setTotalRoomSlots={() => {}}
              setDistributionResult={() => {}}
              accounts={accounts}
              setAccounts={setAccounts}
            />
          )}
        </Suspense>
      </>
    );
  }

  // When inside an open project:
  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-800">
      
      {/* Top Project Navbar */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onBackToHub={() => setActiveProjectId(null)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        semesterCode={activeProject.semesterCode}
        examType={activeProject.examType}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        workflowStats={workflowStats}
        cloudSyncState={cloudSyncState}
        activeProject={activeProject}
        onResolveConflict={() => {
          if (cloudSyncState.conflictData) {
            setConflictModalConfig({
              remoteVersion: cloudSyncState.conflictData.remoteVersion,
              remoteUpdatedAt: cloudSyncState.conflictData.remoteUpdatedAt,
              onAcceptRemote: () => {
                setProjects(prev => prev.map(p => p.id === activeProjectId ? cloudSyncState.conflictData.remoteProject : p));
                setCloudSyncState({ status: 'connected', lastSavedAt: new Date(), conflictData: null });
                setConflictModalConfig(null);
              },
              onForceOverwrite: () => {
                updateActiveProject((p) => ({ ...p, version: cloudSyncState.conflictData.remoteVersion }), true);
                setConflictModalConfig(null);
              }
            });
          }
        }}
      />

      {/* Main Project Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {/* Tab Components loaded on demand via Suspense */}
        <Suspense fallback={
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 animate-pulse">
            <div className="w-8 h-8 rounded-full border-3 border-qou-primary border-t-transparent animate-spin"></div>
            <span className="text-xs font-bold">جارٍ تجهيز واجهة العمل...</span>
          </div>
        }>
          {/* Step 1: Exam Rooms Schedule & Capacities */}
          {activeTab === 'schedule' && (
            <ScheduleTab
              scheduleDays={activeProject.scheduleDays || []}
              setScheduleDays={(newDays) => {
                updateActiveProject(prev => ({
                  ...prev,
                  scheduleDays: typeof newDays === 'function' ? newDays(prev.scheduleDays || []) : newDays,
                  isUserUploaded: true
                }));
              }}
              totalRoomSlots={workflowStats?.totalSlots || activeProject.totalRoomSlots || 0}
              setTotalRoomSlots={(slots) => {
                updateActiveProject({ totalRoomSlots: slots });
              }}
              uploadedFileName={activeProject.uploadedFileName || ''}
              setUploadedFileName={(name) => {
                updateActiveProject({ uploadedFileName: name });
              }}
              semesterCode={activeProject.semesterCode}
              examType={activeProject.examType}
              onNavigateNext={setActiveTab}
            />
          )}

          {/* Step 2: Proctors Management & Quotas */}
          {activeTab === 'proctors' && (
            <ProctorsTab
              proctors={activeProject.proctors || []}
              setProctors={(newProctors) => {
                updateActiveProject(prev => ({
                  ...prev,
                  proctors: typeof newProctors === 'function' ? newProctors(prev.proctors || []) : newProctors
                }));
              }}
              scheduleDays={activeProject.scheduleDays || []}
              totalRoomSlots={workflowStats?.totalSlots || activeProject.totalRoomSlots || 0}
              onNavigateNext={setActiveTab}
              activityLog={activeProject.activityLog || []}
              onLogActivity={handleLogActivity}
            />
          )}

          {/* Step 3: Distribution Engine */}
          {activeTab === 'distribution' && (
            <DistributionTab
              proctors={activeProject.proctors || []}
              scheduleDays={activeProject.scheduleDays || []}
              setScheduleDays={(newDays) => {
                updateActiveProject(prev => ({
                  ...prev,
                  scheduleDays: typeof newDays === 'function' ? newDays(prev.scheduleDays || []) : newDays
                }));
              }}
              totalRoomSlots={workflowStats?.totalSlots || activeProject.totalRoomSlots || 0}
              distributionResult={activeProject.distributionResult}
              setDistributionResult={(result) => {
                updateActiveProject({ distributionResult: result });
              }}
              setActiveTab={setActiveTab}
            />
          )}

          {/* Step 4: Review & Manual Proctor Assignment */}
          {activeTab === 'review' && (
            <ReviewTab
              scheduleDays={activeProject.scheduleDays || []}
              setScheduleDays={(newDays) => {
                updateActiveProject(prev => ({
                  ...prev,
                  scheduleDays: typeof newDays === 'function' ? newDays(prev.scheduleDays || []) : newDays
                }));
              }}
              proctors={activeProject.proctors || []}
              setProctors={(newProctors) => {
                updateActiveProject(prev => ({
                  ...prev,
                  proctors: typeof newProctors === 'function' ? newProctors(prev.proctors || []) : newProctors
                }));
              }}
              totalRoomSlots={workflowStats?.totalSlots || activeProject.totalRoomSlots || 0}
              onNavigateNext={setActiveTab}
              activityLog={activeProject.activityLog || []}
              onLogActivity={handleLogActivity}
            />
          )}

          {/* Step 5: Results & Print-ready Views */}
          {activeTab === 'results' && (
            <ResultsTab
              scheduleDays={activeProject.scheduleDays || []}
              setScheduleDays={(newDays) => {
                updateActiveProject(prev => ({
                  ...prev,
                  scheduleDays: typeof newDays === 'function' ? newDays(prev.scheduleDays || []) : newDays
                }));
              }}
              proctors={activeProject.proctors || []}
              distributionResult={activeProject.distributionResult}
              semesterCode={activeProject.semesterCode}
              examType={activeProject.examType}
              onLogActivity={handleLogActivity}
            />
          )}
        </Suspense>

      </main>

      {/* Screen Footer (Hidden in Print) */}
      <footer className="no-print border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            جامعة القدس المفتوحة — فرع الخليل | المساعد الأكاديمي الدكتور مراد الجندي
          </div>
          <div>
            إعداد وتصميم الموقع: الأستاذ أحمد النتشة | مشروع: <strong>امتحان {activeProject.examType}</strong> ({activeProject.semesterCode})
          </div>
        </div>
      </footer>

      {/* Global Settings Modal */}
      <Suspense fallback={null}>
        {isSettingsModalOpen && (
          <SettingsModal
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            semesterCode={activeProject.semesterCode}
            setSemesterCode={(val) => updateActiveProject({ semesterCode: val })}
            examType={activeProject.examType}
            setExamType={(val) => updateActiveProject({ examType: val })}
            proctors={activeProject.proctors}
            setProctors={(val) => updateActiveProject({ proctors: val })}
            scheduleDays={activeProject.scheduleDays}
            setScheduleDays={(val) => updateActiveProject({ scheduleDays: val })}
            setTotalRoomSlots={(val) => updateActiveProject({ totalRoomSlots: val })}
            setDistributionResult={(val) => updateActiveProject({ distributionResult: val })}
            accounts={accounts}
            setAccounts={setAccounts}
          />
        )}
      </Suspense>

      {/* Real-time Concurrency Conflict Resolution Dialog */}
      {conflictModalConfig && (
        <ConfirmModal
          isOpen={true}
          title="⚠️ تنبيه تعارض: تم تعديل الجدول من جلسة أخرى متزامنة!"
          message={`تم إجراء تعديلات أحدث على هذا المشروع سحابياً (النسخة رقم V${conflictModalConfig.remoteVersion}) في ${conflictModalConfig.remoteUpdatedAt ? new Date(conflictModalConfig.remoteUpdatedAt).toLocaleTimeString('ar-EG') : 'وقت سابق'}. لحماية تعديلاتكم ومنع ضياع أي بيانات، يرجى اختيار الإجراء المناسب:`}
          variant="warning"
          confirmText="تحديث واعتماد النسخة السحابية الأحدث"
          cancelText="فرض حفظ نسختي الحالية واستبدال السحابة"
          consequences={[
            'تحديث النسخة السحابية: سيتم جلب أحدث تعديلات الزملاء التي تم حفظها على السحابة.',
            'فرض نسختك: سيتم استبدال النسخة الموجودة على السحابة بالبيانات الظاهرة أمامك الآن.'
          ]}
          onConfirm={conflictModalConfig.onAcceptRemote}
          onCancel={conflictModalConfig.onForceOverwrite}
        />
      )}

    </div>
  );
}
