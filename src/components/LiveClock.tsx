import React, { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

export const LiveClock: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div className={`flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-slate-300 ${className}`}>
      <Clock3 size={14} />
      <span className="font-mono text-sm font-bold tabular-nums">{now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
};
