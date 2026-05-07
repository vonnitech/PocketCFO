import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Activity, Search } from 'lucide-react';
import { useStore } from '../store/useStore';

export const Audit: React.FC = () => {
  const transactions = useStore(s => s.transactions);

  const { totalOutflow, chartData, rankedCategories } = useMemo(() => {
    let total = 0;
    
    // Group by category, or merchant if category is generic
    const grouped = transactions.reduce((acc, tx) => {
      const key = tx.category === 'PENALTY' ? 'GREMLIN (TAX)' 
                 : tx.category === 'SOCIAL' ? 'SPLITS'
                 : tx.category === 'SAVINGS' ? 'VAULTS'
                 : tx.merchant;
                 
      if (!acc[key]) acc[key] = { name: key, base: 0, gremlin: 0 };
      
      if (tx.category === 'PENALTY') {
        acc[key].gremlin += tx.amount + tx.flipAmount;
      } else {
        acc[key].base += tx.amount;
        acc[key].gremlin += tx.flipAmount;
      }
      return acc;
    }, {} as Record<string, {name: string, base: number, gremlin: number}>);

    const formatted = Object.values(grouped).map(item => {
      const itemTotal = item.base + item.gremlin;
      total += itemTotal;
      return {
        ...item,
        total: itemTotal,
        color: item.gremlin > item.base ? '#FF2A2A' : '#333333' 
      };
    }).filter(i => i.total > 0);

    return {
      totalOutflow: total,
      chartData: formatted,
      rankedCategories: formatted.sort((a, b) => b.total - a.total)
    };
  }, [transactions]);

  return (
    <div className="min-h-screen bg-base flex flex-col pt-8 px-6 pb-20">
      
      {/* Header */}
      <div className="mb-8">
        <p className="text-text-muted text-xs tracking-widest uppercase mb-1 flex items-center gap-2">
          <Activity size={14} /> The Audit
        </p>
        <div className="border-b-2 border-border pb-4">
          <h1 className="font-mono text-5xl text-action-bleed">
            -${totalOutflow.toFixed(2)}
          </h1>
          <p className="text-text-muted text-[10px] uppercase mt-2">Total Logging Outflow</p>
        </div>
      </div>

      {/* The Brutalist Donut Chart */}
      <div className="w-full h-64 mb-8 relative border-2 border-border bg-surface shadow-brutal flex items-center justify-center">
        {/* We use Recharts but strip away all the soft UI elements */}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              innerRadius={70}
              outerRadius={90}
              paddingAngle={2}
              dataKey="total"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: 'var(--bg-secondary)', border: '2px solid var(--border-primary)', borderRadius: 0 }}
              itemStyle={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Target Lock */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <Crosshair size={24} className="text-text-muted mb-1" />
        </div>
      </div>

      {/* The Forensic Breakdown */}
      <div>
        <p className="text-text-muted text-xs tracking-widest uppercase mb-4 border-b-2 border-border pb-2">
          Expense Analysis
        </p>
        
        <div className="space-y-3">
          {rankedCategories.map((category) => (
            <div 
              key={category.name}
              className={`p-4 border-2 flex justify-between items-center ${
                category.isTotalGremlin ? 'border-action-bleed bg-action-bleed/5' : 'border-border bg-surface'
              }`}
            >
              <div>
                <p className="font-mono text-lg text-text-main flex items-center gap-2">
                  {category.name}
                  {category.isTotalGremlin && <ShieldAlert size={16} className="text-action-bleed" />}
                </p>
                
                {/* Micro-bar showing Base vs Gremlin ratio */}
                {category.gremlin > 0 && !category.isTotalGremlin && (
                  <div className="flex gap-2 mt-2 text-[10px] uppercase font-mono text-text-muted">
                    <span>Base: ${category.base}</span>
                    <span className="text-action-bleed">Taxed: ${category.gremlin}</span>
                  </div>
                )}
              </div>
              
              <div className="text-right">
                <span className={`font-mono text-xl ${category.isTotalGremlin ? 'text-action-bleed' : 'text-text-main'}`}>
                  ${category.total.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
