/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { X, LogIn, UserPlus, Lock, User as UserIcon, ShieldAlert, Sparkles, Check } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onLoginSuccess: (user: User) => void;
  onOpenRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  users,
  onLoginSuccess,
  onOpenRegister,
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = usernameInput.trim().toLowerCase();
    const cleanPassword = passwordInput.trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('אנא הזן שם משתמש וסיסמה');
      return;
    }

    // Find user matching username or email or name
    const foundUser = users.find((u) => {
      const matchUsername = u.username?.toLowerCase() === cleanUsername;
      const matchName = u.name.toLowerCase() === cleanUsername;
      const matchEmail = u.email.toLowerCase() === cleanUsername;
      return matchUsername || matchName || matchEmail;
    });

    if (!foundUser) {
      setErrorMsg('שם משתמש לא נמצא במערכת');
      return;
    }

    // Check password (allow '123456' or user password)
    if (foundUser.password && foundUser.password !== cleanPassword) {
      // If user has a password set and it doesn't match
      setErrorMsg('סיסמה שגויה, אנא נסה שוב');
      return;
    }

    onLoginSuccess(foundUser);
    onClose();
  };

  // Quick demo logins
  const handleQuickLogin = (role: UserRole) => {
    const target = users.find((u) => u.role === role) || users[0];
    onLoginSuccess(target);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto dir-rtl">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/20 text-emerald-400 p-2.5 rounded-xl border border-emerald-500/30">
              <LogIn size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold">התחברות למערכת RUBIS Gym</h2>
              <p className="text-xs text-slate-400 mt-0.5">הזן שם משתמש וסיסמה כדי להמשיך</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">שם משתמש / אימייל</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="לדוגמה: רובי באלי"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                />
                <UserIcon size={16} className="absolute left-2.5 top-3 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">סיסמה</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none pl-8"
                />
                <Lock size={16} className="absolute left-2.5 top-3 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-slate-900/10"
            >
              <LogIn size={16} />
              התחבר למערכת
            </button>
          </form>

          {/* Quick Admin Credential Notice */}
          <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1 text-amber-950">
              <Sparkles size={13} className="text-amber-600" />
              פרטי התחברות למנהל המערכת / מאמן ראשי:
            </div>
            <div>
              שם משתמש: <span className="font-mono font-bold">רובי באלי</span> | סיסמה: <span className="font-mono font-bold">123456</span>
            </div>
          </div>

          <div className="relative border-t border-slate-100 my-4 pt-4 text-center">
            <p className="text-xs text-slate-500 mb-3">עדיין אין לך מנוי במועדון?</p>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRegister();
              }}
              className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus size={16} />
              הרשמה חדשה + הצהרת בריאות ובחירת מנוי
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
