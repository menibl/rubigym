/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, UserRole, Gender, MembershipType, MembershipStatus, MEMBERSHIP_TYPE_LABELS, MEMBERSHIP_PRICES, CURRENT_PRIMARY_MEMBERSHIP_PLANS, CURRENT_MEMBERSHIP_ADD_ONS, TRAINING_CARD_SIZES, TrainingCardSize, DiscountCode, FamilyBillingMode, FamilyMemberPlanSelection } from '../types';
import { X, Check, ShieldCheck, CreditCard, UserPlus, FileText, HeartPulse, Sparkles, Users, Lock, Phone, Calendar, User as UserIcon } from 'lucide-react';
import { createHealthDeclarationRecord } from '../data/healthDeclarationRecords';
import { createMembershipTerm } from '../data/membershipPolicy';
import { DiscountCodeField } from './DiscountCodeField';
import { FamilyPlanConfigurator } from './FamilyPlanConfigurator';
import { familyPurchaseAmount, resizeFamilyPlans } from '../data/familyMembership';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteRegistration: (newUser: User, familyMembers?: User[]) => void;
  existingUsers: User[];
  discountCodes: DiscountCode[];
  onUpdateDiscountCodes?: (codes: DiscountCode[]) => void;
}

export const RegisterModal: React.FC<RegisterModalProps> = ({
  isOpen,
  onClose,
  onCompleteRegistration,
  existingUsers,
  discountCodes,
  onUpdateDiscountCodes
}) => {
  const [step, setStep] = useState<number>(1);
  const [error, setError] = useState<string>('');

  // Step 1: Personal info
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);

  // Step 2: Health Declaration
  const [healthConfirmed, setHealthConfirmed] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Step 3: Membership
  const [isFamilyTrack, setIsFamilyTrack] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<MembershipType>(MembershipType.OPEN_GYM);
  const [trainingCardSize, setTrainingCardSize] = useState<TrainingCardSize>(1);
  const [familyMembersQuota, setFamilyMembersQuota] = useState<number>(2);
  const [familyName, setFamilyName] = useState('');
  const [familyBillingMode, setFamilyBillingMode] = useState<FamilyBillingMode>('ANNUAL_BY_SIZE');
  const [familyMemberPlans, setFamilyMemberPlans] = useState<FamilyMemberPlanSelection[]>([]);

  // Step 4: Payment
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardId, setCardId] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountCode | null>(null);

  // Step 5: Family sub-members
  const [familySubMembers, setFamilySubMembers] = useState<Array<{
    name: string;
    username: string;
    password: string;
    phone: string;
    birthDate: string;
    gender: Gender;
    healthConfirmed: boolean;
  }>>([]);

  const applySelectedDiscount = (amount: number) => appliedDiscount?.discountPercent
    ? Math.round(amount * (1 - appliedDiscount.discountPercent / 100))
    : Math.max(0, amount - (appliedDiscount?.discountAmount || 0));

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError('');
      setName('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setPhone('');
      setBirthDate('');
      setGender(Gender.MALE);
      setHealthConfirmed(false);
      setSignatureDataUrl('');
      setIsFamilyTrack(false);
      setSelectedMembership(MembershipType.OPEN_GYM);
      setTrainingCardSize(1);
      setFamilyMembersQuota(2);
      setFamilyName('');
      setFamilyBillingMode('ANNUAL_BY_SIZE');
      setFamilyMemberPlans([]);
      setCardHolder('');
      setCardNumber('');
      setCardExpiry('');
      setCardCvv('');
      setCardId('');
      setDiscountInput('');
      setAppliedDiscount(null);
      setFamilySubMembers([]);
    }
  }, [isOpen]);

  // Canvas drawing handlers for Signature
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureDataUrl('');
    }
  };

  const calculateAge = (dateStr: string): number => {
    if (!dateStr) return 25;
    const birth = new Date(dateStr);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? age : 25;
  };

  // Step 1 Validation
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('אנא הזן שם מלא');
    if (!username.trim()) return setError('אנא הזן שם משתמש לחיבור');
    if (!password) return setError('אנא הזן סיסמה');
    if (password.length < 4) return setError('הסיסמה חייבת להכיל לפחות 4 תווים');
    if (password !== confirmPassword) return setError('הסיסמאות אינן תואמות');
    if (!phone.trim()) return setError('אנא הזן מספר טלפון');
    if (!birthDate) return setError('אנא הזן תאריך לידה');

    // Check if username already exists
    const exists = existingUsers.some(u => u.username?.toLowerCase() === username.trim().toLowerCase());
    if (exists) {
      return setError('שם משתמש זה כבר תפוס, אנא בחר שם משתמש אחר');
    }

    setStep(2);
  };

  // Step 2 Validation (Health Declaration)
  const handleStep2Next = () => {
    setError('');
    if (!healthConfirmed) {
      return setError('יש לאשר את הצהרת הבריאות');
    }
    setStep(3);
  };

  // Step 3 Validation (Membership Selection)
  const handleStep3Next = () => {
    setError('');
    if (isFamilyTrack && !familyName.trim()) {
      return setError('אנא הזן שם למשפחה (למשל: משפחת כהן)');
    }
    setStep(4);
  };

  // Step 4 Validation (Payment & Creation)
  const handleStep4Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const newUserId = `user-reg-${Date.now()}`;
    const userAge = calculateAge(birthDate);

    let createdFamilyId: string | undefined = undefined;
    if (isFamilyTrack) {
      createdFamilyId = `fam-${Date.now()}`;
    }
    const normalizedFamilyPlans = resizeFamilyPlans(familyMemberPlans, familyMembersQuota, name.trim() || 'המשלם הראשי');
    const payerFamilyPlan = familyBillingMode === 'CUSTOM_COMBINED' ? normalizedFamilyPlans[0] : undefined;

    const primaryUser: User = {
      id: newUserId,
      name: name.trim(),
      username: username.trim(),
      password: password,
      email: `${username.trim().toLowerCase().replace(/\s+/g, '')}@rubisgym.com`,
      phone: phone.trim(),
      role: UserRole.TRAINEE,
      gender: gender,
      age: userAge,
      birthDate: birthDate,
      healthDeclarationSigned: true,
      healthDeclarationSignatureUrl: signatureDataUrl,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      healthDeclarationHistory: [createHealthDeclarationRecord({ signed: true, signatureUrl: signatureDataUrl })],
      membershipType: isFamilyTrack ? payerFamilyPlan?.membershipType || MembershipType.FAMILY_MEMBERSHIP : selectedMembership,
      secondaryMemberships: [],
      membershipStatus: MembershipStatus.ACTIVE,
      ...createMembershipTerm(isFamilyTrack && familyBillingMode === 'ANNUAL_BY_SIZE' ? MembershipType.GROUP_ANNUAL : isFamilyTrack ? payerFamilyPlan?.membershipType || MembershipType.FAMILY_MEMBERSHIP : selectedMembership),
      priorityScore: 100,
      personalTrainingCardSize: !isFamilyTrack && selectedMembership === MembershipType.PERSONAL_TRAINING ? trainingCardSize : undefined,
      personalTrainingRemaining: isFamilyTrack && payerFamilyPlan?.membershipType === MembershipType.PERSONAL_TRAINING ? payerFamilyPlan.trainingSessionsCount : !isFamilyTrack && selectedMembership === MembershipType.PERSONAL_TRAINING ? trainingCardSize : undefined,
      duoTrainingCardSize: !isFamilyTrack && selectedMembership === MembershipType.DUO_TRAINING ? trainingCardSize : undefined,
      duoTrainingRemaining: isFamilyTrack && payerFamilyPlan?.membershipType === MembershipType.DUO_TRAINING ? payerFamilyPlan.trainingSessionsCount : !isFamilyTrack && selectedMembership === MembershipType.DUO_TRAINING ? trainingCardSize : undefined,
      nutritionPlanPaid: (isFamilyTrack ? payerFamilyPlan?.membershipType : selectedMembership) === MembershipType.NUTRITION_COACHING,
      requestedWorkoutPlan: [MembershipType.WORKOUT_COACHING, MembershipType.OPEN_GYM_WITH_PLAN].includes(isFamilyTrack ? payerFamilyPlan?.membershipType || MembershipType.FAMILY_MEMBERSHIP : selectedMembership),
      imageUrl: gender === Gender.FEMALE
        ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      familyId: createdFamilyId,
      familyName: isFamilyTrack ? familyName.trim() : undefined,
      isFamilyPayer: isFamilyTrack ? true : undefined,
      familyMembersCount: isFamilyTrack ? familyMembersQuota : undefined,
      familyBillingMode: isFamilyTrack ? familyBillingMode : undefined,
      familyMemberPlans: isFamilyTrack && familyBillingMode === 'CUSTOM_COMBINED' ? normalizedFamilyPlans : undefined,
      familyCombinedAmount: isFamilyTrack ? familyPurchaseAmount(familyBillingMode, familyMembersQuota, normalizedFamilyPlans) : undefined,
      familyTrackName: isFamilyTrack ? familyBillingMode === 'ANNUAL_BY_SIZE' ? `משפחתי שנתי (${familyMembersQuota} מתאמנים)` : familyBillingMode === 'MONTHLY_PER_MEMBER' ? `משפחתי חודשי (${familyMembersQuota} מתאמנים)` : 'משפחתי מותאם – תשלום מאוחד' : undefined
    };

    if (isFamilyTrack && familyMembersQuota > 1) {
      // Initialize sub-members array placeholder
      const initialSubs = Array.from({ length: familyMembersQuota - 1 }).map((_, idx) => ({
        name: `בן משפחה ${idx + 2}`,
        username: `${username.trim()}_member${idx + 2}`,
        password: '123456',
        phone: phone.trim(),
        birthDate: birthDate,
        gender: Gender.MALE,
        healthConfirmed: true
      }));
      setFamilySubMembers(initialSubs);
      setStep(5); // Go to family sub-members setup
      // Temporary store primary user
      (window as any).__tempPrimaryUser = primaryUser;
    } else {
      if (appliedDiscount?.isSingleUse && onUpdateDiscountCodes) onUpdateDiscountCodes(discountCodes.map(code => code.id === appliedDiscount.id ? { ...code, isUsed: true } : code));
      onCompleteRegistration(primaryUser);
      onClose();
    }
  };

  // Step 5: Save Family Members
  const handleStep5Finish = () => {
    const primaryUser = (window as any).__tempPrimaryUser as User;
    if (!primaryUser) return;

    const familyUsers: User[] = familySubMembers.map((sub, idx) => {
      const subAge = calculateAge(sub.birthDate);
      const assignedPlan = primaryUser.familyMemberPlans?.[idx + 1];
      const assignedMembership = primaryUser.familyBillingMode === 'CUSTOM_COMBINED' ? assignedPlan?.membershipType || MembershipType.OPEN_GYM : MembershipType.FAMILY_MEMBERSHIP;
      const assignedTerm = primaryUser.familyBillingMode === 'CUSTOM_COMBINED'
        ? createMembershipTerm(assignedMembership)
        : {
            membershipStartedAt: primaryUser.membershipStartedAt,
            membershipExpiry: primaryUser.membershipExpiry,
            membershipCommitmentEndsAt: primaryUser.membershipCommitmentEndsAt,
            recurringBillingMonths: primaryUser.recurringBillingMonths,
            monthlyBillingDay: primaryUser.monthlyBillingDay
          };
      return {
        id: `user-fam-${Date.now()}-${idx}`,
        name: sub.name.trim(),
        username: sub.username.trim(),
        password: sub.password,
        email: `${sub.username.trim().toLowerCase().replace(/\s+/g, '')}@rubisgym.com`,
        phone: sub.phone.trim(),
        role: UserRole.TRAINEE,
        gender: sub.gender,
        age: subAge,
        birthDate: sub.birthDate,
        healthDeclarationSigned: true,
        healthDeclarationDate: new Date().toISOString().split('T')[0],
        healthDeclarationHistory: [createHealthDeclarationRecord({ signed: true })],
        membershipType: assignedMembership,
        membershipStatus: MembershipStatus.ACTIVE,
        ...assignedTerm,
        priorityScore: 100,
        imageUrl: sub.gender === Gender.FEMALE
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
          : 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        familyId: primaryUser.familyId,
        familyName: primaryUser.familyName,
        isFamilyPayer: false,
        familyPayerId: primaryUser.id,
        familyBillingMode: primaryUser.familyBillingMode,
        familyMemberPlans: primaryUser.familyMemberPlans,
        personalTrainingRemaining: assignedPlan?.membershipType === MembershipType.PERSONAL_TRAINING ? assignedPlan.trainingSessionsCount : undefined,
        duoTrainingRemaining: assignedPlan?.membershipType === MembershipType.DUO_TRAINING ? assignedPlan.trainingSessionsCount : undefined,
        nutritionPlanPaid: assignedMembership === MembershipType.NUTRITION_COACHING,
        requestedWorkoutPlan: [MembershipType.WORKOUT_COACHING, MembershipType.OPEN_GYM_WITH_PLAN].includes(assignedMembership)
      };
    });

    delete (window as any).__tempPrimaryUser;
    if (appliedDiscount?.isSingleUse && onUpdateDiscountCodes) onUpdateDiscountCodes(discountCodes.map(code => code.id === appliedDiscount.id ? { ...code, isUsed: true } : code));
    onCompleteRegistration(primaryUser, familyUsers);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto dir-rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <UserPlus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">הרשמה למועדון RUBIS Gym</h2>
              <p className="text-xs text-slate-300 mt-0.5">צור חשבון חדש, חתום על הצהרת בריאות ובחר מסלול אימונים</p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700/60 text-xs">
            <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'}`}>1</span>
              <span>פרטים</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'}`}>2</span>
              <span>הצהרת בריאות</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'}`}>3</span>
              <span>בחירת מנוי</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-700"></div>
            <div className={`flex items-center gap-1.5 ${step >= 4 ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700'}`}>4</span>
              <span>תשלום</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <X size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6">
          {/* STEP 1: Personal Details */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <UserIcon size={16} className="text-emerald-600" />
                שלב 1: פרטים אישיים וסיסמה
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    required
                    placeholder="ישראל ישראלי"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">שם משתמש להתחברות *</label>
                  <input
                    type="text"
                    required
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">סיסמה *</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">אימות סיסמה *</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Lock size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">מספר טלפון *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="050-1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">תאריך לידה *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Calendar size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">מין *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGender(Gender.MALE)}
                      className={`py-2 text-xs rounded-xl border font-medium transition cursor-pointer ${
                        gender === Gender.MALE
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      גבר
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender(Gender.FEMALE)}
                      className={`py-2 text-xs rounded-xl border font-medium transition cursor-pointer ${
                        gender === Gender.FEMALE
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      אישה
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  המשך להצהרת בריאות
                  <Check size={16} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Health Declaration */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <HeartPulse size={18} className="text-rose-500" />
                שלב 2: חתימה על הצהרת בריאות תקנונית
              </h3>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-48 overflow-y-auto text-xs text-slate-700 space-y-2 leading-relaxed">
                <p className="font-bold text-slate-900">הצהרת בריאות וכושר גופני למועדון כושר RUBIS Gym:</p>
                <p>1. הנני מצהיר/ה כי מצב בריאותי תקין, ואני כשר/ה לבצע מאמצים גופניים עזים, אימוני כוח, אימונים פונקציונליים ואימונים קבוצתיים.</p>
                <p>2. ידוע לי כי הפעילות הגופנית במכון דורשת מאמץ גופני ניכר, ואין לי מניעה רפואית או מגבלה כלשהי הידועה לי.</p>
                <p>3. הנני מתחייב/ת לעדכן את צוות המאמנים מיידית בכל שינוי במצבי הבריאותי.</p>
                <p>4. הנני מאשר/ת ומסכים/ה לתקנון המועדון ומכללי ההתנהגות והביטול במערכת.</p>
              </div>

              {/* Signature Pad */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">חתימה דיגיטלית בתוך המסגרת (בעזרת העכבר/מגע):</label>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    נקה חתימה
                  </button>
                </div>
                <div className="border-2 border-dashed border-slate-300 rounded-xl bg-white overflow-hidden touch-none">
                  <canvas
                    ref={canvasRef}
                    width={500}
                    height={100}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-24 bg-slate-50 cursor-crosshair"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={healthConfirmed}
                  onChange={(e) => setHealthConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-800 font-medium leading-tight">
                  הריני מאשר/ת כי קראתי בעיון את הצהרת הבריאות, פרטיי נכונים ומדויקים ואני חותם/ת מרצוני החופשי.
                </span>
              </label>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  חזור
                </button>
                <button
                  type="button"
                  onClick={handleStep2Next}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  המשך לבחירת מנוי
                  <Check size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Select Membership */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <Sparkles size={18} className="text-amber-500" />
                שלב 3: בחירת מסלול מנוי
              </h3>

              {/* Toggle Individual vs Family */}
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setIsFamilyTrack(false)}
                  className={`py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                    !isFamilyTrack ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserIcon size={16} />
                  מנוי אישי
                </button>
                <button
                  type="button"
                  onClick={() => setIsFamilyTrack(true)}
                  className={`py-2.5 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
                    isFamilyTrack ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users size={16} />
                  מנוי משפחתי (מרובה משתמשים)
                </button>
              </div>

              {!isFamilyTrack ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...CURRENT_PRIMARY_MEMBERSHIP_PLANS, ...CURRENT_MEMBERSHIP_ADD_ONS].map(plan => (
                      <button type="button" key={plan} onClick={() => setSelectedMembership(plan)} className={`p-4 border-2 rounded-2xl text-right transition ${selectedMembership === plan ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="flex justify-between items-start gap-3">
                          <div><div className="font-bold text-sm text-slate-900">{MEMBERSHIP_TYPE_LABELS[plan].label}</div><div className="text-xs text-slate-500 mt-1">{MEMBERSHIP_TYPE_LABELS[plan].description}</div></div>
                          <span className="font-bold text-emerald-700 text-sm shrink-0">₪{MEMBERSHIP_PRICES[plan]}{plan === MembershipType.PERSONAL_TRAINING || plan === MembershipType.DUO_TRAINING ? ' לאימון' : plan === MembershipType.GROUP_MONTHLY || plan === MembershipType.GROUP_ANNUAL ? ' לחודש' : ''}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {(selectedMembership === MembershipType.PERSONAL_TRAINING || selectedMembership === MembershipType.DUO_TRAINING) && (
                    <label className="block text-xs font-bold text-slate-800">גודל כרטיסייה<select value={trainingCardSize} onChange={event => setTrainingCardSize(Number(event.target.value) as TrainingCardSize)} className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-xl bg-white">
                      {TRAINING_CARD_SIZES.map(size => <option key={size} value={size}>{size === 1 ? 'אימון אחד' : `${size} אימונים`} — ₪{size * MEMBERSHIP_PRICES[selectedMembership]}</option>)}
                    </select></label>
                  )}
                </div>
              ) : (
                /* FAMILY TRACK SETUP */
                <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">שם המשפחה (למשל: משפחת כהן) *</label>
                    <input
                      type="text"
                      placeholder="משפחת לוי"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <FamilyPlanConfigurator mode={familyBillingMode} onModeChange={setFamilyBillingMode} count={familyMembersQuota} onCountChange={setFamilyMembersQuota} plans={familyMemberPlans} onPlansChange={setFamilyMemberPlans} payerName={name.trim() || 'המשלם הראשי'} />

                  <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-indigo-100 flex items-center gap-2">
                    <Users size={14} className="text-indigo-600 shrink-0" />
                    <span>
                      רכישת מסלול משפחתי של {familyMembersQuota} מנויים תאפשר לך להוסיף בשלב הבא {familyMembersQuota - 1} בני משפחה עם שם משתמש וסיסמה אישיים משלהם!
                    </span>
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  חזור
                </button>
                <button
                  type="button"
                  onClick={handleStep3Next}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  המשך לתשלום ואישור
                  <Check size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Simulated Payment */}
          {step === 4 && (
            <form onSubmit={handleStep4Submit} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <CreditCard size={18} className="text-indigo-600" />
                שלב 4: פרטי תשלום ואישור מנוי
              </h3>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-center gap-2">
                <ShieldCheck size={20} className="text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold">הערת בדיקות מערכת: </span>
                  <span>
                    לטובת הבדיקה עדיין לא נגבה תשלום בפועל. הלחיצה על אישור תאשר את המנוי מיידית ותאפשר להתחיל להתאמן במערכת!
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-500">מסלול שנבחר: </span>
                  <span className="font-bold text-slate-900">
                    {isFamilyTrack
                      ? `חבילה משפחתית (${familyMembersQuota} מנויים - ${familyName})`
                      : MEMBERSHIP_TYPE_LABELS[selectedMembership]?.label}
                  </span>
                </div>
                <div className="font-bold text-emerald-700 text-sm">
                  {isFamilyTrack
                    ? `₪${applySelectedDiscount(familyPurchaseAmount(familyBillingMode, familyMembersQuota, resizeFamilyPlans(familyMemberPlans, familyMembersQuota, name.trim() || 'המשלם הראשי'))).toLocaleString('he-IL')}`
                    : `₪${applySelectedDiscount(MEMBERSHIP_PRICES[selectedMembership] * ((selectedMembership === MembershipType.PERSONAL_TRAINING || selectedMembership === MembershipType.DUO_TRAINING) ? trainingCardSize : 1)).toLocaleString('he-IL')}`}
                </div>
              </div>

              <DiscountCodeField discountCodes={discountCodes} value={discountInput} onChange={setDiscountInput} applied={appliedDiscount} onApplied={setAppliedDiscount} onMessage={(message, isError) => setError(isError ? message : '')} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">שם בעל הכרטיס</label>
                  <input
                    type="text"
                    required
                    placeholder={name || 'ישראל ישראלי'}
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">מספר כרטיס אשראי</label>
                  <input
                    type="text"
                    required
                    placeholder="4580 •••• •••• 1234"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">תוקף (MM/YY)</label>
                  <input
                    type="text"
                    required
                    placeholder="12/28"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none text-center font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">CVV / 3 ספרות בגב הכרטיס</label>
                  <input
                    type="text"
                    required
                    placeholder="777"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none text-center font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
                >
                  חזור
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Check size={16} />
                  אישור תשלום וסיום הרשמה
                </button>
              </div>
            </form>
          )}

          {/* STEP 5: Family Members Sub-accounts Setup (If Family track) */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                שלב 5: הגדרת משתמשים עבור {familyName} ({familySubMembers.length} בני משפחה)
              </h3>

              <p className="text-xs text-slate-600">
                הגדר את שם המשתמש והסיסמה עבור כל אחד מבני המשפחה כדי שיוכל להתחבר עצמאית למערכת:
              </p>

              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {familySubMembers.map((sub, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                    <div className="font-bold text-indigo-900 border-b pb-1">
                      בן משפחה #{idx + 2}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-600">שם מלא</label>
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => {
                            const updated = [...familySubMembers];
                            updated[idx].name = e.target.value;
                            setFamilySubMembers(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600">שם משתמש להתחברות</label>
                        <input
                          type="text"
                          value={sub.username}
                          onChange={(e) => {
                            const updated = [...familySubMembers];
                            updated[idx].username = e.target.value;
                            setFamilySubMembers(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600">סיסמה</label>
                        <input
                          type="text"
                          value={sub.password}
                          onChange={(e) => {
                            const updated = [...familySubMembers];
                            updated[idx].password = e.target.value;
                            setFamilySubMembers(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-600">טלפון</label>
                        <input
                          type="text"
                          value={sub.phone}
                          onChange={(e) => {
                            const updated = [...familySubMembers];
                            updated[idx].phone = e.target.value;
                            setFamilySubMembers(updated);
                          }}
                          className="w-full px-2.5 py-1.5 border rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleStep5Finish}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Check size={16} />
                  סים והתחל להתאמן!
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
