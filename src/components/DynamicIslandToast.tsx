import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, Wifi, ShieldCheck, Sparkles } from 'lucide-react';

export interface ToastPayload {
  id: string;
  title: string;
  subtitle?: string;
  type?: 'copy' | 'sync' | 'secret' | 'success';
}

interface DynamicIslandToastProps {
  toast: ToastPayload | null;
}

export const DynamicIslandToast: React.FC<DynamicIslandToastProps> = ({ toast }) => {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -24, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            transition={{
              type: 'spring',
              stiffness: 420,
              damping: 28,
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-black/90 dark:bg-neutral-900/95 text-white shadow-2xl backdrop-blur-2xl border border-white/15 dark:border-white/20 min-w-[240px] max-w-[420px] pointer-events-auto"
          >
            {/* Dynamic Island Leading Icon */}
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 shrink-0 text-[#2997ff]">
              {toast.type === 'copy' && <Copy className="w-3.5 h-3.5 text-[#30d158]" />}
              {toast.type === 'sync' && <Wifi className="w-3.5 h-3.5 text-[#2997ff]" />}
              {toast.type === 'secret' && <ShieldCheck className="w-3.5 h-3.5 text-[#ffd60a]" />}
              {toast.type === 'success' && <Check className="w-3.5 h-3.5 text-[#30d158]" />}
              {!toast.type && <Sparkles className="w-3.5 h-3.5 text-[#2997ff]" />}
            </div>

            {/* Notification Text */}
            <div className="flex flex-col min-w-0 flex-1 pr-1">
              <span className="text-xs font-semibold tracking-tight text-white truncate">
                {toast.title}
              </span>
              {toast.subtitle && (
                <span className="text-[11px] text-neutral-400 truncate">
                  {toast.subtitle}
                </span>
              )}
            </div>

            {/* Trailing Affirmation Pip */}
            <div className="w-2 h-2 rounded-full bg-[#30d158] animate-pulse shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
