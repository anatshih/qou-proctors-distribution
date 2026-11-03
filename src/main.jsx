import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col items-center justify-center font-sans" dir="rtl">
          <div className="max-w-xl w-full bg-slate-800 p-8 rounded-3xl border border-rose-500/50 shadow-2xl space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <h2 className="text-lg font-black text-white">
              حدث خطأ أثناء تحميل الشاشة
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              تم اكتشاف الخطأ تلقائياً. يمكنك النقر على الزر أدناه لتفريغ الجلسة والعودة لمستودع المشاريع بأمان.
            </p>
            <div className="p-3 bg-black/40 rounded-xl text-rose-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
              {String(this.state.error?.message || this.state.error)}
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    sessionStorage.removeItem('qou_active_proj_id');
                  } catch (e) {}
                  window.location.reload();
                }}
                className="bg-qou-primary hover:bg-qou-dark text-white text-xs font-black px-6 py-3 rounded-xl transition cursor-pointer shadow-md"
              >
                العودة لمستودع المشاريع
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);