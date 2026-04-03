import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
  const maxVisible = 4;
  const visibleToasts = toasts.slice(0, maxVisible);
  const remainingCount = toasts.length - maxVisible;

  return (
    <div 
      className="fixed top-4 right-4 z-[9999] flex flex-col items-end gap-1 pointer-events-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onRemove={onRemove} 
            index={index}
            totalCount={visibleToasts.length}
            isStacked={visibleToasts.length > 1 && !isHovered}
          />
        ))}
      </AnimatePresence>
      {remainingCount > 0 && !isHovered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="pointer-events-auto px-3 py-1 bg-inner2 border border-border rounded-full text-xs text-text-s shadow-lg"
        >
          +{remainingCount} more
        </motion.div>
      )}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
  index: number;
  totalCount: number;
  isStacked: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({ 
  toast, 
  onRemove,
  index,
  totalCount,
  isStacked
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  // Calculate stacked offset - newer toasts are on top
  const reverseIndex = totalCount - 1 - index;
  const stackOffset = isStacked ? reverseIndex * 6 : 0;
  const stackScale = isStacked ? 1 - reverseIndex * 0.03 : 1;
  const stackOpacity = isStacked ? 1 - reverseIndex * 0.2 : 1;
  const zIndex = index;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -30, scale: 0.9, x: 50 }}
      animate={{ 
        opacity: Math.max(0.5, stackOpacity), 
        y: stackOffset, 
        scale: Math.max(0.9, stackScale),
        x: 0,
        zIndex
      }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ 
        type: 'spring',
        stiffness: 400,
        damping: 30,
        layout: { duration: 0.2 }
      }}
      style={{ zIndex }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border min-w-[280px] max-w-[400px] ${
        toast.type === 'success' 
          ? 'bg-green-500/95 border-green-400/30 text-white' 
          : 'bg-red-500/95 border-red-400/30 text-white'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle size={20} className="flex-shrink-0" />
      ) : (
        <XCircle size={20} className="flex-shrink-0" />
      )}
      <p className="text-sm font-medium flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 rounded-full hover:bg-white/20 transition-colors flex-shrink-0"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

// Hook for using toasts
import { useCallback } from 'react';

export const useToasts = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
};
