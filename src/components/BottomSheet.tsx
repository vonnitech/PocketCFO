import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function BottomSheet({ open, onClose, children, title }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-60 bg-black/60"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-70 bg-surface border-t-4 border-black rounded-t-3xl shadow-[0px_-4px_0px_0px_rgba(0,0,0,0.12)] max-h-[88vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface pt-3 pb-2 px-6 z-10">
              <div className="w-10 h-1 bg-border rounded-full mx-auto mb-3" />
              {title && (
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{title}</p>
              )}
            </div>
            <div className="px-6 pb-24 md:pb-10">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
