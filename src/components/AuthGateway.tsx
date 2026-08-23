import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Phone,
  BellRing,
  HeartPulse
} from 'lucide-react';
import { RubisLogo } from './RubisLogo';
import { HealthDeclarationForm, HealthDeclarationResult } from './HealthDeclarationForm';
import {
  Gender,
  DiscountCode,
  DEFAULT_MEMBERSHIP_PLAN_CONFIGS,
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
  UserRole,
  SystemSettings
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
import { isPagesDemoMode } from '../data/appMode';

interface AuthGatewayProps {
  users: User[];
  discountCodes: DiscountCode[];
  settings: SystemSettings;
  onPasswordLogin: (login: string, password: string) => Promise<User>;
  onPhoneLogin: (phone: string, otp: string) => Promise<User>;
  onRegister: (user: User, payment: Payment, familyUsers?: User[]) => Promise<void>;
  initialScreen?: 'login' | 'register';
  initialPlan?: MembershipType;
  landingUrl?: string;
}

type AuthScreen = 'login' | 'register';
type LoginMethod = 'password' | 'phone';
type FamilyAccountDraft = {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  birthDate: string;
  gender: Gender;
};

const TEST_OTP = '1111';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const calculateAge = (birthDate: string) => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(age, 0);
};

export const AuthGateway: React.FC<AuthGatewayProps> = ({ users, discountCodes, settings, onPasswordLogin, onPhoneLogin, onRegister, initialScreen = 'login', initialPlan, landingUrl }) => {
  const demoMode = isPagesDemoMode();
  const demoManagerPassword = import.meta.env.VITE_DEMO_MANAGER_PASSWORD || '';
  const [screen, setScreen] = useState<AuthScreen>(initialScreen);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('password');
  const [username, setUsername] = useState(demoMode ? 'רובי באלי' : '');
  const [password, setPassword] = useState(demoMode ? demoManagerPassword : '');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3 | 4>(1);
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerOtp, setRegisterOtp] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerGender, setRegisterGender] = useState<Gender>(Gender.FEMALE);
  const [healthApproved, setHealthApproved] = useState(false);
  const [healthDeclaration, setHealthDeclaration] = useState<HealthDeclarationResult | null>(null);
  const [showHealthDeclaration, setShowHealthDeclaration] = useState(false);
  const [agreementApproved, setAgreementApproved] = useState(false);
  const [pushApproved, setPushApproved] = useState(false);
  const [pushWorkoutReminders, setPushWorkoutReminders] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipType>(initialPlan || MembershipType.OPEN_GYM);
  const [trainingCardSize, setTrainingCardSize] = useState<TrainingCardSize>(1);
  const [isFamilyPlan, setIsFamilyPlan] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyMembersCount, setFamilyMembersCount] = useState(2);
  const [familyBillingMode, setFamilyBillingMode] = useState<FamilyBillingMode>('ANNUAL_BY_SIZE');
  const [familyMemberPlans, setFamilyMemberPlans] = useState<FamilyMemberPlanSelection[]>([]);
  const [familyAccountDrafts, setFamilyAccountDrafts] = useState<FamilyAccountDraft[]>([]);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);
  const [paymentStarting, setPaymentStarting] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const registrationPlans = useMemo(
    () => (settings.membershipPlans?.length ? settings.membershipPlans : DEFAULT_MEMBERSHIP_PLAN_CONFIGS).filter(plan => plan.active),
    [settings.membershipPlans]
  );
  const selectedPlanConfig = registrationPlans.find(plan => plan.id === selectedPlan);
  const selectedPlanPrice = selectedPlanConfig?.price ?? MEMBERSHIP_PRICES[selectedPlan] ?? 0;
  const familyAccountAt = (index: number): FamilyAccountDraft => familyAccountDrafts[index] || {
    name: resizeFamilyPlans(familyMemberPlans, familyMembersCount, registerName.trim() || 'המשלם הראשי')[index + 1]?.memberName || `בן/בת משפחה ${index + 2}`,
    username: '',
    email: '',
    phone: '',
    password: '',
    birthDate: '',
    gender: Gender.MALE
  };
  const updateFamilyAccount = (index: number, patch: Partial<FamilyAccountDraft>) => setFamilyAccountDrafts(current =>
    Array.from({ length: Math.max(familyMembersCount - 1, current.length) }, (_, draftIndex) => draftIndex === index
      ? { ...(current[draftIndex] || familyAccountAt(draftIndex)), ...patch }
      : (current[draftIndex] || familyAccountAt(draftIndex)))
  );

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
        const draft = pending.registrationDraft as { user?: User; familyUsers?: User[] } | undefined;
        if (!draft?.user || draft.user.id !== pending.userId) throw new Error('פרטי ההרשמה לא נמצאו במכשיר זה. יש לפנות למועדון עם אישור העסקה.');
        const payment: Payment = {
          id: `payment-cardcom-${transactionKey}`,
          traineeId: draft.user.id,
          traineeName: draft.user.name,
          amount: verified.amount,
          date: new Date().toISOString().split('T')[0],
          timestamp: new Date().toISOString(),
          status: 'PAID',
          membershipTypePurchased: verified.membershipType,
          paymentMethod: `Cardcom${verified.last4Digits ? ` •••• ${verified.last4Digits}` : ''}`,
          isMock: false
        };
        return onRegister(draft.user, payment, draft.familyUsers || []).then(() => {
          markTransactionProcessed(transactionKey);
          clearPendingCardcomPayment();
          clearCardcomReturnParams();
        });
      })
      .catch(paymentError => {
        setError(paymentError instanceof Error ? paymentError.message : 'לא ניתן לאמת את התשלום מול Cardcom.');
      })
      .finally(() => setPaymentStarting(false));
    // Process the hosted-payment return once when the unauthenticated gateway mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendLoginOtp = () => {
    resetMessages();
    setOtpSent(true);
    setNotice('הקוד נשלח בהדמיה. קוד הבדיקה הוא 1111.');
  };

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    resetMessages();
    setAuthPending(true);
    try {
      await onPasswordLogin(username.trim(), password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'לא ניתן להתחבר כרגע.');
    } finally {
      setAuthPending(false);
    }
  };

  const handlePhoneLogin = async (event: React.FormEvent) => {
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
    setAuthPending(true);
    try {
      await onPhoneLogin(phone, otp);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'לא ניתן להתחבר כרגע.');
    } finally {
      setAuthPending(false);
    }
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
    const normalizedEmail = registerEmail.trim().toLowerCase();
    if (!registerName.trim() || !registerUsername.trim() || !normalizedEmail || !registerPassword || !registerBirthDate) {
      setError('יש להשלים את כל השדות.');
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('יש להזין כתובת אימייל תקינה.');
      return;
    }
    if (registerPassword.length < 8) {
      setError('הסיסמה חייבת להכיל לפחות 8 תווים.');
      return;
    }
    if (users.some(item => item.username?.toLowerCase() === registerUsername.trim().toLowerCase())) {
      setError('שם המשתמש כבר תפוס.');
      return;
    }
    if (users.some(item => item.email?.trim().toLowerCase() === normalizedEmail)) {
      setError('כתובת האימייל כבר רשומה. ניתן לעבור למסך הכניסה.');
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

    if (pushApproved) {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushApproved(false);
        setPushWorkoutReminders(false);
        setNotice('המכשיר אינו תומך כרגע ב־PUSH. ב־iPhone ניתן להפעיל לאחר התקנת האפליקציה במסך הבית.');
      } else if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setPushApproved(false);
          setPushWorkoutReminders(false);
          setNotice('הדפדפן לא אישר התראות. ניתן להפעיל אותן מאוחר יותר בפרופיל.');
        }
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
    const familyAccounts = isFamilyPlan
      ? Array.from({ length: familyMembersCount - 1 }, (_, index) => familyAccountAt(index))
      : [];
    if (familyAccounts.some(account => !account.name.trim() || !account.username.trim() || !EMAIL_PATTERN.test(account.email.trim().toLowerCase()) || account.password.length < 8 || !account.birthDate)) {
      setError('יש להשלים שם, שם משתמש, אימייל תקין, סיסמה בת 8 תווים ותאריך לידה עבור כל בן משפחה.');
      return;
    }
    const familyIdentities = [registerUsername, registerEmail, registerPhone, ...familyAccounts.flatMap(account => [account.username, account.email, account.phone])]
      .filter(Boolean)
      .map(value => value.trim().toLowerCase().replace(/[^\p{L}\p{N}@.+]/gu, ''));
    if (isFamilyPlan && new Set(familyIdentities).size !== familyIdentities.length) {
      setError('לכל בן משפחה נדרשים שם משתמש, אימייל ומספר טלפון ייחודיים.');
      return;
    }
    const healthRecord = createHealthDeclarationRecord({
      signed: healthDeclaration?.signed ?? false,
      answers: healthDeclaration?.answers,
      requiresMedicalCertificate: healthDeclaration?.requiresMedicalCertificate,
      medicalCertificateApproved: false,
      parentConsent: healthDeclaration?.parentConsent,
      parentName: healthDeclaration?.parentName,
      parentIdNumber: healthDeclaration?.parentIdNumber,
      signatureName: healthDeclaration?.signatureName,
      medicalCertificateFileName: healthDeclaration?.medicalCertificateFileName,
      medicalCertificateDataUrl: healthDeclaration?.medicalCertificateDataUrl
    });
    const newUser: User = {
      id: `user-${now}`,
      name: registerName.trim(),
      username: registerUsername.trim(),
      password: registerPassword,
      email: registerEmail.trim().toLowerCase(),
      phone: registerPhone.trim(),
      role: UserRole.TRAINEE,
      gender: registerGender,
      age,
      birthDate: registerBirthDate,
      healthDeclarationSigned: healthDeclaration?.signed ?? false,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      healthDeclarationAnswers: healthDeclaration?.answers,
      healthDeclarationRequiresMedicalCertificate: healthDeclaration?.requiresMedicalCertificate,
      healthDeclarationMedicalCertificateApproved: false,
      healthDeclarationParentConsent: healthDeclaration?.parentConsent,
      healthDeclarationParentName: healthDeclaration?.parentName,
      healthDeclarationParentIdNumber: healthDeclaration?.parentIdNumber,
      healthDeclarationSignatureName: healthDeclaration?.signatureName,
      healthDeclarationMedicalCertificateFileName: healthDeclaration?.medicalCertificateFileName,
      healthDeclarationMedicalCertificateDataUrl: healthDeclaration?.medicalCertificateDataUrl,
      healthDeclarationHistory: [healthRecord],
      clubAgreementSigned: true,
      clubAgreementDate: new Date().toISOString().split('T')[0],
      pushNotificationsEnabled: pushApproved && 'Notification' in window && Notification.permission === 'granted',
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
    const familyUsers: User[] = familyAccounts.map((account, index) => {
      const plan = normalizedFamilyPlans[index + 1];
      const memberAge = calculateAge(account.birthDate);
      const membershipType = familyBillingMode === 'CUSTOM_COMBINED' ? plan.membershipType : MembershipType.FAMILY_MEMBERSHIP;
      const memberTerm = createMembershipTerm(familyBillingMode === 'ANNUAL_BY_SIZE' ? MembershipType.GROUP_ANNUAL : membershipType);
      return {
        id: `user-family-${now}-${index + 1}`,
        name: account.name.trim(),
        username: account.username.trim(),
        password: account.password,
        email: account.email.trim().toLowerCase(),
        phone: account.phone.trim(),
        role: UserRole.TRAINEE,
        gender: account.gender,
        age: memberAge,
        birthDate: account.birthDate,
        healthDeclarationSigned: false,
        clubAgreementSigned: true,
        clubAgreementDate: new Date().toISOString().split('T')[0],
        membershipType,
        membershipStatus: MembershipStatus.ACTIVE,
        ...memberTerm,
        personalTrainingRemaining: membershipType === MembershipType.PERSONAL_TRAINING ? plan.trainingSessionsCount : undefined,
        duoTrainingRemaining: membershipType === MembershipType.DUO_TRAINING ? plan.trainingSessionsCount : undefined,
        nutritionPlanPaid: membershipType === MembershipType.NUTRITION_COACHING,
        requestedWorkoutPlan: membershipType === MembershipType.WORKOUT_COACHING,
        priorityScore: 100,
        familyId,
        familyName: newUser.familyName,
        isFamilyPayer: false,
        familyPayerId: newUser.id,
        imageUrl: account.gender === Gender.FEMALE
          ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'
      };
    });
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
        planAmount: !isFamilyPlan ? selectedPlanPrice * (isTrainingCard ? trainingCardSize : 1) : undefined,
        planLabel: !isFamilyPlan ? selectedPlanConfig?.label : undefined,
        registrationDraft: { user: newUser, familyUsers }
      });
    } catch (paymentError) {
      setPaymentStarting(false);
      setError(paymentError instanceof Error ? paymentError.message : 'לא ניתן לפתוח את דף התשלום.');
    }
  };

  return (
    <main className="auth-gateway" dir="rtl">
      <section className="auth-panel">
        {landingUrl && <a className="auth-back" href={landingUrl}><ArrowLeft size={18} /> חזרה לדף המועדון</a>}
        <RubisLogo size={145} className="auth-panel-logo" />

        {screen === 'login' && (
          <>
            <h1>כניסה לחשבון</h1>
            <p>בחרו את הדרך הנוחה להיכנס.</p>
            {demoMode && <div className="auth-message notice">סביבת הדגמה — פרטי הכניסה של רובי כבר מולאו. אפשר גם להיכנס בטלפון 054-6995885 עם הקוד 1111.</div>}
            <div className="auth-method-tabs">
              <button className={loginMethod === 'password' ? 'active' : ''} onClick={() => { setLoginMethod('password'); resetMessages(); }}>
                <LockKeyhole size={16} /> משתמש / אימייל וסיסמה
              </button>
              <button className={loginMethod === 'phone' ? 'active' : ''} onClick={() => { setLoginMethod('phone'); resetMessages(); }}>
                <Phone size={16} /> טלפון ו־SMS
              </button>
            </div>

            {loginMethod === 'password' ? (
              <form onSubmit={handlePasswordLogin} className="auth-form">
                <label>שם משתמש או אימייל<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" placeholder="שם משתמש או name@example.com" /></label>
                <label>סיסמה<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></label>
                <button className="auth-primary" type="submit" disabled={authPending}>{authPending ? 'מתחבר…' : 'כניסה'}</button>
              </form>
            ) : (
              <form onSubmit={handlePhoneLogin} className="auth-form">
                <label>מספר טלפון<input inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="05X-XXXXXXX" /></label>
                {otpSent && <label>קוד אימות<input inputMode="numeric" maxLength={4} value={otp} onChange={event => setOtp(event.target.value)} placeholder="1111" /></label>}
                <button className="auth-primary" type="submit" disabled={authPending}>{authPending ? 'מתחבר…' : otpSent ? 'אימות וכניסה' : 'שליחת קוד SMS'}</button>
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
                <label>כתובת אימייל<input required type="email" value={registerEmail} onChange={event => setRegisterEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" /></label>
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
                  {registrationPlans.map(planConfig => {
                    const plan = planConfig.id as MembershipType;
                    return (
                    <button
                      key={plan}
                      type="button"
                      className={`auth-plan-card ${!isFamilyPlan && selectedPlan === plan ? 'active' : ''}`}
                      onClick={() => { setSelectedPlan(plan); setIsFamilyPlan(false); }}
                    >
                      <span>
                        <strong>{planConfig.label}</strong>
                        <small>{planConfig.description}</small>
                      </span>
                      <b>₪{planConfig.price}{planConfig.priceUnit === 'SESSION' ? ' לאימון' : planConfig.priceUnit === 'MONTH' ? ' לחודש' : ''}</b>
                    </button>
                  );})}
                </div>
                {!isFamilyPlan && (selectedPlan === MembershipType.PERSONAL_TRAINING || selectedPlan === MembershipType.DUO_TRAINING) && (
                  <div className="auth-family-options">
                    <label>גודל כרטיסייה<select value={trainingCardSize} onChange={event => setTrainingCardSize(Number(event.target.value) as TrainingCardSize)}>
                      {TRAINING_CARD_SIZES.map(size => <option key={size} value={size}>{size === 1 ? 'אימון אחד' : `${size} אימונים`} — ₪{size * selectedPlanPrice}</option>)}
                    </select></label>
                    <small>היתרה נשמרת בחשבון ותישלח התראה כאשר יישארו שני אימונים.</small>
                  </div>
                )}
                {isFamilyPlan && <div className="space-y-3">
                  <label className="block text-xs font-bold">שם המשפחה<input value={familyName} onChange={event => setFamilyName(event.target.value)} placeholder={`משפחת ${registerName.trim().split(' ')[0] || 'ישראל'}`} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" /></label>
                  <FamilyPlanConfigurator mode={familyBillingMode} onModeChange={setFamilyBillingMode} count={familyMembersCount} onCountChange={setFamilyMembersCount} plans={familyMemberPlans} onPlansChange={setFamilyMemberPlans} payerName={registerName.trim() || 'המשלם הראשי'} />
                  <section className="space-y-3 rounded-2xl border border-amber-500/30 bg-zinc-950/70 p-4">
                    <div><strong className="text-sm text-amber-300">חשבונות כניסה לבני המשפחה</strong><small className="mt-1 block text-zinc-300">לאחר התשלום ייווצר לכל אחד חשבון מתאמן נפרד. בכניסה הראשונה יהיה עליו לחתום על הצהרת בריאות.</small></div>
                    {Array.from({ length: familyMembersCount - 1 }, (_, index) => {
                      const account = familyAccountAt(index);
                      return <article key={index} className="grid gap-2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 sm:grid-cols-2">
                        <strong className="sm:col-span-2 text-xs text-white">בן/בת משפחה {index + 2}</strong>
                        <label>שם מלא<input required value={account.name} onChange={event => updateFamilyAccount(index, { name: event.target.value })} /></label>
                        <label>שם משתמש<input required value={account.username} onChange={event => updateFamilyAccount(index, { username: event.target.value })} autoComplete="off" /></label>
                        <label>אימייל<input required type="email" value={account.email} onChange={event => updateFamilyAccount(index, { email: event.target.value })} autoComplete="off" /></label>
                        <label>טלפון אישי — לא חובה<input inputMode="tel" value={account.phone} onChange={event => updateFamilyAccount(index, { phone: event.target.value })} /></label>
                        <label>סיסמה — לפחות 8 תווים<input required minLength={8} type="password" value={account.password} onChange={event => updateFamilyAccount(index, { password: event.target.value })} autoComplete="new-password" /></label>
                        <label>תאריך לידה<input required type="date" value={account.birthDate} onChange={event => updateFamilyAccount(index, { birthDate: event.target.value })} /></label>
                        <label className="sm:col-span-2">מין<select value={account.gender} onChange={event => updateFamilyAccount(index, { gender: event.target.value as Gender })}><option value={Gender.MALE}>זכר</option><option value={Gender.FEMALE}>נקבה</option></select></label>
                      </article>;
                    })}
                  </section>
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
                      : selectedPlanPrice * ((selectedPlan === MembershipType.PERSONAL_TRAINING || selectedPlan === MembershipType.DUO_TRAINING) ? trainingCardSize : 1);
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
