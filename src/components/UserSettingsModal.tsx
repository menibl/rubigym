/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole, MembershipType, MembershipStatus, MEMBERSHIP_TYPE_LABELS, Gender, DiscountCode, MEMBERSHIP_PRICES, CURRENT_PRIMARY_MEMBERSHIP_PLANS, CURRENT_MEMBERSHIP_ADD_ONS, FAMILY_MEMBERSHIP_PRICES } from '../types';
import { X, Check, Lock, User as UserIcon, Phone, Calendar, Users, Plus, Key, ShieldCheck, Trash2, Edit3, Tag, DollarSign, Percent, Bell, BellRing, Camera } from 'lucide-react';
import { HealthDeclarationForm, HealthDeclarationResult } from './HealthDeclarationForm';
import { createHealthDeclarationRecord } from '../data/healthDeclarationRecords';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  allUsers: User[];
  onUpdateAllUsers?: (updatedUsers: User[]) => void;
  onCreateFamilyMember?: (user: User) => Promise<void>;
  discountCodes?: DiscountCode[];
  onUpdateDiscountCodes?: (discountCodes: DiscountCode[]) => void;
  isAdminMode?: boolean; // If opened from admin panel to edit another user
  initialSection?: 'profile' | 'health' | 'family';
  onOpenFamilyPurchase?: () => void;
  onMedicalCertificateSubmitted?: (fileName?: string) => void;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  allUsers,
  onUpdateAllUsers,
  onCreateFamilyMember,
  discountCodes = [],
  onUpdateDiscountCodes,
  isAdminMode = false,
  initialSection = 'profile',
  onOpenFamilyPurchase,
  onMedicalCertificateSubmitted
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'family'>('profile');
  const [showHealthDeclaration, setShowHealthDeclaration] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || currentUser.name || '');
  const [password, setPassword] = useState(currentUser.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '');
  const [profileImage, setProfileImage] = useState(currentUser.imageUrl || '');
  const [role, setRole] = useState<UserRole>(currentUser.role || UserRole.TRAINEE);
  const [pushEnabled, setPushEnabled] = useState(Boolean(currentUser.pushNotificationsEnabled));
  const [workoutRemindersEnabled, setWorkoutRemindersEnabled] = useState(Boolean(currentUser.workoutRemindersEnabled));
  const [managerPushEnabled, setManagerPushEnabled] = useState(Boolean(currentUser.managerPushNotificationsEnabled));

  // Family Setup / Upgrade
  const [isFamilyPayer, setIsFamilyPayer] = useState(currentUser.isFamilyPayer || false);
  const [familyName, setFamilyName] = useState(currentUser.familyName || '');
  const [familyQuota, setFamilyQuota] = useState(currentUser.familyMembersCount || 3);

  // Discount code state
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<DiscountCode | null>(null);
  const [couponMsg, setCouponMsg] = useState('');

  // Add sub-family member form inside family tab
  const [showAddSubMember, setShowAddSubMember] = useState(false);
  const [subName, setSubName] = useState('');
  const [subUsername, setSubUsername] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPassword, setSubPassword] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subBirthDate, setSubBirthDate] = useState('');
  const [subGender, setSubGender] = useState<Gender>(Gender.MALE);
  const [subMembership, setSubMembership] = useState<MembershipType>(MembershipType.GROUP_MONTHLY);
  const [subHealthApproved, setSubHealthApproved] = useState(false);
  const [subHealthDeclaration, setSubHealthDeclaration] = useState<HealthDeclarationResult | null>(null);
  const [showSubHealthForm, setShowSubHealthForm] = useState(false);
  const [subAgreementApproved, setSubAgreementApproved] = useState(false);
  const [subAccountPending, setSubAccountPending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialSection === 'family' ? 'family' : 'profile');
      setShowHealthDeclaration(initialSection === 'health');
      setName(currentUser.name || '');
      setUsername(currentUser.username || currentUser.name || '');
      setPassword(currentUser.password || '');
      setNewPassword('');
      setConfirmNewPassword('');
      setPhone(currentUser.phone || '');
      setBirthDate(currentUser.birthDate || '');
      setProfileImage(currentUser.imageUrl || '');
      setRole(currentUser.role || UserRole.TRAINEE);
      setPushEnabled(Boolean(currentUser.pushNotificationsEnabled));
      setWorkoutRemindersEnabled(Boolean(currentUser.workoutRemindersEnabled));
      setManagerPushEnabled(Boolean(currentUser.managerPushNotificationsEnabled));
      setIsFamilyPayer(currentUser.isFamilyPayer || false);
      setFamilyName(currentUser.familyName || '');
      setFamilyQuota(currentUser.familyMembersCount || 3);
      setMsg(null);
      setShowAddSubMember(false);
      setCouponInput('');
      setAppliedCoupon(null);
      setCouponMsg('');
    }
  }, [isOpen, currentUser, initialSection]);

  if (!isOpen) return null;

  // Family members list
  const currentFamilyId = currentUser.familyId;
  const familyMembersList = currentFamilyId
    ? [currentUser, ...allUsers.filter(u => u.id !== currentUser.id && u.familyId === currentFamilyId)]
    : [];
  const canManageFamily = Boolean(currentUser.isFamilyPayer || isAdminMode);

  // Coupon application handler
  const handleApplyCoupon = () => {
    setCouponMsg('');
    if (!couponInput.trim()) return;
    const codeStr = couponInput.trim().toUpperCase();
    const match = discountCodes.find(c => c.code === codeStr);
    if (!match) {
      setCouponMsg('קוד הנחה לא תקין או פג תוקף');
      setAppliedCoupon(null);
      return;
    }
    setAppliedCoupon(match);
    setCouponMsg(`קוד הנחה ${match.code} הוחל בהצלחה!`);
  };

  // Change individual family member track
  const handleChangeMemberTrack = (memberId: string, newTrack: MembershipType) => {
    if (onUpdateAllUsers) {
      const updated = allUsers.map(u => u.id === memberId ? { ...u, membershipType: newTrack } : u);
      onUpdateAllUsers(updated);
      setMsg({ type: 'success', text: 'מסלול המנוי של בן המשפחה עודכן בהצלחה!' });
    }
  };

  // Remove a family member
  const handleRemoveFamilyMember = (memberId: string) => {
    if (onUpdateAllUsers) {
      const targetUser = allUsers.find(u => u.id === memberId);
      if (!targetUser) return;
      if (targetUser.isFamilyPayer) {
        alert('לא ניתן להסיר את המשלם הראשי של המשפחה. בטל את החשבון המשפחתי תחילה.');
        return;
      }
      const updated = allUsers.filter(u => u.id !== memberId);
      onUpdateAllUsers(updated);
      setMsg({ type: 'success', text: `בן המשפחה ${targetUser.name} הוסר מהחשבון המשפחתי.` });
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!name.trim()) {
      setMsg({ type: 'error', text: 'אנא הזן שם מלא' });
      return;
    }
    if (!username.trim()) {
      setMsg({ type: 'error', text: 'אנא הזן שם משתמש' });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        setMsg({ type: 'error', text: 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים' });
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setMsg({ type: 'error', text: 'אימות הסיסמה החדשה אינו תואם' });
        return;
      }
    }

    // Check username uniqueness if changed
    const usernameTaken = allUsers.some(
      u => u.id !== currentUser.id && u.username?.toLowerCase() === username.trim().toLowerCase()
    );
    if (usernameTaken) {
      setMsg({ type: 'error', text: 'שם משתמש זה כבר קיים במערכת, בחר שם אחר' });
      return;
    }

    const updated: User = {
      ...currentUser,
      name: name.trim(),
      username: username.trim(),
      password: newPassword ? newPassword : password,
      phone: phone.trim(),
      birthDate: birthDate,
      imageUrl: profileImage || currentUser.imageUrl,
      role: role,
      pushNotificationsEnabled: pushEnabled,
      workoutRemindersEnabled: pushEnabled && workoutRemindersEnabled,
      managerPushNotificationsEnabled: role === UserRole.MANAGER && pushEnabled && managerPushEnabled
    };

    onUpdateUser(updated);

    // If allUsers callback is present, update in list as well
    if (onUpdateAllUsers) {
      const { password: _credential, ...safeUpdated } = updated;
      onUpdateAllUsers(allUsers.map(u => u.id === updated.id ? safeUpdated as User : u));
    }

    onClose();
  };

  const handleProfileImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'error', text: 'יש לבחור קובץ תמונה בלבד.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'גודל קובץ המקור המרבי הוא 8MB.' });
      return;
    }

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('IMAGE_READ_FAILED'));
        reader.onerror = () => reject(reader.error || new Error('IMAGE_READ_FAILED'));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
        nextImage.src = source;
      });
      const maxSide = 512;
      const scale = Math.min(1, maxSide / image.naturalWidth, maxSide / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('IMAGE_CANVAS_FAILED');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setProfileImage(canvas.toDataURL('image/jpeg', 0.82));
      setMsg({ type: 'success', text: 'התמונה הוכנה לשמירה. לחץ על שמור שינויים.' });
    } catch {
      setMsg({ type: 'error', text: 'לא ניתן לעבד את התמונה. נסה תמונת JPG או PNG אחרת.' });
    } finally {
      event.target.value = '';
    }
  };

  const handlePushToggle = async (enabled: boolean) => {
    if (!enabled) {
      setPushEnabled(false);
      setWorkoutRemindersEnabled(false);
      setManagerPushEnabled(false);
      return;
    }

    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMsg({ type: 'error', text: 'לא ניתן להפעיל PUSH ללא אישור התראות בדפדפן.' });
        return;
      }
    }
    if ('Notification' in window && Notification.permission === 'denied') {
      setMsg({ type: 'error', text: 'ההתראות חסומות בדפדפן. יש לאפשר אותן בהגדרות האתר.' });
      return;
    }
    setPushEnabled(true);
  };

  const handleRenewHealthDeclaration = (result: HealthDeclarationResult) => {
    const record = createHealthDeclarationRecord({
      signed: result.signed,
      answers: result.answers,
      requiresMedicalCertificate: result.requiresMedicalCertificate,
      medicalCertificateApproved: false,
      parentConsent: result.parentConsent,
      parentName: result.parentName,
      parentIdNumber: result.parentIdNumber,
      signatureName: result.signatureName,
      medicalCertificateFileName: result.medicalCertificateFileName,
      medicalCertificateDataUrl: result.medicalCertificateDataUrl
    });
    const updated: User = {
      ...currentUser,
      healthDeclarationSigned: result.signed,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      healthDeclarationAnswers: result.answers,
      healthDeclarationRequiresMedicalCertificate: result.requiresMedicalCertificate,
      healthDeclarationMedicalCertificateApproved: false,
      healthDeclarationParentConsent: result.parentConsent,
      healthDeclarationParentName: result.parentName,
      healthDeclarationParentIdNumber: result.parentIdNumber,
      healthDeclarationSignatureName: result.signatureName,
      healthDeclarationMedicalCertificateFileName: result.medicalCertificateFileName,
      healthDeclarationMedicalCertificateDataUrl: result.medicalCertificateDataUrl,
      healthDeclarationHistory: [record, ...(currentUser.healthDeclarationHistory || [])]
    };
    onUpdateUser(updated);
    if (onUpdateAllUsers) {
      onUpdateAllUsers(allUsers.map(user => user.id === updated.id ? updated : user));
    }
    setShowHealthDeclaration(false);
    if (result.requiresMedicalCertificate) onMedicalCertificateSubmitted?.(result.medicalCertificateFileName);
    setMsg(result.signed
      ? { type: 'success', text: 'הצהרת הבריאות נחתמה מחדש ותוקפה הוארך בשנה.' }
      : { type: 'error', text: 'השאלון נשמר. נדרשת תעודה רפואית ואישור המועדון לפני כניסה לאימונים.' });
  };

  const handleApproveMedicalCertificate = () => {
    const updated: User = {
      ...currentUser,
      healthDeclarationSigned: true,
      healthDeclarationMedicalCertificateApproved: true,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      healthDeclarationHistory: currentUser.healthDeclarationHistory?.map((record, index) => index === 0
        ? { ...record, signed: true, medicalCertificateApproved: true }
        : record)
    };
    onUpdateUser(updated);
    onUpdateAllUsers?.(allUsers.map(user => user.id === updated.id ? updated : user));
    setMsg({ type: 'success', text: 'קבלת התעודה הרפואית אושרה והצהרת הבריאות הופעלה לשנה.' });
  };

  const handleEnableFamilyAccount = () => {
    if (!familyName.trim()) {
      setMsg({ type: 'error', text: 'אנא הזן שם למשפחה' });
      return;
    }
    if (!onOpenFamilyPurchase) {
      setMsg({ type: 'error', text: 'רכישת מסלול משפחתי מתבצעת מתוך חשבון המתאמן המשלם.' });
      return;
    }

    sessionStorage.setItem('baly_family_purchase_draft_v1', JSON.stringify({ familyName: familyName.trim(), familyQuota }));
    onClose();
    onOpenFamilyPurchase?.();
  };

  const handleAddFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = subEmail.trim().toLowerCase();
    if (!subName.trim() || !subUsername.trim() || !normalizedEmail || !subPassword.trim()) {
      setMsg({ type: 'error', text: 'אנא מלא שם מלא, שם משתמש, אימייל וסיסמה עבור בן המשפחה' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMsg({ type: 'error', text: 'יש להזין כתובת אימייל תקינה עבור בן המשפחה' });
      return;
    }
    if (subPassword.trim().length < 8) {
      setMsg({ type: 'error', text: 'הסיסמה לבן המשפחה חייבת להכיל לפחות 8 תווים' });
      return;
    }

    if (allUsers.some(u => [u.username, u.email].filter(Boolean).some(value => {
      const normalized = String(value).trim().toLowerCase();
      return normalized === subUsername.trim().toLowerCase() || normalized === normalizedEmail;
    }))) {
      setMsg({ type: 'error', text: 'שם המשתמש או כתובת האימייל כבר תפוסים' });
      return;
    }
    if (!subBirthDate || !subHealthApproved || !subAgreementApproved) {
      setMsg({ type: 'error', text: 'יש להזין תאריך לידה ולאשר הצהרת בריאות והסכם הצטרפות עבור בן המשפחה' });
      return;
    }

    const birth = new Date(subBirthDate);
    const today = new Date();
    let subAge = today.getFullYear() - birth.getFullYear();
    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) subAge -= 1;

    const newSubUser: User = {
      id: `user-fam-${Date.now()}`,
      name: subName.trim(),
      username: subUsername.trim(),
      password: subPassword.trim(),
      email: normalizedEmail,
      phone: subPhone.trim(),
      role: UserRole.TRAINEE,
      gender: subGender,
      age: Math.max(0, subAge),
      birthDate: subBirthDate,
      healthDeclarationSigned: subHealthDeclaration?.signed ?? false,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
      healthDeclarationAnswers: subHealthDeclaration?.answers,
      healthDeclarationRequiresMedicalCertificate: subHealthDeclaration?.requiresMedicalCertificate,
      healthDeclarationMedicalCertificateApproved: false,
      healthDeclarationParentConsent: subHealthDeclaration?.parentConsent,
      healthDeclarationParentName: subHealthDeclaration?.parentName,
      healthDeclarationParentIdNumber: subHealthDeclaration?.parentIdNumber,
      healthDeclarationSignatureName: subHealthDeclaration?.signatureName,
      healthDeclarationMedicalCertificateFileName: subHealthDeclaration?.medicalCertificateFileName,
      healthDeclarationMedicalCertificateDataUrl: subHealthDeclaration?.medicalCertificateDataUrl,
      healthDeclarationHistory: [createHealthDeclarationRecord({
        signed: subHealthDeclaration?.signed ?? false,
        answers: subHealthDeclaration?.answers,
        requiresMedicalCertificate: subHealthDeclaration?.requiresMedicalCertificate,
        medicalCertificateApproved: false,
        parentConsent: subHealthDeclaration?.parentConsent,
        parentName: subHealthDeclaration?.parentName,
        parentIdNumber: subHealthDeclaration?.parentIdNumber,
        signatureName: subHealthDeclaration?.signatureName,
        medicalCertificateFileName: subHealthDeclaration?.medicalCertificateFileName,
        medicalCertificateDataUrl: subHealthDeclaration?.medicalCertificateDataUrl
      })],
      clubAgreementSigned: true,
      clubAgreementDate: new Date().toISOString().split('T')[0],
      membershipType: subMembership,
      membershipStatus: MembershipStatus.ACTIVE,
      membershipExpiry: currentUser.membershipExpiry || '2027-12-31',
      priorityScore: 100,
      imageUrl: subGender === Gender.FEMALE
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      familyId: currentUser.familyId,
      familyName: currentUser.familyName,
      isFamilyPayer: false,
      familyPayerId: currentUser.id
    };

    if (!onCreateFamilyMember) {
      setMsg({ type: 'error', text: 'שירות פתיחת חשבון משפחתי אינו זמין כרגע.' });
      return;
    }
    setSubAccountPending(true);
    try {
      await onCreateFamilyMember(newSubUser);
    } catch (error) {
      setMsg({ type: 'error', text: error instanceof Error ? error.message : 'לא ניתן היה ליצור את חשבון בן המשפחה.' });
      setSubAccountPending(false);
      return;
    }

    setShowAddSubMember(false);
    setSubName('');
    setSubUsername('');
    setSubEmail('');
    setSubPassword('');
    setSubPhone('');
    setSubBirthDate('');
    setSubHealthApproved(false);
    setSubHealthDeclaration(null);
    setShowSubHealthForm(false);
    setSubAgreementApproved(false);
    setSubAccountPending(false);
    setMsg({ type: 'success', text: `בן המשפחה ${newSubUser.name} נוסף בהצלחה!` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-2 backdrop-blur-sm sm:items-center sm:p-4 dir-rtl">
      <div className="my-1 max-h-[calc(100dvh-0.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:my-8 sm:max-h-[calc(100dvh-2rem)]">
        
        {/* Header */}
        <div className="sticky top-0 z-20 bg-slate-900 p-5 text-white relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl border border-emerald-500/30">
              <UserIcon size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {isAdminMode ? `עריכת משתמש: ${currentUser.name}` : 'הגדרות חשבון ועדכון פרטים'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                שם משתמש: <span className="font-mono text-emerald-400">{currentUser.username || currentUser.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit3 size={15} />
            פרטים אישיים וסיסמה
          </button>
          <button
            onClick={() => setActiveTab('family')}
            className={`flex-1 py-3 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'family'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users size={15} />
            הגדרות משפחה ({familyMembersList.length})
          </button>
        </div>

        {msg && (
          <div className={`mx-5 mt-4 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {msg.type === 'success' ? <Check size={16} /> : <X size={16} />}
            <span>{msg.text}</span>
          </div>
        )}

        <div className="p-6">
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <img
                  src={profileImage || currentUser.imageUrl}
                  alt={`תמונת הפרופיל של ${name || currentUser.name}`}
                  className="h-24 w-24 rounded-full border-2 border-emerald-500 object-cover shadow-md"
                />
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white transition hover:bg-emerald-700">
                  <Camera size={16} />
                  החלפת תמונת פרופיל
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={handleProfileImageChange}
                  />
                </label>
                <span className="text-[10px] text-slate-500">JPG, PNG או WEBP עד 2MB</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">שם מלא *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">שם משתמש להתחברות *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">טלפון</label>

                  <div className="relative">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Phone size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">תאריך לידה</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                    />
                    <Calendar size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck size={15} />
                  הצהרת בריאות שנתית
                </div>
                <p className="text-[11px] text-emerald-800">
                  חתימה אחרונה: {currentUser.healthDeclarationDate || 'לא נחתמה'}. הצהרה חסרה או ישנה משנה חוסמת הרשמה לכל אימון.
                </p>
                <button
                  type="button"
                  onClick={() => setShowHealthDeclaration(current => !current)}
                  className="px-3 py-2 rounded-lg bg-emerald-700 text-white font-bold text-[11px]"
                >
                  חתימה מחדש על הצהרת הבריאות
                </button>
                {showHealthDeclaration && (
                  <div className="mt-3 rounded-2xl bg-slate-950 p-4">
                    <HealthDeclarationForm
                      fullName={currentUser.name}
                      age={currentUser.age}
                      onComplete={handleRenewHealthDeclaration}
                    />
                  </div>
                )}
                {isAdminMode && currentUser.healthDeclarationRequiresMedicalCertificate && !currentUser.healthDeclarationMedicalCertificateApproved && (
                  <button type="button" onClick={handleApproveMedicalCertificate} className="mr-2 rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white">
                    אישור מנהל: התקבלה תעודה רפואית תקפה
                  </button>
                )}
              </div>

              <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 space-y-3">
                <div className="font-bold text-sky-950 flex items-center gap-1.5">
                  <BellRing size={15} />
                  התראות PUSH
                </div>
                <label className="flex items-center justify-between gap-3">
                  <span>הפעלת התראות PUSH במכשיר זה</span>
                  <input type="checkbox" checked={pushEnabled} onChange={event => void handlePushToggle(event.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1"><Bell size={13} /> תזכורות לפני אימונים</span>
                  <input
                    type="checkbox"
                    checked={workoutRemindersEnabled}
                    disabled={!pushEnabled}
                    onChange={event => setWorkoutRemindersEnabled(event.target.checked)}
                  />
                </label>
                {role === UserRole.MANAGER && (
                  <label className="flex items-center justify-between gap-3">
                    <span>הודעות PUSH כאשר מתקבלת פנייה למנהל</span>
                    <input
                      type="checkbox"
                      checked={managerPushEnabled}
                      disabled={!pushEnabled}
                      onChange={event => setManagerPushEnabled(event.target.checked)}
                    />
                  </label>
                )}
                <p className="text-[10px] text-sky-700">
                  ניתן להפעיל או לבטל בכל עת. התראות כשהאפליקציה סגורה יחוברו לספק PUSH בגרסת Production.
                </p>
              </div>

              {/* Password update section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 mt-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Key size={14} className="text-amber-500" />
                  עדכון סיסמה
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">סיסמה חדשה</label>
                    <input
                      type="password"
                      placeholder="השאר ריק כדי לא לשנות"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-600 mb-1">אימות סיסמה חדשה</label>
                    <input
                      type="password"
                      placeholder="אימות סיסמה"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Admin specific role edit */}
              {isAdminMode && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">תפקיד במערכת (מנהל/מאמן/מתאמן)</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value={UserRole.TRAINEE}>מתאמן (TRAINEE)</option>
                    <option value={UserRole.COACH}>מאמן (COACH)</option>
                    <option value={UserRole.MANAGER}>מנהל / מאמן ראשי (MANAGER)</option>
                  </select>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Check size={16} />
                  שמור שינויים
                </button>
              </div>
            </form>
          )}

          {activeTab === 'family' && (
            <div className="space-y-4 text-xs">
              {/* If user is not yet family or is payer */}
              {currentUser.role === UserRole.TRAINEE || isAdminMode ? (
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-indigo-900 text-sm flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      {currentUser.familyId ? `ניהול ${currentUser.familyName}` : 'הגדרת חשבון משפחתי'}
                    </div>
                    {currentUser.familyMembersCount && (
                      <span className="bg-indigo-200 text-indigo-900 px-2.5 py-1 rounded-full font-bold text-[11px]">
                        נצלו {familyMembersList.length} מתוך {currentUser.familyMembersCount} מנויים
                      </span>
                    )}
                  </div>

                  {!currentUser.familyId && (
                    <div className="space-y-3 pt-2">
                      <p className="text-slate-600">
                        הגדרת חשבון משפחתי מאפשרת לשלם במרוכז עבור מספר מתאמנים ולנהל להם משתמשים עם סיסמה אישית:
                      </p>
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">שם המשפחה (למשל: משפחת כהן)</label>
                        <input
                          type="text"
                          placeholder="משפחת כהן"
                          value={familyName}
                          onChange={(e) => setFamilyName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">מספר מנויים בחבילה המשפחתית</label>
                        <select
                          value={familyQuota}
                          onChange={(e) => setFamilyQuota(Number(e.target.value))}
                          className="w-full px-3 py-2 border rounded-xl bg-white"
                        >
                          <option value={2}>2 מנויים (₪550/חודש)</option>
                          <option value={3}>3 מנויים (₪750/חודש)</option>
                          <option value={4}>4 מנויים (₪920/חודש)</option>
                          <option value={5}>5 מנויים (₪1100/חודש)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleEnableFamilyAccount}
                        className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition cursor-pointer"
                      >
                        מעבר לבחירה ולתשלום על מסלול משפחתי
                      </button>
                    </div>
                  )}

                  {/* Existing Family Members List */}
                  {currentUser.familyId && (
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">רשימת משתמשי המשפחה:</span>
                        {canManageFamily && familyMembersList.length < (currentUser.familyMembersCount || 10) && (
                          <button
                            type="button"
                            onClick={() => setShowAddSubMember(!showAddSubMember)}
                            className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={14} />
                            הוסף בן משפחה
                          </button>
                        )}
                      </div>

                      {/* Add sub member inline form */}
                      {showAddSubMember && (
                        <form onSubmit={handleAddFamilyMember} className="p-3 bg-white border border-indigo-200 rounded-xl space-y-2.5">
                          <div className="font-bold text-slate-800 text-[11px]">הוספת בן משפחה חדש:</div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              required
                              placeholder="שם מלא *"
                              value={subName}
                              onChange={(e) => setSubName(e.target.value)}
                              className="p-2 border rounded-lg text-xs"
                            />
                            <input
                              type="text"
                              required
                              placeholder="שם משתמש להתחברות *"
                              value={subUsername}
                              onChange={(e) => setSubUsername(e.target.value)}
                              className="p-2 border rounded-lg font-mono text-xs"
                            />
                            <input
                              type="email"
                              required
                              placeholder="אימייל להתחברות *"
                              value={subEmail}
                              onChange={(e) => setSubEmail(e.target.value)}
                              autoComplete="email"
                              className="p-2 border rounded-lg text-xs"
                            />
                            <input
                              type="password"
                              required
                              placeholder="סיסמה *"
                              value={subPassword}
                              onChange={(e) => setSubPassword(e.target.value)}
                              className="p-2 border rounded-lg font-mono text-xs"
                            />
                            <input
                              type="tel"
                              placeholder="טלפון"
                              value={subPhone}
                              onChange={(e) => setSubPhone(e.target.value)}
                              className="p-2 border rounded-lg text-xs"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">מסלול מנוי לבן המשפחה:</label>
                            <select
                              value={subMembership}
                              onChange={(e) => setSubMembership(e.target.value as MembershipType)}
                              className="w-full p-2 border rounded-lg text-xs bg-white font-bold"
                            >
                              {[...CURRENT_PRIMARY_MEMBERSHIP_PLANS, ...CURRENT_MEMBERSHIP_ADD_ONS].map(typeKey => (
                                <option key={typeKey} value={typeKey}>
                                  {MEMBERSHIP_TYPE_LABELS[typeKey].label} (₪{MEMBERSHIP_PRICES[typeKey]})
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] font-bold text-slate-700">
                              תאריך לידה *
                              <input
                                type="date"
                                required
                                value={subBirthDate}
                                onChange={(e) => setSubBirthDate(e.target.value)}
                                className="mt-1 w-full p-2 border rounded-lg text-xs"
                              />
                            </label>
                            <label className="text-[11px] font-bold text-slate-700">
                              מין
                              <select
                                value={subGender}
                                onChange={(e) => setSubGender(e.target.value as Gender)}
                                className="mt-1 w-full p-2 border rounded-lg text-xs bg-white"
                              >
                                <option value={Gender.MALE}>זכר</option>
                                <option value={Gender.FEMALE}>נקבה</option>
                              </select>
                            </label>
                          </div>

                          <button type="button" onClick={() => setShowSubHealthForm(current => !current)} className={`w-full rounded-xl border p-3 text-right font-bold ${subHealthApproved ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                            {subHealthApproved ? '✓ הצהרת הבריאות של בן המשפחה נחתמה' : 'מילוי הצהרת בריאות עבור בן המשפחה'}
                          </button>
                          {showSubHealthForm && (
                            <div className="rounded-2xl bg-slate-950 p-4">
                              <HealthDeclarationForm
                                fullName={subName}
                                age={subBirthDate ? Math.max(0, new Date().getFullYear() - new Date(subBirthDate).getFullYear()) : 0}
                                onComplete={result => {
                                  setSubHealthDeclaration(result);
                                  setSubHealthApproved(result.signed);
                                  if (result.signed) {
                                    setShowSubHealthForm(false);
                                    setMsg({ type: 'success', text: 'הצהרת הבריאות של בן המשפחה נשמרה.' });
                                  } else {
                                    setMsg({ type: 'error', text: 'נדרשת תעודה רפואית עבור בן המשפחה לפני הפעלת החשבון.' });
                                  }
                                }}
                              />
                            </div>
                          )}
                          <label className="flex items-start gap-2 text-[11px] text-slate-700">
                            <input type="checkbox" checked={subAgreementApproved} onChange={event => setSubAgreementApproved(event.target.checked)} />
                            <span>אני מאשר/ת וחותם/ת על הסכם ההצטרפות והתקנון עבור בן המשפחה.</span>
                          </label>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowAddSubMember(false)}
                              className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 text-xs font-bold"
                            >
                              ביטול
                            </button>
                            <button
                              type="submit"
                              disabled={subAccountPending}
                              className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs disabled:cursor-wait disabled:opacity-60"
                            >
                              {subAccountPending ? 'יוצר חשבון…' : 'אישור והוספה'}
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Family members interactive list with track assignment & deletion */}
                      <div className="space-y-2.5">
                        {familyMembersList.map((m) => (
                          <div key={m.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 shadow-xs">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                  {m.name}
                                  {m.isFamilyPayer && (
                                    <span className="bg-amber-100 text-amber-900 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-200">
                                      משלם ראשי
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                  שם משתמש: <span className="font-bold text-indigo-700">{m.username || m.name}</span> | הסיסמה נשמרת באופן מאובטח ואינה מוצגת
                                </div>
                              </div>

                              {canManageFamily && !m.isFamilyPayer && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFamilyMember(m.id)}
                                  className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="הסר בן משפחה"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>

                            {/* Individual Track Selector for each family member */}
                            <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100 text-xs">
                              <span className="text-slate-600 font-medium text-[11px]">מסלול אישי:</span>
                              <select
                                value={m.membershipType || MembershipType.GROUP_MONTHLY}
                                onChange={(e) => handleChangeMemberTrack(m.id, e.target.value as MembershipType)}
                                disabled={!canManageFamily}
                                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-[11px] focus:outline-none focus:border-indigo-500"
                              >
                                {[...CURRENT_PRIMARY_MEMBERSHIP_PLANS, ...CURRENT_MEMBERSHIP_ADD_ONS].map(typeKey => (
                                  <option key={typeKey} value={typeKey}>
                                    {MEMBERSHIP_TYPE_LABELS[typeKey].label} (₪{MEMBERSHIP_PRICES[typeKey]})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Full Billing Calculation & Discount Codes Engine */}
                      {(() => {
                        const pricedCount = Math.min(6, Math.max(2, currentUser.familyMembersCount || familyMembersList.length));
                        const baseSubtotal = FAMILY_MEMBERSHIP_PRICES[pricedCount];
                        let couponDiscount = 0;
                        if (appliedCoupon) {
                          if (appliedCoupon.discountPercent > 0) {
                            couponDiscount = Math.round(baseSubtotal * (appliedCoupon.discountPercent / 100));
                          } else if (appliedCoupon.discountAmount) {
                            couponDiscount = appliedCoupon.discountAmount;
                          }
                        }
                        const finalTotal = Math.max(0, baseSubtotal - couponDiscount);

                        return (
                          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-2xl p-4 mt-4 space-y-3 shadow-lg">
                            <div className="font-bold text-sm text-indigo-300 flex items-center justify-between border-b border-indigo-800/80 pb-2">
                              <span className="flex items-center gap-1.5">
                                <DollarSign size={16} className="text-emerald-400" />
                                חישוב תשלום חודשי כולל למשפחה
                              </span>
                              <span className="text-xs bg-indigo-800/60 text-indigo-200 px-2 py-0.5 rounded-full">
                                {familyMembersList.length} מנויים פעילים
                              </span>
                            </div>

                            {/* Coupon Code Input */}
                            <div className="space-y-1.5 pt-1">
                              <label className="block text-[11px] font-bold text-indigo-200">
                                קוד הנחה (מאת המאמן הראשי / מנהל):
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  placeholder="הזן קוד (למשל: RUBI20)"
                                  value={couponInput}
                                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                  className="w-full px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 font-mono text-white text-xs uppercase focus:outline-none focus:border-amber-400"
                                />
                                <button
                                  type="button"
                                  onClick={handleApplyCoupon}
                                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shrink-0 transition cursor-pointer"
                                >
                                  החל קוד
                                </button>
                              </div>
                              {couponMsg && (
                                <p className={`text-[11px] font-bold ${appliedCoupon ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {couponMsg}
                                </p>
                              )}
                            </div>

                            {/* Breakdown List */}
                            <div className="space-y-1 text-xs pt-2 border-t border-indigo-900/60">
                              <div className="flex justify-between text-slate-300">
                                <span>סיכום מסלולים אישיים ({familyMembersList.length} נפשות):</span>
                                <span className="font-mono">₪{baseSubtotal}</span>
                              </div>
                              {couponDiscount > 0 && (
                                <div className="flex justify-between text-amber-400 font-bold">
                                  <span>הנחת קוד קופון ({appliedCoupon?.code}):</span>
                                  <span className="font-mono">-₪{couponDiscount}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-white text-sm font-extrabold pt-2 border-t border-indigo-800/80">
                                <span>סה"כ לתשלום חודשי:</span>
                                <span className="text-emerald-400 font-mono text-base">₪{finalTotal}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border rounded-xl text-center space-y-2">
                  <Users size={24} className="mx-auto text-indigo-500" />
                  <div className="font-bold text-slate-800">משתמש זה מחובר לחשבון המשפחתי: {currentUser.familyName}</div>
                  <p className="text-slate-500 text-[11px]">ניהול החשבון והתשלום מבוצע על ידי המשלם הראשי במשפחה.</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
