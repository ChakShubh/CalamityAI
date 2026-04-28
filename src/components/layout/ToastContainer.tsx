import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { CheckCircle, AlertTriangle, XCircle, X, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ToastContainer() {
  const { toasts, dismissToast } = useData();
  const navigate = useNavigate();

  return (
    <div className="fixed top-16 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.filter(t => t.visible).map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`pointer-events-auto glass-light rounded-xl px-4 py-3 flex items-start gap-3 min-w-[300px] max-w-[400px] border ${
              toast.link ? 'cursor-pointer hover:bg-slate-800/50' : ''
            } ${
              toast.type === 'success' ? 'border-emerald-500/30 glow-cyan' :
              toast.type === 'warning' ? 'border-amber-500/30 glow-amber' :
              toast.type === 'info' ? 'border-cyan-500/30 glow-cyan' :
              'border-rose-500/30 glow-rose'
            }`}
            onClick={() => {
               if (toast.link) {
                  navigate(toast.link);
                  dismissToast(toast.id);
               }
            }}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />}
            <span className="text-xs text-slate-200 flex-1">{toast.message}</span>
            <button onClick={(e) => { e.stopPropagation(); dismissToast(toast.id); }} className="text-slate-500 hover:text-slate-300 flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
