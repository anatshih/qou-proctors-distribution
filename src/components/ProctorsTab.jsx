import React, { useState } from 'react';
import { 
  Users, UserCheck, UserX, Plus, Search, Trash2, Calendar, 
  RotateCcw, CheckSquare, XSquare, AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import ExceptionsModal from './ExceptionsModal';

export default function ProctorsTab({
  proctors,
  setProctors,
  scheduleDays,
  totalRoomSlots
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'frozen'
  const [editingExceptionsProctor, setEditingExceptionsProctor] = useState(null);
  const [newProctorName, setNewProctorName] = useState('');
  const [newProctorQuota, setNewProctorQuota] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Statistics
  const totalCount = proctors.length;
  const activeCount = proctors.filter(p => p.isActive).length;
  const frozenCount = totalCount - activeCount;
  const totalQuotasAssigned = proctors
    .filter(p => p.isActive)
    .reduce((sum, p) => sum + (Number(p.quota) || 0), 0);
  const diffSlots = totalQuotasAssigned - totalRoomSlots;

  // Filtered proctors
  const filteredProctors = proctors.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (statusFilter === 'active') return matchesSearch && p.isActive;
    if (statusFilter === 'frozen') return matchesSearch && !p.isActive;
    return matchesSearch;
  });

  // Handlers
  const handleToggleActive = (id) => {
    setProctors(prev => prev.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    ));
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
      quota: parseInt(newProctorQuota, 10) || 0,
      isActive: true,
      exceptions: []
    };
    setProctors(prev => [newP, ...prev]);
    setNewProctorName('');
    setNewProctorQuota('');
    setShowAddForm(false);
  };

  const handleSaveExceptions = (proctorId, exceptionsList) => {
    setProctors(prev => prev.map(p => 
      p.id === proctorId ? { ...p, exceptions: exceptionsList } : p
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        
        {/* Total Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">إجمالي الكادر</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800">{totalCount}</div>
          <div className="text-[11px] text-slate-400">مراقب مسجل</div>
        </div>

        {/* Active Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-700 mb-1">
            <span className="text-xs font-bold">المراقبون النشطون</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{activeCount}</div>
          <div className="text-[11px] text-emerald-600 font-medium">مشاركون في الامتحان</div>
        </div>

        {/* Frozen Proctors */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">المجمدون (احتياط)</span>
            <UserX className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-600">{frozenCount}</div>
          <div className="text-[11px] text-slate-400">معفون من هذا الامتحان</div>
        </div>

        {/* Total Quotas Defined */}
        <div className="bg-white p-4 rounded-2xl border border-qou-accent/40 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
          <div className="flex items-center justify-between text-amber-800 mb-1">
            <span className="text-xs font-bold">مجموع الأنصبة المحددة</span>
            <span className="text-xs font-bold text-qou-accent">🎯</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalQuotasAssigned}</div>
          <div className="text-[11px] text-amber-700">حصة مراقبة مدخلة</div>
        </div>

        {/* Total Exam Slots Required */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-bold">شواغر القاعات المطلوبة</span>
            <span className="text-xs">🏫</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{totalRoomSlots}</div>
          <div className="text-[11px] text-slate-500">شاغر حسب جدول القاعات</div>
        </div>

        {/* Balance Status Indicator */}
        <div className={`p-4 rounded-2xl border shadow-sm ${
          diffSlots === 0 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : diffSlots < 0 
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold">ميزان التغطية</span>
            {diffSlots === 0 ? (
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            ) : diffSlots < 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
          </div>
          <div className="text-2xl font-black">
            {diffSlots === 0 ? 'مكتمل 100%' : diffSlots < 0 ? `${diffSlots}` : `+${diffSlots}`}
          </div>
          <div className="text-[11px] font-semibold">
            {diffSlots === 0 
              ? 'تطابق تام ومثالي' 
              : diffSlots < 0 
              ? `عجز ${Math.abs(diffSlots)} شاغر مطلوب تغطيتها` 
              : `فائض ${diffSlots} حصص إضافية`}
          </div>
        </div>

      </div>

      {/* Main Controls Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6 space-y-4">
        
        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
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
            
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : ''}`}
              >
                الكل ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'active' ? 'bg-white text-emerald-800 shadow-sm' : ''}`}
              >
                نشط ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('frozen')}
                className={`px-3 py-1.5 rounded-lg transition ${statusFilter === 'frozen' ? 'bg-white text-slate-700 shadow-sm' : ''}`}
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
              className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مراقب جديد</span>
            </button>

            <button
              type="button"
              onClick={handleActivateAll}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5"
              title="تفعيل جميع المراقبين للامتحان الحالي"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>تفعيل الجميع</span>
            </button>

            <button
              type="button"
              onClick={handleFreezeAll}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5"
              title="تجميد جميع المراقبين"
            >
              <XSquare className="w-3.5 h-3.5 text-slate-500" />
              <span>تجميد الجميع</span>
            </button>

            <button
              type="button"
              onClick={handleResetQuotas}
              className="bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1.5 border border-slate-200"
              title="تصفير أعباء جميع المراقبين لبدء دورة جديدة"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير الأعباء</span>
            </button>
          </div>
        </div>

        {/* Add Proctor Inline Form */}
        {showAddForm && (
          <form onSubmit={handleAddProctor} className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
            <div className="font-bold text-sm text-emerald-900">إضافة عضو جديد لكادر المراقبين:</div>
            <input
              type="text"
              placeholder="الاسم الثلاثي أو الرباعي للمراقب"
              value={newProctorName}
              onChange={(e) => setNewProctorName(e.target.value)}
              className="flex-1 min-w-[200px] text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
              required
            />
            <input
              type="number"
              placeholder="النصاب المطلوب (مثلاً: 12)"
              value={newProctorQuota}
              onChange={(e) => setNewProctorQuota(e.target.value)}
              className="w-40 text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary"
              min="0"
            />
            <button
              type="submit"
              className="bg-qou-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-qou-dark transition"
            >
              حفظ وإضافة
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-2"
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
                <th className="py-3 px-3 w-32 text-center">الحالة للدورة</th>
                <th className="py-3 px-3 w-40 text-center">العبء / النصاب المطلوب</th>
                <th className="py-3 px-3 w-44 text-center">الاستثناءات والاعتذارات</th>
                <th className="py-3 px-3 w-20 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProctors.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    لا يوجد مراقبون يطابقون خيارات البحث.
                  </td>
                </tr>
              ) : (
                filteredProctors.map((proctor, idx) => {
                  const hasExceptions = (proctor.exceptions || []).length > 0;
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

                      {/* Name */}
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={proctor.name}
                          onChange={(e) => handleUpdateName(proctor.id, e.target.value)}
                          className="w-full bg-transparent font-semibold text-slate-800 hover:bg-white focus:bg-white focus:ring-1 focus:ring-qou-primary border border-transparent hover:border-slate-200 rounded px-2 py-1 text-sm"
                        />
                      </td>

                      {/* Status Toggle (Active / Frozen) */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(proctor.id)}
                          className={`text-xs px-3 py-1 rounded-full font-bold transition flex items-center justify-center gap-1.5 mx-auto ${
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
                            className="w-20 text-center font-bold py-1 px-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-qou-primary disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <span className="text-xs text-slate-400 font-medium">مراقبة</span>
                        </div>
                      </td>

                      {/* Exceptions Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={!proctor.isActive}
                          onClick={() => setEditingExceptionsProctor(proctor)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center justify-center gap-1.5 mx-auto border ${
                            hasExceptions
                              ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {hasExceptions 
                              ? `${proctor.exceptions.length} استثناء` 
                              : 'تحديد استثناءات'}
                          </span>
                        </button>
                      </td>

                      {/* Delete */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteProctor(proctor.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
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
