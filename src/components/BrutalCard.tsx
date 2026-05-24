import React from 'react';
import { motion } from 'motion/react';

interface BrutalCardProps {
  children: React.ReactNode;
  color?: string;
  title?: React.ReactNode;
  className?: string;
  variants?: any;
}

export default function BrutalCard({ children, color = 'bg-surface', className = '', title }: BrutalCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative border-4 border-border rounded-[32px] overflow-hidden shadow-[8px_8px_0px_0px_var(--shadow-color)] ${color} ${className}`}
    >
      {title && (
        <div className="px-6 py-3 border-b-[4px] border-black">
          <h3 className="font-black italic uppercase text-xs tracking-widest leading-none text-text-main">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}
