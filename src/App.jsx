import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ProctorsTab from './components/ProctorsTab';
import ScheduleTab from './components/ScheduleTab';
import DistributionTab from './components/DistributionTab';
import ResultsTab from './components/ResultsTab';
import SettingsModal from './components/SettingsModal';
import LoginModal from './components/LoginModal';

import { INITIAL_PROCTORS } from './data/initialProctors';
import { DEFAULT_SCHEDULE, DEFAULT_TOTAL_SLOTS } from './data/defaultSchedule';
import { getStoredUser } from './utils/auth';

export default function App() {
  // Current logged in user (Super Admin or Admin)
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('proctors');

  // Semester and Exam type settings
  const [semesterCode, setSemesterCode] = useState(() => {
    return localStorage.getItem('qou_semester') || '1261';
  });

  const [examType, setExamType] = useState(() => {
    return localStorage.getItem('qou_exam_type') || 'نصفي';
  });

  // Proctors roster (pre-loaded with the 43 proctor names)
  const [proctors, setProctors] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_proctors');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PROCTORS;
  });

  // Exam Schedule (pre-loaded with the 12-day schedule)
  const [scheduleDays, setScheduleDays] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_schedule_days');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_SCHEDULE;
  });

  const [totalRoomSlots, setTotalRoomSlots] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_total_slots');
      if (stored) return Number(stored);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TOTAL_SLOTS;
  });

  const [uploadedFileName, setUploadedFileName] = useState(() => {
    return localStorage.getItem('qou_uploaded_file') || 'توزيع المراقبين 1261.xlsx (الجدول المعتمد)';
  });

  // Distribution Results
  const [distributionResult, setDistributionResult] = useState(() => {
    try {
      const stored = localStorage.getItem('qou_dist_result');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Local Storage Sync Effects
  useEffect(() => {
    localStorage.setItem('qou_semester', semesterCode);
  }, [semesterCode]);

  useEffect(() => {
    localStorage.setItem('qou_exam_type', examType);
  }, [examType]);

  useEffect(() => {
    localStorage.setItem('qou_proctors', JSON.stringify(proctors));
  }, [proctors]);

  useEffect(() => {
    localStorage.setItem('qou_schedule_days', JSON.stringify(scheduleDays));
  }, [scheduleDays]);

  useEffect(() => {
    localStorage.setItem('qou_total_slots', String(totalRoomSlots));
  }, [totalRoomSlots]);

  useEffect(() => {
    localStorage.setItem('qou_uploaded_file', uploadedFileName);
  }, [uploadedFileName]);

  useEffect(() => {
    if (distributionResult) {
      localStorage.setItem('qou_dist_result', JSON.stringify(distributionResult));
    }
  }, [distributionResult]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8faf9] text-slate-800">
      
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={() => setIsLoginModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        semesterCode={semesterCode}
        examType={examType}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        
        {activeTab === 'proctors' && (
          <ProctorsTab
            proctors={proctors}
            setProctors={setProctors}
            scheduleDays={scheduleDays}
            totalRoomSlots={totalRoomSlots}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            scheduleDays={scheduleDays}
            setScheduleDays={setScheduleDays}
            totalRoomSlots={totalRoomSlots}
            setTotalRoomSlots={setTotalRoomSlots}
            uploadedFileName={uploadedFileName}
            setUploadedFileName={setUploadedFileName}
          />
        )}

        {activeTab === 'distribution' && (
          <DistributionTab
            proctors={proctors}
            scheduleDays={scheduleDays}
            setScheduleDays={setScheduleDays}
            totalRoomSlots={totalRoomSlots}
            distributionResult={distributionResult}
            setDistributionResult={setDistributionResult}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'results' && (
          <ResultsTab
            scheduleDays={scheduleDays}
            proctors={proctors}
            distributionResult={distributionResult}
            semesterCode={semesterCode}
            examType={examType}
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
            الفصل الدراسي: <strong>{semesterCode}</strong> | الامتحان: <strong>{examType}</strong>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        semesterCode={semesterCode}
        setSemesterCode={setSemesterCode}
        examType={examType}
        setExamType={setExamType}
        proctors={proctors}
        setProctors={setProctors}
        scheduleDays={scheduleDays}
        setScheduleDays={setScheduleDays}
        setTotalRoomSlots={setTotalRoomSlots}
        setDistributionResult={setDistributionResult}
      />

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
      />

    </div>
  );
}
