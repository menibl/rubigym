import React, { useEffect, useState } from 'react';
import { MonitorPlay } from 'lucide-react';
import { GroupWorkoutProgram } from '../types';
import { getActiveClubDisplay } from '../data/clubDisplayRemote';
import { GroupWorkoutDisplay } from './GroupWorkoutDisplay';

export const ClubWorkoutDisplay: React.FC = () => {
  const [program, setProgram] = useState<GroupWorkoutProgram>();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const active = await getActiveClubDisplay();
        if (!disposed) {
          setProgram(current => active?.id === current?.id && active?.updatedAt === current?.updatedAt ? current : active);
          setOffline(false);
        }
      } catch {
        if (!disposed) setOffline(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  if (program) return <GroupWorkoutDisplay program={program} />;
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-center text-white" dir="rtl">
    <div><MonitorPlay className="mx-auto text-amber-400" size={64} /><h1 className="mt-5 text-4xl font-black">מסך האימון מוכן</h1><p className="mt-3 text-xl text-slate-400">כאשר המאמן יבחר “הצג במסך המועדון”, האימון יופיע כאן אוטומטית.</p>{offline && <p className="mt-4 text-sm font-bold text-rose-400">ממתין לחיבור לשרת התצוגה…</p>}</div>
  </main>;
};
