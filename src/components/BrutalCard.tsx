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
      className={`relative border-4 border-border overflow-hidden shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all ${color} ${className}`}
    >
      {title && (
        <div className="px-6 py-3 border-b-4 border-border bg-border/5">
          <h3 className="font-black italic uppercase text-xs tracking-widest leading-none">{title}</h3>
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </motion.div>
  );
}
