import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import ProjectsHub from './components/ProjectsHub';
import Navbar from './components/Navbar';
import ProctorsTab from './components/ProctorsTab';
import ScheduleTab from './components/ScheduleTab';
import DistributionTab from './components/DistributionTab';
import ResultsTab from './components/ResultsTab';
import SettingsModal from './components/SettingsModal';

import { INITIAL_PROCTORS } from './data/initialProctors';
import { DEFAULT_SCHEDULE, DEFAULT_TOTAL_SLOTS } from './data/defaultSchedule';
import { getStoredAccounts, saveStoredAccounts } from './utils/auth';

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
  const [projects, setProjects] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_all_projects');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }

    // Default Seed Project: Semester 1261 Midterm
    return [
      {
        id: 'proj_1261_midterm_default',
        semesterCode: '1261',
        examType: 'نصفي',
        createdAt: '3 نوفمبر 2026',
        updatedAt: new Date().toISOString(),
        scheduleDays: DEFAULT_SCHEDULE,
        totalRoomSlots: DEFAULT_TOTAL_SLOTS,
        uploadedFileName: 'توزيع المراقبين 1261.xlsx (الجدول المعتمد)',
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

  // Helper to update fields of the active project
  const updateActiveProject = (updater) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => {
      if (p.id === activeProjectId) {
        const updated = typeof updater === 'function' ? updater(p) : { ...p, ...updater };
        return { ...updated, updatedAt: new Date().toISOString() };
      }
      return p;
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
          onOpenProject={(id) => {
            setActiveProjectId(id);
            setActiveTab('proctors');
          }}
        />

        {/* Global Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          semesterCode="1261"
          setSemesterCode={() => {}}
          examType="نصفي"
          setExamType={() => {}}
          proctors={INITIAL_PROCTORS}
          setProctors={() => {}}
          scheduleDays={DEFAULT_SCHEDULE}
          setScheduleDays={() => {}}
          setTotalRoomSlots={() => {}}
          setDistributionResult={() => {}}
          accounts={accounts}
          setAccounts={setAccounts}
        />
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
      />

      {/* Main Project Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {/* Tab 1: Proctors Management for this project */}
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
            totalRoomSlots={activeProject.totalRoomSlots || 0}
          />
        )}

        {/* Tab 2: Exam Rooms Schedule for this project */}
        {activeTab === 'schedule' && (
          <ScheduleTab
            scheduleDays={activeProject.scheduleDays || []}
            setScheduleDays={(newDays) => {
              updateActiveProject(prev => ({
                ...prev,
                scheduleDays: typeof newDays === 'function' ? newDays(prev.scheduleDays || []) : newDays
              }));
            }}
            totalRoomSlots={activeProject.totalRoomSlots || 0}
            setTotalRoomSlots={(slots) => {
              updateActiveProject({ totalRoomSlots: slots });
            }}
            uploadedFileName={activeProject.uploadedFileName || ''}
            setUploadedFileName={(name) => {
              updateActiveProject({ uploadedFileName: name });
            }}
          />
        )}

        {/* Tab 3: Distribution Engine for this project */}
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
            totalRoomSlots={activeProject.totalRoomSlots || 0}
            distributionResult={activeProject.distributionResult}
            setDistributionResult={(result) => {
              updateActiveProject({ distributionResult: result });
            }}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Tab 4: Results & Print-ready Views for this project */}
        {activeTab === 'results' && (
          <ResultsTab
            scheduleDays={activeProject.scheduleDays || []}
            proctors={activeProject.proctors || []}
            distributionResult={activeProject.distributionResult}
            semesterCode={activeProject.semesterCode}
            examType={activeProject.examType}
          />
        )}

      </main>

      {/* Screen Footer (Hidden in Print) */}
      <footer className="no-print border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>نظام التوزيع الذكي لمراقبات الامتحانات — جامعة القدس المفتوحة</span>
          </div>
          <div>
            مشروع: <strong>امتحان {activeProject.examType}</strong> | الفصل الدراسي: <strong>{activeProject.semesterCode}</strong>
          </div>
        </div>
      </footer>

      {/* Global Settings Modal */}
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

    </div>
  );
}
