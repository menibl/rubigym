import React from 'react';

export function FamilyMemberAdded({name,canAddMore,onAddAnother,onChoosePlans}:{
  name:string;canAddMore:boolean;onAddAnother:()=>void;onChoosePlans:()=>void;
}){
  return <section className="logic-family-added" aria-label="בן המשפחה התווסף בהצלחה">
    <div role="status" aria-live="polite"><h2>בן המשפחה התווסף בהצלחה</h2><p>{name}</p></div>
    <p>האם תרצו להוסיף בן משפחה נוסף או לחזור לבחירת מסלול?</p>
    <p>הפרטים נשמרו. עדיין לא בוצע תשלום ולא הופעל מנוי.</p>
    <div className="logic-success-actions">
      <button type="button" className="logic-secondary" onClick={onAddAnother} disabled={!canAddMore}>הוספת בן משפחה נוסף</button>
      <button type="button" className="logic-primary logic-complete" onClick={onChoosePlans}>חזרה לבחירת מסלול</button>
    </div>
    {!canAddMore && <p>הגעתם למספר המרבי של בני משפחה בחשבון.</p>}
  </section>;
}
