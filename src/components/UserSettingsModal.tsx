/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole, MembershipType, MembershipStatus, MEMBERSHIP_TYPE_LABELS, Gender, DiscountCode, MEMBERSHIP_PRICES } from '../types';
import { X, Check, Lock, User as UserIcon, Phone, Calendar, Users, Plus, Key, ShieldCheck, Trash2, Edit3, Tag, DollarSign, Percent, Bell, BellRing } from 'lucide-react';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  allUsers: User[];
  onUpdateAllUsers?: (updatedUsers: User[]) => void;
  discountCodes?: DiscountCode[];
  onUpdateDiscountCodes?: (discountCodes: DiscountCode[]) => void;
  isAdminMode?: boolean; // If opened from admin panel to edit another user
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  allUsers,
  onUpdateAllUsers,
  discountCodes = [],
  onUpdateDiscountCodes,
  isAdminMode = false
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'family'>('profile');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [name, setName] = useState(currentUser.name || '');
  const [username, setUsername] = useState(currentUser.username || currentUser.name || '');
  const [password, setPassword] = useState(currentUser.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '');
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
  const [subPassword, setSubPassword] = useState('123456');
  const [subPhone, setSubPhone] = useState('');
  const [subBirthDate, setSubBirthDate] = useState('');
  const [subGender, setSubGender] = useState<Gender>(Gender.MALE);
  const [subMembership, setSubMembership] = useState<MembershipType>(MembershipType.GROUP_MONTHLY);
  const [subHealthApproved, setSubHealthApproved] = useState(false);
  const [subAgreementApproved, setSubAgreementApproved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || '');
      setUsername(currentUser.username || currentUser.name || '');
      setPassword(currentUser.password || '');
      setNewPassword('');
      setConfirmNewPassword('');
      setPhone(currentUser.phone || '');
      setBirthDate(currentUser.birthDate || '');
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
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Family members list
  const currentFamilyId = currentUser.familyId;
  const familyMembersList = currentFamilyId
    ? allUsers.filter(u => u.familyId === currentFamilyId)
    : [];

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
      if (newPassword.length < 4) {
        setMsg({ type: 'error', text: 'הסיסמה החדשה חייבת להכיל לפחות 4 תווים' });
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
      role: role,
      pushNotificationsEnabled: pushEnabled,
      workoutRemindersEnabled: pushEnabled && workoutRemindersEnabled,
      managerPushNotificationsEnabled: role === UserRole.MANAGER && pushEnabled && managerPushEnabled
    };

    onUpdateUser(updated);

    // If allUsers callback is present, update in list as well
    if (onUpdateAllUsers) {
      onUpdateAllUsers(allUsers.map(u => u.id === updated.id ? updated : u));
    }

    setMsg({ type: 'success', text: 'הפרטים והסיסמה עודכנו בהצלחה!' });
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

  const handleRenewHealthDeclaration = () => {
    const updated: User = {
      ...currentUser,
      healthDeclarationSigned: true,
      healthDeclarationDate: new Date().toISOString().split('T')[0]
    };
    onUpdateUser(updated);
    if (onUpdateAllUsers) {
      onUpdateAllUsers(allUsers.map(user => user.id === updated.id ? updated : user));
    }
    setMsg({ type: 'success', text: 'הצהרת הבריאות נחתמה מחדש ותוקפה הוארך בשנה.' });
  };

  const handleEnableFamilyAccount = () => {
    if (!familyName.trim()) {
      setMsg({ type: 'error', text: 'אנא הזן שם למשפחה' });
      return;
    }

    const famId = currentUser.familyId || `fam-${Date.now()}`;
    const updated: User = {
      ...currentUser,
      familyId: famId,
      familyName: familyName.trim(),
      isFamilyPayer: true,
      familyMembersCount: familyQuota,
      familyTrackName: `מסלול משפחתי (${familyQuota} מנויים)`
    };

    onUpdateUser(updated);
    if (onUpdateAllUsers) {
      onUpdateAllUsers(allUsers.map(u => u.id === updated.id ? updated : u));
    }
    setMsg({ type: 'success', text: `חשבון משפחתי (${familyName}) הוגדר בהצלחה!` });
  };

  const handleAddFamilyMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subUsername.trim() || !subPassword.trim()) {
      setMsg({ type: 'error', text: 'אנא מלא שם מלא, שם משתמש וסיסמה עבור בן המשפחה' });
      return;
    }

    if (allUsers.some(u => u.username?.toLowerCase() === subUsername.trim().toLowerCase())) {
      setMsg({ type: 'error', text: 'שם המשתמש כבר תפוס' });
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
      email: `${subUsername.trim().toLowerCase().replace(/\s+/g, '')}@rubisgym.com`,
      phone: subPhone.trim() || currentUser.phone,
      role: UserRole.TRAINEE,
      gender: subGender,
      age: Math.max(0, subAge),
      birthDate: subBirthDate,
      healthDeclarationSigned: true,
      healthDeclarationDate: new Date().toISOString().split('T')[0],
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

    if (onUpdateAllUsers) {
      onUpdateAllUsers([newSubUser, ...allUsers]);
    }

    setShowAddSubMember(false);
    setSubName('');
    setSubUsername('');
    setSubPassword('123456');
    setSubPhone('');
    setSubBirthDate('');
    setSubHealthApproved(false);
    setSubAgreementApproved(false);
    setMsg({ type: 'success', text: `בן המשפחה ${newSubUser.name} נוסף בהצלחה!` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto dir-rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 text-white relative flex items-center justify-between">
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
                  onClick={handleRenewHealthDeclaration}
                  className="px-3 py-2 rounded-lg bg-emerald-700 text-white font-bold text-[11px]"
                >
                  חתימה מחדש על הצהרת הבריאות
                </button>
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
                        הגדר חשבון משפחתי
                      </button>
                    </div>
                  )}

                  {/* Existing Family Members List */}
                  {currentUser.familyId && (
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-800">רשימת משתמשי המשפחה:</span>
                        {familyMembersList.length < (currentUser.familyMembersCount || 10) && (
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
                              type="text"
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
                              {Object.entries(MEMBERSHIP_TYPE_LABELS).map(([typeKey, label]) => (
                                <option key={typeKey} value={typeKey}>
                                  {label} (₪{MEMBERSHIP_PRICES[typeKey as MembershipType] || 350}/חודש)
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

                          <label className="flex items-start gap-2 text-[11px] text-slate-700">
                            <input type="checkbox" checked={subHealthApproved} onChange={event => setSubHealthApproved(event.target.checked)} />
                            <span>אני מאשר/ת וחותם/ת על הצהרת הבריאות השנתית עבור בן המשפחה.</span>
                          </label>
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
                              className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                            >
                              אישור והוספה
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
                                  שם משתמש: <span className="font-bold text-indigo-700">{m.username || m.name}</span> | סיסמה: <span className="font-bold text-amber-700">{m.password || '123456'}</span>
                                </div>
                              </div>

                              {!m.isFamilyPayer && (
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
                                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 font-bold text-slate-800 text-[11px] focus:outline-none focus:border-indigo-500"
                              >
                                {Object.entries(MEMBERSHIP_TYPE_LABELS).map(([typeKey, label]) => (
                                  <option key={typeKey} value={typeKey}>
                                    {label} (₪{MEMBERSHIP_PRICES[typeKey as MembershipType] || 350})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Full Billing Calculation & Discount Codes Engine */}
                      {(() => {
                        const baseSubtotal = familyMembersList.reduce(
                          (sum, m) => sum + (MEMBERSHIP_PRICES[m.membershipType] || 350),
                          0
                        );
                        const familyDiscount = familyMembersList.length >= 2 ? Math.round(baseSubtotal * 0.1) : 0;
                        let couponDiscount = 0;
                        if (appliedCoupon) {
                          if (appliedCoupon.discountPercent > 0) {
                            couponDiscount = Math.round((baseSubtotal - familyDiscount) * (appliedCoupon.discountPercent / 100));
                          } else if (appliedCoupon.discountAmount) {
                            couponDiscount = appliedCoupon.discountAmount;
                          }
                        }
                        const finalTotal = Math.max(0, baseSubtotal - familyDiscount - couponDiscount);

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
                              {familyDiscount > 0 && (
                                <div className="flex justify-between text-emerald-400 font-bold">
                                  <span>הנחת חבילה משפחתית (10%-):</span>
                                  <span className="font-mono">-₪{familyDiscount}</span>
                                </div>
                              )}
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
