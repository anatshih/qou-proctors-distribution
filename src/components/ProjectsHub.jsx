import React, { useState } from 'react';
import { 
  FolderGit2, Plus, Calendar, Building, Users, Clock, Trash2, 
  ArrowLeft, Search, LogOut, Settings, ShieldCheck, UserCheck, 
  CheckCircle, AlertCircle, Sparkles, FolderPlus
} from 'lucide-react';
import { ROLES } from '../utils/auth';
import { INITIAL_PROCTORS } from '../data/initialProctors';
import { saveProjectToCloud, deleteProjectFromCloud } from '../utils/cloudSync';
import ConfirmModal from './ConfirmModal';

export default function ProjectsHub({
  currentUser,
  onLogout,
  onOpenSettings,
  projects,
  setProjects,
  onOpenProject,
  cloudStatus = 'connected'
}) {
  const isSuperAdmin = currentUser?.role === ROLES.SUPER_ADMIN;

  const [searchTerm, setSearchTerm] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  
  // New Project Form State
  const [newSemesterCode, setNewSemesterCode] = useState('');
  const [newExamType, setNewExamType] = useState('نصفي');
  const [formError, setFormError] = useState('');

  const examTypeOptions = [
    'نصفي',
    'نهائي',
    'غير مكتمل نصفي',
    'غير مكتمل نهائي'
  ];

  const filteredProjects = projects.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      p.semesterCode?.toLowerCase().includes(term) ||
      p.examType?.toLowerCase().includes(term)
    );
  });

  const handleCreateProject = (e) => {
    e.preventDefault();
    setFormError('');

    const cleanSemester = newSemesterCode.trim();
    if (!cleanSemester) {
      setFormError('يرجى إدخال رقم الفصل الدراسي.');
      return;
    }

    // Generate fresh project object with EMPTY schedule and 43 FRESH proctors
    const newProject = {
      id: `proj_${cleanSemester}_${newExamType}_${Date.now()}`,
      semesterCode: cleanSemester,
      examType: newExamType,
      createdAt: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }),
      updatedAt: new Date().toISOString(),
      scheduleDays: [],
      totalRoomSlots: 0,
      uploadedFileName: '',
      proctors: INITIAL_PROCTORS.map(p => ({
        ...p,
        quota: 0,
        isActive: true,
        type: p.type || 'academic',
        excludeSession3: Boolean(p.excludeSession3),
        preferredPair: p.preferredPair || 'any',
        exceptions: []
      })),
      distributionResult: null
    };

    setProjects(prev => [newProject, ...prev]);
    saveProjectToCloud(newProject).catch(err => console.warn('Cloud save error:', err));
    setIsNewProjectModalOpen(false);
    setNewSemesterCode('');
    setNewExamType('نصفي');

    // Immediately open the newly created project
    onOpenProject(newProject.id);
  };

  const handleDeleteProject = (projectId, e) => {
    e.stopPropagation();
    const target = projects.find(p => p.id === projectId);
    setConfirmConfig({
      title: 'تأكيد الحذف النهائي للمشروع',
      message: `هل أنت متأكد من رغبتك في حذف ملف المشروع (فصل ${target?.semesterCode || ''} - امتحان ${target?.examType || ''})؟`,
      variant: 'danger',
      confirmText: 'نعم، حذف المشروع نهائياً',
      cancelText: 'إلغاء وتراجع',
      consequences: [
        'سيتم حذف هذا المشروع وسجلاته وبياناته نهائياً من السحابة وقاعدة البيانات المحلية.',
        'لا يمكن التراجع عن هذا الإجراء أو استعادة بيانات المشروع بعد حذفه.',
        'لن تتأثر المشاريع الأخرى المحفوظة في حسابك.'
      ],
      onConfirm: () => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        deleteProjectFromCloud(projectId).catch(err => console.warn('Cloud delete error:', err));
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col font-sans">

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="bg-qou-primary text-white px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            
            {/* University Title & Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
                <img src="./logo.png" alt="شعار الجامعة" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="font-black text-base lg:text-lg leading-tight">
                  جامعة القدس المفتوحة — فرع الخليل
                </h1>
                <p className="text-xs text-emerald-100">
                  قسم الامتحانات
                </p>
              </div>
            </div>

            {/* User Profile & Actions */}
            <div className="flex items-center gap-3">
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold leading-tight">{currentUser?.name}</div>
                <div className="text-[11px] text-emerald-200 flex items-center justify-end gap-1">
                  {isSuperAdmin ? (
                    <ShieldCheck className="w-3 h-3 text-amber-300" />
                  ) : (
                    <UserCheck className="w-3 h-3 text-emerald-300" />
                  )}
                  <span>{currentUser?.badge}</span>
                </div>
              </div>

              {/* Settings button for Super Admin */}
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-xl transition"
                  title="إعدادات النظام والحسابات"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {/* Logout Button */}
              <button
                type="button"
                onClick={onLogout}
                className="bg-rose-600/80 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                title="تسجيل الخروج من النظام"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تسجيل الخروج</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Hub Body */}
      <main className="max-w-7xl w-full mx-auto px-4 lg:px-8 py-8 flex-1 space-y-6">

        {/* Welcome & Action Banner */}
        <div className="bg-gradient-to-r from-emerald-900 to-qou-dark rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm">
                <FolderGit2 className="w-3.5 h-3.5 text-qou-accent" />
                <span>مستودع البيانات المحفوظة</span>
              </div>

              <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>سحابة قوقل: متصل بالمزامنة الفورية (Google Cloud Firestore)</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight">
              مشاريع وجداول امتحانات الجامعة
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              اختر أي مشروع سابق لمتابعة العمل أو التعديل والطباعة، أو ابدأ مشروعاً جديداً لفصل دراسي قادم.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsNewProjectModalOpen(true)}
            className="bg-qou-accent hover:bg-qou-accentDark text-slate-950 font-black text-sm px-6 py-4 rounded-2xl shadow-xl transition transform active:scale-95 flex items-center gap-2 cursor-pointer flex-shrink-0"
          >
            <Plus className="w-5 h-5 stroke-[3]" />
            <span>بدء مشروع امتحان جديد</span>
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم الفصل أو نوع الامتحان..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-10 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary"
            />
          </div>

          <div className="text-xs text-slate-500 font-bold">
            إجمالي المشاريع في المستودع: <strong>{projects.length}</strong>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FolderPlus className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-lg">لا توجد مشاريع مطابقة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                اضغط على زر "بدء مشروع امتحان جديد" لإضافة فصل دراسي ونوع امتحان جديد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(true)}
              className="bg-qou-primary text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-qou-dark transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول مشروع الآن</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProjects.map((project) => {
              const hasSchedule = project.scheduleDays && project.scheduleDays.length > 0;
              const hasDistribution = Boolean(project.distributionResult);
              const coverageRate = project.distributionResult?.summary?.coverageRate || 0;

              return (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-qou-primary/50 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="bg-slate-100 text-slate-800 font-extrabold text-xs px-3 py-1 rounded-full border border-slate-200">
                        الفصل الدراسي: <strong className="text-qou-primary font-black">{project.semesterCode}</strong>
                      </span>
                      <span className="bg-qou-accentLight text-qou-accentDark font-black text-xs px-3 py-1 rounded-full border border-qou-accent/30">
                        {project.examType}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-slate-800 group-hover:text-qou-primary transition">
                      امتحان {project.examType} — فصل {project.semesterCode}
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>أنشئ في: {project.createdAt}</span>
                    </div>

                    {/* Project Status Indicators */}
                    <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-0.5">القاعات المطلوبة:</span>
                        <strong className="text-slate-800 font-black">
                          {hasSchedule ? `${project.totalRoomSlots} شاغر` : 'بانتظار رفع الملف'}
                        </strong>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[11px] text-slate-400 block mb-0.5">حالة التوزيع:</span>
                        <strong className={hasDistribution ? 'text-emerald-700 font-black' : 'text-slate-500 font-bold'}>
                          {hasDistribution ? `منجز (${coverageRate}%)` : 'لم يتم التوزيع'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenProject(project.id);
                      }}
                      className="bg-qou-primary group-hover:bg-qou-dark text-white text-xs font-black px-4 py-2.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>فتح ومتابعة المشروع</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="حذف هذا المشروع نهائياً"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* New Project Creation Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            
            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-qou-accentLight text-qou-accentDark flex items-center justify-center font-bold">
                  ➕
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-800">
                    إنشاء وبدء مشروع امتحاني جديد
                  </h3>
                  <p className="text-xs text-slate-500">
                    أدخل رقم الفصل واختر نوع الامتحان للبدء
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Semester Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم الفصل الدراسي:
                </label>
                <input
                  type="text"
                  placeholder="مثال: 1261 أو 1262"
                  value={newSemesterCode}
                  onChange={(e) => setNewSemesterCode(e.target.value)}
                  className="w-full text-sm font-bold px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary"
                  required
                  autoFocus
                />
              </div>

              {/* Exam Type */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  نوع الامتحان:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {examTypeOptions.map((type) => {
                    const isSelected = newExamType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setNewExamType(type)}
                        className={`p-3 rounded-xl border text-xs font-bold transition flex items-center justify-between ${
                          isSelected
                            ? 'border-qou-primary bg-emerald-50 text-qou-primary shadow-sm'
                            : 'border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <span>{type}</span>
                        {isSelected && <CheckCircle className="w-4 h-4 text-qou-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Info Note */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                💡 <strong>ملاحظة:</strong> سيتم فتح المشروع بحالة فارغة وجاهزة، مع إدراج كادر الـ 43 مراقباً تلقائياً بأنصبة مصفرة، لتتمكن من رفع ملف الإكسل وإسناد الأعباء الخاصة بهذا الفصل الجديد.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-black bg-qou-primary hover:bg-qou-dark text-white rounded-xl shadow-md transition flex items-center gap-1.5"
                >
                  <span>إنشاء وبدء المشروع</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <div>جامعة القدس المفتوحة — فرع الخليل | المساعد الأكاديمي الدكتور مراد الجندي</div>
          <div>إعداد وتصميم الموقع: الأستاذ أحمد النتشة</div>
        </div>
      </footer>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(confirmConfig)}
        onClose={() => setConfirmConfig(null)}
        {...confirmConfig}
      />

    </div>
  );
}
