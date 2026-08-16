import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserPlus,
  BellRing,
  HeartPulse
} from 'lucide-react';
import { RubisLogo } from './RubisLogo';
import { HealthDeclarationForm, HealthDeclarationResult } from './HealthDeclarationForm';
import {
  Gender,
  DiscountCode,
  CURRENT_MEMBERSHIP_ADD_ONS,
  CURRENT_PRIMARY_MEMBERSHIP_PLANS,
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MEMBERSHIP_PRICES,
  MEMBERSHIP_TYPE_LABELS,
  MembershipStatus,
  MembershipType,
  Payment,
  PaymentPurchaseVariant,
  TRAINING_CARD_SIZES,
  TrainingCardSize,
  User,
  UserRole
} from '../types';
import {
  clearCardcomReturnParams,
  clearPendingCardcomPayment,
  getPendingCardcomPayment,
  isCardcomConfigured,
  markTransactionProcessed,
  startCardcomPayment,
  verifyPendingCardcomPayment,
  wasTransactionProcessed
} from '../data/cardcomPayments';
import { createHealthDeclarationRecord } from '../data/healthDeclarationRecords';
import { createMembershipTerm } from '../data/membershipPolicy';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { familyPurchaseAmount, resizeFamilyPlans } from '../data/familyMembership';

interface AuthGatewayProps {
  users: User[];
  discountCodes: DiscountCode[];
  onLogin: (user: User) => void;
  onRegister: (user: User, payment: Payment) => void;
}

type AuthScreen = 'welcome' | 'login' | 'register';
type LoginMethod = 'password' | 'phone';

const TEST_OTP = '1111';
const REGISTRATION_PLANS = [...CURRENT_PRIMARY_MEMBERSHIP_PLANS, ...CURRENT_MEMBERSHIP_ADD_ONS];

const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(age, 0);
};

export const AuthGateway: React.FC<AuthGatewayProps> = ({ users, discountCodes, onLogin, onRegister }) => {
  const [screen, setScreen] = useState<AuthScreen>('welcome');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4>(1);
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerGender, setRegisterGender] = useState<Gender>(Gender.FEMALE);
  const [healthApproved, setHealthApproved] = useState(false);
  const [healthDeclaration, setHealthDeclaration] = useState<HealthDeclarationResult | null>(null);
  const [showHealthDeclaration, setShowHealthDeclaration] = useState(false);
  const [agreementApproved, setAgreementApproved] = useState(false);
  const [pushApproved, setPushApproved] = useState(false);
  const [pushWorkoutReminders, setPushWorkoutReminders] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipType>(MembershipType.OPEN_GYM);
  const [trainingCardSize, setTrainingCardSize] = useState<TrainingCardSize>(1);
  const [isFamilyPlan, setIsFamilyPlan] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyMembersCount, setFamilyMembersCount] = useState(2);
  const [familyBillingMode, setFamilyBillingMode] = useState<FamilyBillingMode>('ANNUAL_BY_SIZE');
  const [familyMemberPlans, setFamilyMemberPlans] = useState<FamilyMemberPlanSelection[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [paymentStarting, setPaymentStarting] = useState(false);
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

  useEffect(() => {
    const returnStatus = new URLSearchParams(window.location.search).get('cardcom');
    if (!returnStatus) return;
    const pending = getPendingCardcomPayment();
    if (!pending || pending.mode !== 'REGISTRATION') return;
    setScreen('register');
    setRegisterStep(4);

    if (returnStatus === 'failed') {
      clearCardcomReturnParams();
      setError('התשלום לא הושלם. החשבון לא נפתח ולא בוצע חיוב.');
      return;
    }

    setPaymentStarting(true);
    verifyPendingCardcomPayment(pending)
      .then(verified => {
        const transactionKey = verified.transactionId || verified.lowProfileId;
        if (wasTransactionProcessed(transactionKey)) {
          clearPendingCardcomPayment();
          clearCardcomReturnParams();
          setNotice('התשלום כבר נקלט בהצלחה. ניתן להיכנס לחשבון.');
          setScreen('login');
          return;
        }
        const draft = pending.registrationDraft as { user?: User } | undefined;
        if (!draft?.user || draft.user.id !== pending.userId) throw new Error('פרטי ההרשמה לא נמצאו במכשיר זה. יש לפנות למועדון עם אישור העסקה.');
        const payment: Payment = {
          id: `payment-cardcom-${transactionKey}`,
          traineeId: draft.user.id,
          traineeName: draft.user.name,
          amount: verified.amount,
          date: new Date().toISOString().split('T')[0],
          status: 'PAID',
          membershipTypePurchased: verified.membershipType,
          paymentMethod: `Cardcom${verified.last4Digits ? ` •••• ${verified.last4Digits}` : ''}`,
          isMock: false
        };
        markTransactionProcessed(transactionKey);
        clearPendingCardcomPayment();
        clearCardcomReturnParams();
        onRegister(draft.user, payment);
      })
      .catch(paymentError => {
        clearCardcomReturnParams();
        setError(paymentError instanceof Error ? paymentError.message : 'לא ניתן לאמת את התשלום מול Cardcom.');
      })
      .finally(() => setPaymentStarting(false));
    // Process the hosted-payment return once when the unauthenticated gateway mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleRegistrationDetails = async (event: React.FormEvent) => {
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
      setError('יש למלא ולחתום על שאלון הצהרת הבריאות כדי להשלים הרשמה.');
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

    if (pushApproved && 'Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushApproved(false);
        setPushWorkoutReminders(false);
        setNotice('הדפדפן לא אישר התראות. ניתן להפעיל אותן מאוחר יותר בפרופיל.');
      }
    }

    setRegisterStep(4);
  };

  const handleRegistrationPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    if (!isCardcomConfigured()) {
      setError('שרת התשלומים טרם הוגדר. לא ניתן לבצע חיוב בשלב זה.');
      return;
    }

    const age = calculateAge(registerBirthDate);
    const isTrainingCard = selectedPlan === MembershipType.PERSONAL_TRAINING || selectedPlan === MembershipType.DUO_TRAINING;
    const normalizedFamilyPlans = resizeFamilyPlans(familyMemberPlans, familyMembersCount, registerName.trim() || 'המשלם הראשי');
    const selectedFamilyPayerPlan = familyBillingMode === 'CUSTOM_COMBINED' ? normalizedFamilyPlans[0]?.membershipType : MembershipType.FAMILY_MEMBERSHIP;
    const membershipTerm = createMembershipTerm(isFamilyPlan && familyBillingMode === 'ANNUAL_BY_SIZE' ? MembershipType.GROUP_ANNUAL : isFamilyPlan ? selectedFamilyPayerPlan : selectedPlan);
    const now = Date.now();
    const familyId = isFamilyPlan ? `fam-${now}` : undefined;
    const healthRecord = createHealthDeclarationRecord({
      signed: true,
      answers: healthDeclaration?.answers,
      requiresMedicalCertificate: healthDeclaration?.requiresMedicalCertificate,
      medicalCertificateApproved: false,
      parentConsent: healthDeclaration?.parentConsent,
      parentName: healthDeclaration?.parentName,
      signatureName: healthDeclaration?.signatureName
    });
    const newUser: User = {
      id: `user-${now}`,
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
      healthDeclarationAnswers: healthDeclaration?.answers,
      healthDeclarationRequiresMedicalCertificate: healthDeclaration?.requiresMedicalCertificate,
      healthDeclarationMedicalCertificateApproved: false,
      healthDeclarationParentConsent: healthDeclaration?.parentConsent,
      healthDeclarationParentName: healthDeclaration?.parentName,
      healthDeclarationSignatureName: healthDeclaration?.signatureName,
      healthDeclarationHistory: [healthRecord],
      clubAgreementSigned: true,
      clubAgreementDate: new Date().toISOString().split('T')[0],
      pushNotificationsEnabled: pushApproved && (!('Notification' in window) || Notification.permission === 'granted'),
      workoutRemindersEnabled: pushApproved && pushWorkoutReminders,
      membershipType: isFamilyPlan ? selectedFamilyPayerPlan : selectedPlan,
      membershipStatus: MembershipStatus.ACTIVE,
      ...membershipTerm,
      personalTrainingCardSize: !isFamilyPlan && selectedPlan === MembershipType.PERSONAL_TRAINING ? trainingCardSize : undefined,
      personalTrainingRemaining: isFamilyPlan && selectedFamilyPayerPlan === MembershipType.PERSONAL_TRAINING ? normalizedFamilyPlans[0]?.trainingSessionsCount : selectedPlan === MembershipType.PERSONAL_TRAINING ? trainingCardSize : undefined,
      duoTrainingCardSize: !isFamilyPlan && selectedPlan === MembershipType.DUO_TRAINING ? trainingCardSize : undefined,
      duoTrainingRemaining: isFamilyPlan && selectedFamilyPayerPlan === MembershipType.DUO_TRAINING ? normalizedFamilyPlans[0]?.trainingSessionsCount : selectedPlan === MembershipType.DUO_TRAINING ? trainingCardSize : undefined,
      nutritionPlanPaid: (isFamilyPlan ? selectedFamilyPayerPlan : selectedPlan) === MembershipType.NUTRITION_COACHING,
      requestedWorkoutPlan: [MembershipType.WORKOUT_COACHING, MembershipType.OPEN_GYM_WITH_PLAN].includes(isFamilyPlan ? selectedFamilyPayerPlan : selectedPlan),
      priorityScore: 100,
      familyId,
      familyName: isFamilyPlan ? (familyName.trim() || `משפחת ${registerName.trim().split(' ')[0]}`) : undefined,
      isFamilyPayer: isFamilyPlan || undefined,
      familyMembersCount: isFamilyPlan ? familyMembersCount : undefined,
      familyBillingMode: isFamilyPlan ? familyBillingMode : undefined,
      familyMemberPlans: isFamilyPlan && familyBillingMode === 'CUSTOM_COMBINED' ? normalizedFamilyPlans : undefined,
      familyCombinedAmount: isFamilyPlan ? familyPurchaseAmount(familyBillingMode, familyMembersCount, normalizedFamilyPlans) : undefined,
      familyTrackName: isFamilyPlan ? familyBillingMode === 'ANNUAL_BY_SIZE' ? `משפחתי שנתי (${familyMembersCount} מתאמנים)` : familyBillingMode === 'MONTHLY_PER_MEMBER' ? `משפחתי חודשי (${familyMembersCount} מתאמנים)` : 'משפחתי מותאם – תשלום מאוחד' : undefined,
      imageUrl: registerGender === Gender.FEMALE
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
    };
    setPaymentStarting(true);
    try {
      await startCardcomPayment({
        userId: newUser.id,
        userName: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        membershipType: isFamilyPlan ? MembershipType.FAMILY_MEMBERSHIP : selectedPlan,
        mode: 'REGISTRATION',
        purchaseVariant: isTrainingCard
          ? `${selectedPlan === MembershipType.PERSONAL_TRAINING ? 'PERSONAL' : 'DUO'}_${trainingCardSize}` as PaymentPurchaseVariant
          : undefined,
        familyMembersCount: isFamilyPlan ? familyMembersCount : undefined,
        familyName: isFamilyPlan ? newUser.familyName : undefined,
        familyBillingMode: isFamilyPlan ? familyBillingMode : undefined,
        familyMemberPlans: isFamilyPlan && familyBillingMode === 'CUSTOM_COMBINED' ? normalizedFamilyPlans : undefined,
        discountCode: appliedDiscount?.code,
        registrationDraft: { user: newUser }
      });
    } catch (paymentError) {
      setPaymentStarting(false);
      setError(paymentError instanceof Error ? paymentError.message : 'לא ניתן לפתוח את דף התשלום.');
    }
  };

  if (screen === 'welcome') {
    return (
      <main className="auth-gateway" dir="rtl">
        <section className="auth-hero">
          <div className="auth-brand">
            <RubisLogo size={58} className="auth-brand-logo" />
            <div>
              <strong>BALY WELLNESS</strong>
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
        <div className="auth-mini-brand">BALY WELLNESS</div>

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
            <div className="auth-progress"><i className={registerStep >= 1 ? 'active' : ''} /><i className={registerStep >= 2 ? 'active' : ''} /><i className={registerStep >= 3 ? 'active' : ''} /><i className={registerStep >= 4 ? 'active' : ''} /></div>
            <h1>הרשמה ל־BALY</h1>
            <p>{registerStep === 1 ? 'מתחילים באימות מספר הטלפון.' : registerStep === 2 ? 'הזינו את קוד האימות.' : registerStep === 3 ? 'כמה פרטים ונוכל להתחיל.' : 'בוחרים מסלול ומשלימים תשלום בדיקה.'}</p>

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
                <button type="button" className={`auth-health-launch ${healthApproved ? 'complete' : ''}`} onClick={() => setShowHealthDeclaration(current => !current)}>
                  <HeartPulse size={18} />
                  <span><strong>{healthApproved ? 'הצהרת הבריאות נחתמה' : 'מילוי וחתימה על הצהרת הבריאות'}</strong><small>{healthApproved ? 'ההצהרה בתוקף לשנה' : 'שאלון רפואי לפי הטופס המצורף'}</small></span>
                  <CheckCircle2 size={18} />
                </button>
                {showHealthDeclaration && (
                  <HealthDeclarationForm
                    fullName={registerName}
                    age={calculateAge(registerBirthDate)}
                    onComplete={result => {
                      setHealthDeclaration(result);
                      setHealthApproved(result.signed);
                      if (result.signed) {
                        setShowHealthDeclaration(false);
                        setError('');
                        setNotice('הצהרת הבריאות נחתמה ונשמרה בהצלחה.');
                      } else {
                        setError('נדרשת תעודה רפואית ואישור המועדון לפני שניתן להשלים את ההרשמה.');
                      }
                    }}
                  />
                )}
                <label className="auth-checkbox">
                  <input type="checkbox" checked={agreementApproved} onChange={event => setAgreementApproved(event.target.checked)} />
                  <span>קראתי וחתמתי על הסכם ההצטרפות, התקנון, מדיניות הביטולים והפרטיות.</span>
                </label>
                <div className="auth-push-consent">
                  <div><BellRing size={18} /><span><strong>התראות PUSH</strong><small>אישור התראות ועדכונים במכשיר הזה</small></span></div>
                  <label className="auth-checkbox"><input type="checkbox" checked={pushApproved} onChange={event => setPushApproved(event.target.checked)} /><span>אני מאשר/ת קבלת התראות PUSH מהמועדון.</span></label>
                  <label className="auth-checkbox"><input type="checkbox" checked={pushWorkoutReminders} disabled={!pushApproved} onChange={event => setPushWorkoutReminders(event.target.checked)} /><span>שליחת תזכורות לפני אימונים שנרשמתי אליהם.</span></label>
                  <small>ניתן לבטל את ההתראות בכל עת דרך הפרופיל.</small>
                </div>
                <button className="auth-primary" type="submit"><CheckCircle2 size={18} /> המשך לבחירת מסלול</button>
              </form>
            )}
            {registerStep === 4 && (
              <form onSubmit={handleRegistrationPayment} className="auth-form">
                <div className="auth-plan-grid">
                  <button
                    type="button"
                    className={`auth-plan-card ${isFamilyPlan ? 'active' : ''}`}
                    onClick={() => { setIsFamilyPlan(true); setSelectedPlan(MembershipType.FAMILY_MEMBERSHIP); }}
                  >
                    <span><strong>מנוי משפחתי</strong><small>חשבון משלם אחד, עם פרופיל נפרד לכל בן משפחה</small></span>
                    <b>מ־₪900</b>
                  </button>
                  {REGISTRATION_PLANS.map(plan => (
                    <button
                      key={plan}
                      type="button"
                      className={`auth-plan-card ${!isFamilyPlan && selectedPlan === plan ? 'active' : ''}`}
                      onClick={() => { setSelectedPlan(plan); setIsFamilyPlan(false); }}
                    >
                      <span>
                        <strong>{MEMBERSHIP_TYPE_LABELS[plan].label}</strong>
                        <small>{MEMBERSHIP_TYPE_LABELS[plan].description}</small>
                      </span>
                      <b>₪{MEMBERSHIP_PRICES[plan]}{plan === MembershipType.PERSONAL_TRAINING || plan === MembershipType.DUO_TRAINING ? ' לאימון' : plan === MembershipType.GROUP_MONTHLY || plan === MembershipType.GROUP_ANNUAL ? ' לחודש' : ''}</b>
                    </button>
                  ))}
                </div>
                {!isFamilyPlan && (selectedPlan === MembershipType.PERSONAL_TRAINING || selectedPlan === MembershipType.DUO_TRAINING) && (
                  <div className="auth-family-options">
                    <label>גודל כרטיסייה<select value={trainingCardSize} onChange={event => setTrainingCardSize(Number(event.target.value) as TrainingCardSize)}>
                      {TRAINING_CARD_SIZES.map(size => <option key={size} value={size}>{size === 1 ? 'אימון אחד' : `${size} אימונים`} — ₪{size * MEMBERSHIP_PRICES[selectedPlan]}</option>)}
                    </select></label>
                    <small>היתרה נשמרת בחשבון ותישלח התראה כאשר יישארו שני אימונים.</small>
                  </div>
                )}
                {isFamilyPlan && <div className="space-y-3">
                  <label className="block text-xs font-bold">שם המשפחה<input value={familyName} onChange={event => setFamilyName(event.target.value)} placeholder={`משפחת ${registerName.trim().split(' ')[0] || 'ישראל'}`} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <FamilyPlanConfigurator mode={familyBillingMode} onModeChange={setFamilyBillingMode} count={familyMembersCount} onCountChange={setFamilyMembersCount} plans={familyMemberPlans} onPlansChange={setFamilyMemberPlans} payerName={registerName.trim() || 'המשלם הראשי'} />
                  <small>לאחר התשלום ניתן לפתוח פרופיל נפרד ולחתום על הצהרת בריאות עבור כל בן משפחה.</small>
                </div>}
                <div className="auth-discount-box">
                  <label>קוד הנחה</label>
                  <div><input value={discountInput} onChange={event => setDiscountInput(event.target.value.toUpperCase())} placeholder="הזנת קוד" />
                  <button type="button" onClick={() => {
                    const match = discountCodes.find(code => code.code.toUpperCase() === discountInput.trim().toUpperCase() && (!code.isSingleUse || !code.isUsed));
                    setAppliedDiscount(match || null);
                    setNotice(match ? `קוד ${match.code} הופעל בהצלחה.` : '');
                    setError(match ? '' : 'קוד ההנחה אינו תקין או שכבר נוצל.');
                  }}>הפעל</button></div>
                </div>
                <div className="auth-checkout-summary">
                  <span>{selectedPlan === MembershipType.GROUP_ANNUAL ? 'חיוב חודשי ראשון' : 'לתשלום כעת'}</span>
                  <strong>₪{(() => {
                    const base = isFamilyPlan
                      ? familyPurchaseAmount(familyBillingMode, familyMembersCount, resizeFamilyPlans(familyMemberPlans, familyMembersCount, registerName.trim() || 'המשלם הראשי'))
                      : MEMBERSHIP_PRICES[selectedPlan] * ((selectedPlan === MembershipType.PERSONAL_TRAINING || selectedPlan === MembershipType.DUO_TRAINING) ? trainingCardSize : 1);
                    const discount = appliedDiscount?.discountPercent ? Math.round(base * appliedDiscount.discountPercent / 100) : (appliedDiscount?.discountAmount || 0);
                    return Math.max(0, base - discount);
                  })()}</strong>
                </div>
                {!isFamilyPlan && selectedPlan === MembershipType.GROUP_ANNUAL && <small className="auth-mock-note">₪500 בחודש בהוראת קבע למשך 12 חודשים. בקשת ביטול נכנסת לתוקף חודש קדימה.</small>}
                <small className="auth-mock-note">פרטי האשראי יוזנו רק בעמוד המאובטח של Cardcom ולא יישמרו ב־BALY.</small>
                {!isCardcomConfigured() && <div className="auth-message error">שירות התשלומים טרם חובר לשרת הציבורי.</div>}
                <button className="auth-primary" type="submit" disabled={paymentStarting || !isCardcomConfigured()}><CreditCard size={18} /> {paymentStarting ? 'פותח תשלום…' : 'מעבר לתשלום מאובטח'}</button>
                <button className="auth-text-link" type="button" onClick={() => setRegisterStep(3)}>חזרה לפרטים האישיים</button>
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
