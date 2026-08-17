import React from 'react';
import { Apple, ChevronLeft, Search, Sparkles } from 'lucide-react';
import { NutritionPlan, User } from '../types';

interface NutritionPlanningNavigatorProps {
  trainees: User[];
  nutritionPlans: NutritionPlan[];
  onOpenTrainee: (traineeId: string) => void;
}

export const NutritionPlanningNavigator: React.FC<NutritionPlanningNavigatorProps> = ({ trainees, nutritionPlans, onOpenTrainee }) => (
  <section className="workout-planning-navigator" dir="rtl">
    <header className="planning-navigation-header">
      <div><span><Sparkles size={16} /> תכנון תזונה חכם</span><h2>בחירת מתאמן לתוכנית תזונה</h2><p>בחרו מתאמן, עברו לשאלון הפתיחה ולאחריו לצ׳אט ולטיוטת התוכנית.</p></div>
    </header>
    <div className="planning-selection-list">
      {trainees.map(trainee => {
        const existing = nutritionPlans.find(plan => plan.traineeId === trainee.id);
        return <button type="button" key={trainee.id} className="planning-selection-card" onClick={() => onOpenTrainee(trainee.id)}>
          <img src={trainee.imageUrl} alt="" />
          <span><strong>{trainee.name}</strong><small>{existing ? `תוכנית קיימת · ${existing.dailyCalories} קלוריות` : 'תוכנית חדשה'} · גיל {trainee.age}</small></span>
          <span className="planning-list-icon"><Apple size={18} /></span><ChevronLeft size={18} />
        </button>;
      })}
      {trainees.length === 0 && <div className="planning-empty"><Search size={28} /><strong>לא נמצאו מתאמנים</strong><span>יש להוסיף מתאמן לפני בניית תוכנית תזונה.</span></div>}
    </div>
  </section>
);
