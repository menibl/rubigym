import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Dumbbell,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserPlus
} from 'lucide-react';
import { RubisLogo } from './RubisLogo';
import {
  Gender,
  MembershipStatus,
  MembershipType,
  User,
  UserRole
} from '../types';

interface AuthGatewayProps {
  users: User[];
  onLogin: (user: User) => void;
  onRegister: (user: User) => void;
}

type AuthScreen = 'welcome' | 'login' | 'register';
type LoginMethod = 'password' | 'phone';

const TEST_OTP = '1111';

const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(age, 0);
};

export const AuthGateway: React.FC<AuthGatewayProps> = ({ users, onLogin, onRegister }) => {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerGender, setRegisterGender] = useState<Gender>(Gender.FEMALE);
  const [healthApproved, setHealthApproved] = useState(false);
  const [agreementApproved, setAgreementApproved] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const resetMessages = () => {
    setError('');
    setNotice('');
  };

  const openScreen = (next: AuthScreen) => {
    resetMessages();
    setScreen(next);
  };

  const sendLoginOtp = () => {
    resetMessages();
    const user = users.find(item => item.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!user) {
      setError('לא נמצא משתמש עם מספר הטלפון הזה.');
      return;
    }
    setOtpSent(true);
    setNotice('הקוד נשלח בהדמיה. קוד הבדיקה הוא 1111.');
  };

  const handlePasswordLogin = (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    const normalized = username.trim().toLowerCase();
    const user = users.find(item =>
      (item.username?.toLowerCase() === normalized || item.email.toLowerCase() === normalized)
      && item.password === password
    );
    if (!user) {
      setError('שם המשתמש או הסיסמה אינם נכונים.');
      return;
    }
    onLogin(user);
  };

  const handlePhoneLogin = (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!otpSent) {
      sendLoginOtp();
      return;
    }
    if (otp !== TEST_OTP) {
      setError('הקוד שהוזן אינו נכון. קוד הבדיקה הוא 1111.');
      return;
    }
    const user = users.find(item => item.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
    if (!user) {
      setError('לא נמצא משתמש עם מספר הטלפון הזה.');
      return;
    }
    onLogin(user);
  };

  const handleRegistrationPhone = (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (registerPhone.replace(/\D/g, '').length < 9) {
      setError('יש להזין מספר טלפון תקין.');
      return;
    }
    if (users.some(item => item.phone.replace(/\D/g, '') === registerPhone.replace(/\D/g, ''))) {
      setError('מספר הטלפון כבר רשום. ניתן לעבור למסך הכניסה.');
      return;
    }
    setRegisterStep(2);
    setNotice('הקוד נשלח בהדמיה. קוד הבדיקה הוא 1111.');
  };

  const handleRegistrationOtp = (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (registerOtp !== TEST_OTP) {
      setError('הקוד שהוזן אינו נכון. קוד הבדיקה הוא 1111.');
      return;
    }
    setRegisterStep(3);
  };

  const handleRegistrationDetails = (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!registerName.trim() || !registerUsername.trim() || !registerPassword || !registerBirthDate) {
      setError('יש להשלים את כל השדות.');
      return;
    }
    if (registerPassword.length < 4) {
      setError('הסיסמה חייבת להכיל לפחות 4 תווים.');
      return;
    }
    if (users.some(item => item.username?.toLowerCase() === registerUsername.trim().toLowerCase())) {
      setError('שם המשתמש כבר תפוס.');
      return;
    }
    if (!healthApproved) {
      setError('יש לאשר את הצהרת הבריאות כדי להשלים הרשמה.');
      return;
    }
    if (!agreementApproved) {
      setError('יש לקרוא ולחתום על הסכם ההצטרפות ותקנון המועדון.');
      return;
    }
    const age = calculateAge(registerBirthDate);
    if (age < 16) {
      setError('פתיחת חשבון עצמאי אפשרית מגיל 16. מתחת לגיל 16 יש להצטרף כבן משפחה באמצעות חשבון משפחתי.');
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: registerName.trim(),
      username: registerUsername.trim(),
      password: registerPassword,
      email: `${registerUsername.trim().toLowerCase().replace(/\s+/g, '')}@balywellness.co.il`,
      phone: registerPhone.trim(),
      role: UserRole.TRAINEE,
      gender: registerGender,
      age,
      birthDate: registerBirthDate,
      healthDeclarationSigned: true,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      clubAgreementSigned: true,
      clubAgreementDate: new Date().toISOString().split('T')[0],
      pushNotificationsEnabled: false,
      workoutRemindersEnabled: false,
      membershipType: MembershipType.GROUP_MONTHLY,
      membershipStatus: MembershipStatus.DEBT,
      membershipExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priorityScore: 100,
      imageUrl: registerGender === Gender.FEMALE
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    };
    onRegister(newUser);
  };

  if (screen === 'welcome') {
    return (
      <main className="auth-gateway" dir="rtl">
        <section className="auth-hero">
          <div className="auth-brand">
            <RubisLogo size={58} className="auth-brand-logo" />
            <div>
              <strong>BALY</strong>
              <small>wellness</small>
            </div>
          </div>
          <div className="auth-kicker">המקום שלך להתחזק, להתאזן ולהרגיש טוב</div>
          <h1>האימון שלך.<br />בקצב שלך.</h1>
          <p>אימונים קבוצתיים, Open Gym, תוכניות אישיות וליווי מקצועי — הכול במקום אחד.</p>
          <div className="auth-benefits">
            <div><Dumbbell size={18} /><span>אימונים מותאמים</span></div>
            <div><ShieldCheck size={18} /><span>ליווי מקצועי</span></div>
            <div><MessageSquareText size={18} /><span>קשר ישיר עם המאמן</span></div>
          </div>
          <div className="auth-actions">
            <button className="auth-primary" onClick={() => openScreen('register')}>
              <UserPlus size={18} /> הרשמה למועדון
            </button>
            <button className="auth-secondary" onClick={() => openScreen('login')}>
              <KeyRound size={18} /> LOGIN
            </button>
          </div>
          <small className="auth-legal">בהמשך ההרשמה מאשרים את תקנון המועדון והצהרת הבריאות.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-gateway" dir="rtl">
      <section className="auth-panel">
        <button className="auth-back" onClick={() => openScreen('welcome')}>
          <ArrowLeft size={18} /> חזרה
        </button>
        <div className="auth-mini-brand">BALY <span>wellness</span></div>

        {screen === 'login' && (
          <>
            <h1>כניסה לחשבון</h1>
            <p>בחרו את הדרך הנוחה להיכנס.</p>
            <div className="auth-method-tabs">
              <button className={loginMethod === 'password' ? 'active' : ''} onClick={() => { setLoginMethod('password'); resetMessages(); }}>
                <LockKeyhole size={16} /> משתמש וסיסמה
              </button>
              <button className={loginMethod === 'phone' ? 'active' : ''} onClick={() => { setLoginMethod('phone'); resetMessages(); }}>
                <Phone size={16} /> טלפון ו־SMS
              </button>
            </div>

            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="auth-form">
                <label>שם משתמש או אימייל<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" /></label>
                <label>סיסמה<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></label>
                <button className="auth-primary" type="submit">כניסה</button>
              </form>
            ) : (
              <form onSubmit={handlePhoneLogin} className="auth-form">
                <label>מספר טלפון<input inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="05X-XXXXXXX" /></label>
                {otpSent && <label>קוד אימות<input inputMode="numeric" maxLength={4} value={otp} onChange={event => setOtp(event.target.value)} placeholder="1111" /></label>}
                <button className="auth-primary" type="submit">{otpSent ? 'אימות וכניסה' : 'שליחת קוד SMS'}</button>
              </form>
            )}
            <button className="auth-text-link" onClick={() => openScreen('register')}>עדיין לא רשומים? להרשמה</button>
          </>
        )}

        {screen === 'register' && (
          <>
            <div className="auth-progress"><i className={registerStep >= 1 ? 'active' : ''} /><i className={registerStep >= 2 ? 'active' : ''} /><i className={registerStep >= 3 ? 'active' : ''} /></div>
            <h1>הרשמה ל־BALY</h1>
            <p>{registerStep === 1 ? 'מתחילים באימות מספר הטלפון.' : registerStep === 2 ? 'הזינו את קוד האימות.' : 'כמה פרטים ונוכל להתחיל.'}</p>

            {registerStep === 1 && (
              <form onSubmit={handleRegistrationPhone} className="auth-form">
                <label>מספר טלפון<input inputMode="tel" value={registerPhone} onChange={event => setRegisterPhone(event.target.value)} placeholder="05X-XXXXXXX" /></label>
                <button className="auth-primary" type="submit">שליחת קוד SMS</button>
              </form>
            )}
            {registerStep === 2 && (
              <form onSubmit={handleRegistrationOtp} className="auth-form">
                <label>קוד אימות<input inputMode="numeric" maxLength={4} value={registerOtp} onChange={event => setRegisterOtp(event.target.value)} placeholder="1111" /></label>
                <button className="auth-primary" type="submit">אימות מספר הטלפון</button>
                <button className="auth-text-link" type="button" onClick={() => setRegisterStep(1)}>שינוי מספר טלפון</button>
              </form>
            )}
            {registerStep === 3 && (
              <form onSubmit={handleRegistrationDetails} className="auth-form">
                <label>שם מלא<input value={registerName} onChange={event => setRegisterName(event.target.value)} /></label>
                <label>שם משתמש<input value={registerUsername} onChange={event => setRegisterUsername(event.target.value)} autoComplete="username" /></label>
                <label>סיסמה<input type="password" value={registerPassword} onChange={event => setRegisterPassword(event.target.value)} autoComplete="new-password" /></label>
                <label>תאריך לידה<input type="date" value={registerBirthDate} onChange={event => setRegisterBirthDate(event.target.value)} /></label>
                <div className="auth-gender">
                  <button type="button" className={registerGender === Gender.FEMALE ? 'active' : ''} onClick={() => setRegisterGender(Gender.FEMALE)}>אישה</button>
                  <button type="button" className={registerGender === Gender.MALE ? 'active' : ''} onClick={() => setRegisterGender(Gender.MALE)}>גבר</button>
                </div>
                <label className="auth-checkbox">
                  <input type="checkbox" checked={healthApproved} onChange={event => setHealthApproved(event.target.checked)} />
                  <span>קראתי, חתמתי ואישרתי את הצהרת הבריאות (בתוקף לשנה).</span>
                </label>
                <label className="auth-checkbox">
                  <input type="checkbox" checked={agreementApproved} onChange={event => setAgreementApproved(event.target.checked)} />
                  <span>קראתי וחתמתי על הסכם ההצטרפות, התקנון, מדיניות הביטולים והפרטיות.</span>
                </label>
                <button className="auth-primary" type="submit"><CheckCircle2 size={18} /> השלמת הרשמה</button>
              </form>
            )}
            <button className="auth-text-link" onClick={() => openScreen('login')}>כבר רשומים? לכניסה</button>
          </>
        )}

        {error && <div className="auth-message error">{error}</div>}
        {notice && <div className="auth-message notice">{notice}</div>}
      </section>
    </main>
  );
};
