import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, HeartPulse, ShieldCheck } from 'lucide-react';

export type HealthDeclarationResult = {
  answers: Record<string, 'YES' | 'NO'>;
  signatureName: string;
  parentConsent: boolean;
  parentName?: string;
  parentIdNumber?: string;
  requiresMedicalCertificate: boolean;
  medicalCertificateFileName?: string;
  medicalCertificateDataUrl?: string;
  signed: boolean;
};

interface HealthDeclarationFormProps {
  fullName: string;
  age: number;
  onComplete: (result: HealthDeclarationResult) => void;
  submitLabel?: string;
}

const QUESTIONS = [
  { id: 'heart_disease', text: '1. האם הרופא שלך אמר לך שאתה סובל ממחלת לב?' },
  { id: 'chest_pain_rest', text: '2(א). האם אתה חש כאבים בחזה בזמן מנוחה?' },
  { id: 'chest_pain_daily', text: '2(ב). האם אתה חש כאבים בחזה במהלך פעילויות שגרה ביום־יום?' },
  { id: 'chest_pain_activity', text: '2(ג). האם אתה חש כאבים בחזה בזמן שאתה מבצע פעילות גופנית?' },
  { id: 'dizziness', text: '3(א). האם במהלך השנה החולפת איבדת שיווי משקל עקב סחרחורת? סמן לא אם הסחרחורת נבעה מנשימת יתר, כולל במהלך פעילות גופנית נמרצת.' },
  { id: 'lost_consciousness', text: '3(ב). האם במהלך השנה החולפת איבדת את הכרתך?' },
  { id: 'asthma_medication', text: '4(א). האם רופא אבחן שאתה סובל ממחלת האסתמה ולכן בשלושת החודשים האחרונים נזקקת לטיפול תרופתי?' },
  { id: 'asthma_symptoms', text: '4(ב). האם בשלושת החודשים האחרונים סבלת מקוצר נשימה או מצפצופים?' },
  { id: 'family_heart_disease', text: '5(א). האם אחד מבני משפחתך מדרגת קרבה ראשונה נפטר ממחלת לב?' },
  { id: 'family_sudden_death', text: '5(ב). האם אחד מבני משפחתך מדרגת קרבה ראשונה נפטר ממוות פתאומי בגיל מוקדם — לפני גיל 55 בגבר ולפני גיל 65 באישה?' },
  { id: 'medical_supervision', text: '6. האם הרופא שלך אמר לך בחמש השנים האחרונות לבצע פעילות גופנית רק תחת השגחה רפואית?' },
  { id: 'chronic_condition', text: '7. האם אתה סובל ממחלה קבועה (כרונית), שאינה נזכרת בשאלות לעיל ועשויה למנוע או להגביל אותך בביצוע פעילות גופנית?' },
  { id: 'pregnancy_risk', text: '8. לנשים בהיריון: האם ההיריון הזה או כל היריון קודם הוגדר היריון בסיכון? אם השאלה אינה רלוונטית, יש לסמן לא.' }
];

export const HealthDeclarationForm: React.FC<HealthDeclarationFormProps> = ({
  fullName,
  age,
  onComplete,
  submitLabel = 'חתימה ושמירת הצהרת הבריאות'
}) => {
  const [answers, setAnswers] = useState<Record<string, 'YES' | 'NO'>>({});
  const [signatureName, setSignatureName] = useState(fullName);
  const [declarationApproved, setDeclarationApproved] = useState(false);
  const [parentName, setParentName] = useState('');
  const [parentIdNumber, setParentIdNumber] = useState('');
  const [parentConsent, setParentConsent] = useState(false);
  const [medicalCertificateFileName, setMedicalCertificateFileName] = useState('');
  const [medicalCertificateDataUrl, setMedicalCertificateDataUrl] = useState('');
  const [error, setError] = useState('');
  const requiresMedicalCertificate = useMemo(() => Object.values(answers).includes('YES'), [answers]);
  const allAnswered = QUESTIONS.every(question => answers[question.id]);
  const isMinor = age > 0 && age < 18;

  const handleSubmit = () => {
    if (!allAnswered) return setError('יש לענות כן או לא על כל שאלות השאלון הרפואי.');
    if (!signatureName.trim() || !declarationApproved) return setError('יש להזין שם מלא ולאשר את ההצהרה והחתימה.');
    if (isMinor && (!parentName.trim() || !/^\d{9}$/.test(parentIdNumber.replace(/\D/g, '')) || !parentConsent)) return setError('למתאמן שטרם מלאו לו 18 נדרשים שם הורה, מספר תעודת זהות בן 9 ספרות ואישור הורה.');
    setError('');
    onComplete({
      answers,
      signatureName: signatureName.trim(),
      parentConsent: isMinor ? parentConsent : false,
      parentName: isMinor ? parentName.trim() : undefined,
      parentIdNumber: isMinor ? parentIdNumber.replace(/\D/g, '') : undefined,
      requiresMedicalCertificate,
      medicalCertificateFileName: requiresMedicalCertificate ? medicalCertificateFileName : undefined,
      medicalCertificateDataUrl: requiresMedicalCertificate ? medicalCertificateDataUrl : undefined,
      signed: !requiresMedicalCertificate
    });
  };

  return (
    <section className="health-declaration-form" dir="rtl" aria-labelledby="health-declaration-title">
      <header>
        <span><HeartPulse size={20} /></span>
        <div>
          <h3 id="health-declaration-title">טופס הצהרת בריאות למבקש להתאמן בחדר כושר</h3>
          <p>השאלון מנוסח בלשון זכר מטעמי נוחות, אך הוא מיועד גם לנקבה.</p>
        </div>
      </header>

      <div className="health-instructions">
        <strong>חלק א׳: שאלון רפואי</strong>
        <p>אנא קרא את השאלות להלן בצורה יסודית וענה על כל שאלה בכנות באמצעות סימון כן או לא.</p>
      </div>

      <div className="health-question-list">
        {QUESTIONS.map(question => (
          <fieldset key={question.id}>
            <legend>{question.text}</legend>
            <div>
              <label className={answers[question.id] === 'YES' ? 'selected yes' : ''}>
                <input type="radio" name={question.id} checked={answers[question.id] === 'YES'} onChange={() => setAnswers(current => ({ ...current, [question.id]: 'YES' }))} /> כן
              </label>
              <label className={answers[question.id] === 'NO' ? 'selected no' : ''}>
                <input type="radio" name={question.id} checked={answers[question.id] === 'NO'} onChange={() => setAnswers(current => ({ ...current, [question.id]: 'NO' }))} /> לא
              </label>
            </div>
          </fieldset>
        ))}
      </div>

      <div className={`health-guidance ${requiresMedicalCertificate ? 'requires-certificate' : ''}`}>
        {requiresMedicalCertificate ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
        <div>
          <strong>חלק ב׳: הנחיות</strong>
          <p>אם סימנת כן באחת מהשאלות, לצורך קבלתך למכון הכושר עליך להמציא גם תעודה רפואית מרופא שלפיה אין סיכון לבריאותך באימון במכון כושר. המועדון יקבל תעודה רפואית שלא עברו שלושה חודשים ממועד הנפקתה.</p>
          <p>אם ענית לא לכל השאלות, מלא את ההצהרה בחלק ג׳ וחתום עליה. בכל מקרה של שינוי במצבך הרפואי יש להתייעץ עם רופא לגבי המשך הפעילות במכון.</p>
        </div>
      </div>

      <div className="health-signature-block">
        <strong>חלק ג׳: הצהרה</strong>
        <p>אני, החתום מטה, מצהיר כי קראתי והבנתי את כל השאלון הרפואי שבחלק א׳ לטופס זה ומילאתי אותו בעצמי. אני מצהיר כי מסרתי ידיעות מלאות ונכונות אודות מצבי הרפואי בעבר ובהווה לפי השאלות שנשאלתי בשאלון האמור.</p>
        <p>ידוע לי כי בהתאם למדיניות BALY WELLNESS, לאחר שנה מיום חתימתי על הצהרת בריאות זו אדרש לחתום על הצהרת בריאות חדשה.</p>
        <label>שם ושם משפחה — חתימה דיגיטלית<input value={signatureName} onChange={event => setSignatureName(event.target.value)} placeholder="שם מלא" /></label>
        <label className="health-consent"><input type="checkbox" checked={declarationApproved} onChange={event => setDeclarationApproved(event.target.checked)} /><span>אני מאשר/ת שהפרטים נכונים וחתימתי הדיגיטלית ניתנת מרצוני.</span></label>
      </div>

      {isMinor && (
        <div className="health-parent-consent">
          <strong>הסכמה בכתב של אחד מהורי הקטין</strong>
          <p>מתאמן שלא מלאו לו 18 שנה יצרף להצהרת הבריאות הסכמה חתומה בידי אחד מהוריו.</p>
          <label>שם ההורה<input value={parentName} onChange={event => setParentName(event.target.value)} placeholder="שם מלא של ההורה" /></label>
          <label>מספר תעודת זהות של ההורה<input inputMode="numeric" maxLength={9} value={parentIdNumber} onChange={event => setParentIdNumber(event.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 ספרות" /></label>
          <label className="health-consent"><input type="checkbox" checked={parentConsent} onChange={event => setParentConsent(event.target.checked)} /><span>אני מסכים/ה כי המתאמן יתאמן בחדר הכושר בסוגי האימונים המותרים לו.</span></label>
        </div>
      )}

      {requiresMedicalCertificate && (
        <div className="health-medical-upload">
          <div className="health-certificate-warning"><AlertTriangle size={18} /><span>סימון תשובה חיובית מחייב הצגת תעודה רפואית ואישור המועדון. עד לאישור התעודה, ההרשמה והכניסה לאימונים יישארו חסומות.</span></div>
          <label className="health-upload-button">
            <FileUp size={18} />
            <span>{medicalCertificateFileName || 'העלאת צילום אישור רופא (PDF או תמונה)'}</span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={event => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError('גודל אישור הרופא המרבי הוא 5MB.');
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === 'string') {
                    setMedicalCertificateFileName(file.name);
                    setMedicalCertificateDataUrl(reader.result);
                    setError('');
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <small>אפשר לשמור את השאלון גם בלי מסמך ולהעלות אותו מאוחר יותר; האימון יישאר חסום עד לאישור מנהל.</small>
        </div>
      )}
      {error && <div className="health-form-error">{error}</div>}
      <button type="button" className="health-submit" onClick={handleSubmit}>
        {requiresMedicalCertificate ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        {requiresMedicalCertificate ? 'שמירת השאלון והעברה לבדיקת המועדון' : submitLabel}
      </button>
    </section>
  );
};
