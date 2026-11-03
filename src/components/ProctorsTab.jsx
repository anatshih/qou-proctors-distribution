import React, { useState } from 'react';
import { 
  Users, UserCheck, UserX, Plus, Search, Trash2, Calendar, 
  RotateCcw, CheckSquare, XSquare, AlertTriangle, CheckCircle, Info, ArrowLeft,
  GraduationCap, Briefcase, Ban, Star, ShieldCheck
} from 'lucide-react';
import ExceptionsModal from './ExceptionsModal';
import { sortProctors } from '../utils/proctorsHelper.js';

export default function ProctorsTab({
  proctors,
  setProctors,
  scheduleDays,
  totalRoomSlots,
  onNavigateNext
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'academic' | 'administrative' | 'active' | 'frozen'
  const [editingExceptionsProctor, setEditingExceptionsProctor] = useState(null);
  const [newProctorName, setNewProctorName] = useState('');
  const [newProctorQuota, setNewProctorQuota] = useState('');
  const [newProctorType, setNewProctorType] = useState('academic');
  const [showAddForm, setShowAddForm] = useState(false);

  // Statistics
  const totalCount = proctors.length;
  const activeCount = proctors.filter(p => p.isActive).length;
  const frozenCount = totalCount - activeCount;
  const academicCount = proctors.filter(p => (p.type || 'academic') === 'academic').length;
  const administrativeCount = proctors.filter(p => p.type === 'administrative').length;

  const totalQuotasAssigned = proctors
    .filter(p => p.isActive)
    .reduce((sum, p) => sum + (Number(p.quota) || 0), 0);
  const diffSlots = totalQuotasAssigned - totalRoomSlots;

  // Filtered and canonically sorted proctors (Academics first, then Administrative, alphabetical in Arabic)
  const filteredProctors = sortProctors(
    proctors.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const proctorType = p.type || 'academic';
      if (filterMode === 'academic') return proctorType === 'academic';
      if (filterMode === 'administrative') return proctorType === 'administrative';
      if (filterMode === 'active') return p.isActive;
      if (filterMode === 'frozen') return !p.isActive;
      return true;
    })
  );

  // Handlers
  const handleToggleActive = (id) => {
    setProctors(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    ));
  };

  const handleToggleType = (id) => {
    setProctors(prev => prev.map(p => {
      if (p.id !== id) return p;
      const currentType = p.type || 'academic';
      const nextType = currentType === 'academic' ? 'administrative' : 'academic';
      return { ...p, type: nextType };
    }));
  };

  const handleUpdateQuota = (id, newQuota) => {
    const val = Math.max(0, parseInt(newQuota, 10) || 0);
    setProctors(prev => prev.map(p => 
      p.id === id ? { ...p, quota: val } : p
    ));
  };

  const handleUpdateName = (id, newName) => {
    setProctors(prev => prev.map(p => 
      p.id === id ? { ...p, name: newName } : p
    ));
  };

  const handleDeleteProctor = (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المراقب نهائياً من الكادر؟')) {
      setProctors(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleAddProctor = (e) => {
    e.preventDefault();
    if (!newProctorName.trim()) return;
    const newId = `proc_${Date.now()}`;
    const newP = {
      id: newId,
      name: newProctorName.trim(),
      type: newProctorType,
      quota: parseInt(newProctorQuota, 10) || 0,
      isActive: true,
      excludeSession3: false,
      preferredPair: 'any',
      exceptions: []
    };
    setProctors(prev => [newP, ...prev]);
    setNewProctorName('');
    setNewProctorQuota('');
    setNewProctorType('academic');
    setShowAddForm(false);
  };

  const handleSaveExceptions = (proctorId, exceptionsList, preferences = {}) => {
    setProctors(prev => prev.map(p => 
      p.id === proctorId ? { 
        ...p, 
        exceptions: exceptionsList,
        excludeSession3: preferences.excludeSession3 !== undefined ? preferences.excludeSession3 : Boolean(p.excludeSession3),
        preferredPair: preferences.preferredPair !== undefined ? preferences.preferredPair : (p.preferredPair || 'any')
      } : p
    ));
  };

  const handleActivateAll = () => {
    setProctors(prev => prev.map(p => ({ ...p, isActive: true })));
  };

  const handleFreezeAll = () => {
    setProctors(prev => prev.map(p => ({ ...p, isActive: false })));
  };

  const handleResetQuotas = () => {
    if (window.confirm('هل تريد تصفير جميع الأعباء والأنصبة لجميع المراقبين لبدء دورة جديدة؟')) {
      setProctors(prev => prev.map(p => ({ ...p, quota: 0 })));
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">إجمالي الكادر</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">{totalCount}</div>
          <div className="text-[11px] text-slate-400">مراقب مسجل بالجامعة</div>
        </div>

        {/* Academic Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between text-indigo-700 mb-1">
            <span className="text-xs font-bold">الكادر الأكاديمي</span>
            <GraduationCap className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-800">{academicCount}</div>
          <div className="text-[11px] text-indigo-600 font-medium">أولوية أولى لاستيفاء العبء</div>
        </div>

        {/* Administrative Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold">الكادر الإداري</span>
            <Briefcase className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800">{administrativeCount}</div>
          <div className="text-[11px] text-amber-700 font-medium">إسناد وتغطية النقص</div>
        </div>

        {/* Active Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-xs bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold">المشاركون (النشطون)</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{activeCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium">{frozenCount} احتياط مجمّد</div>
        </div>

        {/* Total Quotas Defined */}
        <div className="bg-white p-4 rounded-2xl border border-qou-accent/40 shadow-xs bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold">مجموع الأنصبة</span>
            <span className="text-xs font-bold text-qou-accent">🎯</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalQuotasAssigned}</div>
          <div className="text-[11px] text-amber-700">حصة مراقبة مدخلة</div>
        </div>

        {/* Balance Status Indicator */}
        <div className={`p-4 rounded-2xl border shadow-xs ${
          diffSlots === 0 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : diffSlots < 0 
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold">ميزان الشواغر</span>
            {diffSlots === 0 ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : diffSlots < 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div className="text-2xl font-black">
            {diffSlots === 0 ? '100% تطابق' : diffSlots < 0 ? `${diffSlots}` : `+${diffSlots}`}
          </div>
          <div className="text-[11px] font-semibold">
            {diffSlots === 0 
              ? `يغطي تماماً ${totalRoomSlots} شاغر` 
              : diffSlots < 0 
              ? `عجز ${Math.abs(diffSlots)} من أصل ${totalRoomSlots}` 
              : `فائض ${diffSlots} حصص`}
          </div>
        </div>

      </div>

      {/* Main Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 lg:p-6 space-y-4">
        
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث باسم المراقب..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-qou-primary/20 focus:border-qou-primary"
              />
            </div>
            
            <div className="flex flex-wrap rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600 gap-0.5">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                الكل ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('academic')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${filterMode === 'academic' ? 'bg-white text-indigo-800 shadow-xs' : 'hover:text-indigo-800'}`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                <span>أكاديمي ({academicCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('administrative')}
                className={`px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer ${filterMode === 'administrative' ? 'bg-white text-amber-800 shadow-xs' : 'hover:text-amber-800'}`}
              >
                <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                <span>إداري ({administrativeCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('active')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${filterMode === 'active' ? 'bg-white text-emerald-800 shadow-xs' : 'hover:text-emerald-800'}`}
              >
                نشط ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('frozen')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${filterMode === 'frozen' ? 'bg-white text-slate-700 shadow-xs' : 'hover:text-slate-800'}`}
              >
                مجمّد ({frozenCount})
              </button>
            </div>
          </div>

          {/* Quick Bulk Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(prev => !prev)}
              className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مراقب جديد</span>
            </button>

            <button
              type="button"
              onClick={handleActivateAll}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="تفعيل جميع المراقبين للامتحان الحالي"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>تفعيل الجميع</span>
            </button>

            <button
              type="button"
              onClick={handleFreezeAll}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              title="تجميد جميع المراقبين"
            >
              <XSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>تجميد الجميع</span>
            </button>

            <button
              type="button"
              onClick={handleResetQuotas}
              className="bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
              title="تصفير أعباء جميع المراقبين لبدء دورة جديدة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير الأعباء</span>
            </button>
          </div>
        </div>

        {/* Add Proctor Inline Form */}
        {showAddForm && (
          <form onSubmit={handleAddProctor} className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
            <div className="font-bold text-sm text-indigo-950">إضافة عضو جديد لكادر المراقبين:</div>
            
            <input
              type="text"
              placeholder="الاسم الثلاثي أو الرباعي للمراقب"
              value={newProctorName}
              onChange={(e) => setNewProctorName(e.target.value)}
              className="flex-1 min-w-[200px] text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
              required
            />

            {/* Type selector */}
            <select
              value={newProctorType}
              onChange={(e) => setNewProctorType(e.target.value)}
              className="text-xs font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary text-slate-800"
            >
              <option value="academic">🎓 كادر أكاديمي (نصاب تعاقدي ملزم)</option>
              <option value="administrative">💼 كادر إداري (سقف أقصى مساند)</option>
            </select>

            <input
              type="number"
              placeholder="النصاب / السقف الأعلى"
              value={newProctorQuota}
              onChange={(e) => setNewProctorQuota(e.target.value)}
              className="w-44 text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
              min="0"
            />

            <button
              type="submit"
              className="bg-qou-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-qou-dark transition cursor-pointer"
            >
              حفظ وإضافة
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-2 cursor-pointer"
            >
              إلغاء
            </button>
          </form>
        )}

        {/* Proctors Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-xs">
              <tr>
                <th className="py-3 px-3 w-12 text-center">#</th>
                <th className="py-3 px-4">اسم المراقب</th>
                <th className="py-3 px-3 w-36 text-center">التصنيف (أكاديمي / إداري)</th>
                <th className="py-3 px-3 w-28 text-center">الحالة للدورة</th>
                <th className="py-3 px-3 w-40 text-center">النصاب الأكاديمي / السقف الإداري</th>
                <th className="py-3 px-3 w-48 text-center">الاستثناءات والتفضيلات</th>
                <th className="py-3 px-3 w-16 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProctors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    لا يوجد مراقبون يطابقون خيارات البحث أو التصفية.
                  </td>
                </tr>
              ) : (
                filteredProctors.map((proctor, idx) => {
                  const isAcademic = (proctor.type || 'academic') === 'academic';
                  const hasExceptions = (proctor.exceptions || []).length > 0;
                  const hasExcludeS3 = Boolean(proctor.excludeSession3);
                  const hasPreferred = proctor.preferredPair && proctor.preferredPair !== 'any';

                  return (
                    <tr 
                      key={proctor.id} 
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !proctor.isActive ? 'bg-slate-50/50 opacity-60' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Name with badges */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={proctor.name}
                            onChange={(e) => handleUpdateName(proctor.id, e.target.value)}
                            className="w-full bg-transparent font-semibold text-slate-800 hover:bg-white focus:bg-white focus:ring-1 focus:ring-qou-primary border border-transparent hover:border-slate-200 rounded px-2 py-1 text-sm"
                          />
                          {(hasExcludeS3 || hasPreferred) && (
                            <div className="flex flex-wrap items-center gap-1.5 px-2">
                              {hasExcludeS3 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                                  <Ban className="w-3 h-3" />
                                  <span>مستبعد من الجلسة 3</span>
                                </span>
                              )}
                              {hasPreferred && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span>تفضيل ({proctor.preferredPair === '1-2' ? '1 و 2' : '2 و 3'})</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Classification Toggle: Academic vs Administrative */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleType(proctor.id)}
                          className={`text-xs px-2.5 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 mx-auto border cursor-pointer shadow-xs ${
                            isAcademic
                              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                              : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          }`}
                          title="انقر للتبديل بين أكاديمي (نصاب تعاقدي ملزم) وإداري (سقف أقصى مساند)"
                        >
                          {isAcademic ? (
                            <>
                              <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                              <span>🎓 أكاديمي (ملزم)</span>
                            </>
                          ) : (
                            <>
                              <Briefcase className="w-3.5 h-3.5 text-amber-600" />
                              <span>💼 إداري (سقف)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Status Toggle (Active / Frozen) */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(proctor.id)}
                          className={`text-xs px-2.5 py-1 rounded-full font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer ${
                            proctor.isActive
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${proctor.isActive ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                          <span>{proctor.isActive ? 'نشط' : 'مجمّد'}</span>
                        </button>
                      </td>

                      {/* Quota Input */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            disabled={!proctor.isActive}
                            value={proctor.quota === 0 ? '' : proctor.quota}
                            placeholder="0"
                            onChange={(e) => handleUpdateQuota(proctor.id, e.target.value)}
                            className="w-16 text-center font-bold py-1 px-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <span className="text-xs text-slate-400 font-medium">مراقبة</span>
                        </div>
                      </td>

                      {/* Exceptions & Preferences Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!proctor.isActive}
                          onClick={() => setEditingExceptionsProctor(proctor)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 mx-auto border cursor-pointer ${
                            hasExceptions || hasExcludeS3 || hasPreferred
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {hasExceptions 
                              ? `${proctor.exceptions.length} استثناء` 
                              : hasExcludeS3 
                              ? 'استبعاد ج3'
                              : hasPreferred
                              ? 'تفضيل محدد'
                              : 'استثناءات وتفضيل'}
                          </span>
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteProctor(proctor.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="حذف المراقب من الكادر نهائياً"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Next Step Action Card at the bottom of Proctors */}
        <div className="p-5 bg-gradient-to-l from-slate-50 to-emerald-50/40 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 mt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                diffSlots === 0 && totalRoomSlots > 0 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 text-slate-700'
              }`}>
                الخطوة 2: كادر المراقبين
              </span>
              <h4 className="text-sm font-black text-slate-900">
                {diffSlots === 0 && totalRoomSlots > 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600 inline" />
                    تمت مطابقة الأنصبة مع الشواغر بنجاح 100% ({totalQuotasAssigned} من {totalRoomSlots})
                  </span>
                ) : (
                  <span>
                    إجمالي الأنصبة الحالية: <strong>{totalQuotasAssigned}</strong> من أصل <strong>{totalRoomSlots}</strong> شاغر
                  </span>
                )}
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              بعد اكتمال تصنيف الكادر وإدخال الأنصبة والاستثناءات، انتقل مباشرة للخطوة 3 لإطلاق التوزيع الآلي الذكي.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateNext?.('distribution')}
            className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3.5 rounded-2xl shadow-md shadow-qou-primary/20 transition flex items-center gap-2 cursor-pointer"
          >
            <span>الانتقال للخطوة 3: محرك التوزيع الآلي</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Exceptions Modal */}
      {editingExceptionsProctor && (
        <ExceptionsModal
          isOpen={Boolean(editingExceptionsProctor)}
          onClose={() => setEditingExceptionsProctor(null)}
          proctor={editingExceptionsProctor}
          scheduleDays={scheduleDays}
          onSaveExceptions={handleSaveExceptions}
        />
      )}

    </div>
  );
}
