/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { User, UserRole, MembershipStatus, MembershipType, MEMBERSHIP_TYPE_LABELS } from '../types';
import { Shield, Sparkles, UserCheck, AlertOctagon, RefreshCw, Trophy } from 'lucide-react';

interface RoleSwitcherProps {
  allUsers: User[];
  activeUser: User;
  onSwitchUser: (user: User) => void;
  onResetDatabase: () => void;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({
  allUsers,
  activeUser,
  onSwitchUser,
  onResetDatabase,
}) => {
  const getBadgeStyle = (user: User) => {
    if (user.role === UserRole.MANAGER) return 'bg-amber-100 text-amber-800 border border-amber-300';
    if (user.role === UserRole.COACH) return 'bg-sky-100 text-sky-800 border border-sky-300';
    
    // Trainee status
    if (user.membershipStatus === MembershipStatus.DEBT) return 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse';
    if (user.membershipStatus === MembershipStatus.EXPIRED) return 'bg-slate-200 text-slate-700 border border-slate-400';
    if (user.priorityScore < 100) return 'bg-amber-100 text-amber-700 border border-amber-300';
    return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  };

  const getTraineeSubLabel = (user: User) => {
    if (user.role !== UserRole.TRAINEE) return '';
    const statusText = 
      user.membershipStatus === MembershipStatus.ACTIVE ? 'פעיל' :
      user.membershipStatus === MembershipStatus.DEBT ? 'במצב חוב' : 'פג תוקף';
    
    const typeText = user.membershipType 
      ? MEMBERSHIP_TYPE_LABELS[user.membershipType]?.label || user.membershipType
      : 'מנוי רגיל';

    const priorityText = user.priorityScore < 100 ? `🚨 עדיפות נמוכה (${user.priorityScore})` : 'עדיפות רגילה';

    return `${typeText} | ${statusText} | ${priorityText}`;
  };

  return (
    <div className="bg-slate-900 text-white rounded-xl shadow-xl border border-slate-800 p-4 mb-6" id="role-switcher-container">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3 mb-4">
        <div>
          <h2 className="text-md font-semibold font-sans tracking-tight flex items-center gap-2 text-amber-400">
            <Sparkles size={18} />
            סימולטור משתמשים – RUBIS Gym
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            מעבר קל בין תפקידים לבחינת מגבלות הרשמה, סמכויות, מערכת עונשים והרשאות
          </p>
        </div>
        <button
          onClick={onResetDatabase}
          className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-3 rounded-lg transition border border-slate-700"
          id="btn-reset-db"
        >
          <RefreshCw size={12} />
          איפוס מלא של הנתונים
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Managers & Coaches */}
        <div className="col-span-1 md:col-span-1 space-y-2 border-r border-slate-800 pr-3">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold mb-1">
            צוות המועדון
          </div>
          {allUsers
            .filter((u) => u.role !== UserRole.TRAINEE)
            .map((u) => (
              <button
                key={u.id}
                onClick={() => onSwitchUser(u)}
                className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-right text-xs ${
                  activeUser.id === u.id
                    ? 'bg-emerald-500/10 border border-emerald-500 text-emerald-300'
                    : 'hover:bg-slate-800 border border-transparent text-slate-300'
                }`}
                id={`btn-user-select-${u.id}`}
              >
                <img
                  src={u.imageUrl}
                  alt={u.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />
                <div className="flex-1 overflow-hidden">
                  <div className="font-medium truncate">{u.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    {u.role === UserRole.MANAGER ? (
                      <Shield size={10} className="text-amber-400" />
                    ) : (
                      <Sparkles size={10} className="text-sky-400" />
                    )}
                    {u.role === UserRole.MANAGER ? 'מנהל / מאמן ראשי' : 'מאמן כושר'}
                  </div>
                  <div className="text-[9px] text-amber-300 font-mono mt-0.5 truncate bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40">
                    משתמש: {u.username || u.name} | סיסמה: {u.password || '123456'}
                  </div>
                </div>
              </button>
            ))}
        </div>

        {/* Trainees */}
        <div className="col-span-1 md:col-span-3 space-y-2 pl-1">
          <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold mb-1">
            מתאמנים (חברי המועדון עם מצבים שונים)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {allUsers
              .filter((u) => u.role === UserRole.TRAINEE)
              .map((u) => {
                const isActive = activeUser.id === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => onSwitchUser(u)}
                    className={`flex items-start gap-2.5 p-2 rounded-lg transition-all text-right text-xs ${
                      isActive
                        ? 'bg-emerald-500/10 border border-emerald-500 text-emerald-300'
                        : 'hover:bg-slate-800 border border-transparent text-slate-300'
                    }`}
                    id={`btn-user-select-${u.id}`}
                  >
                    <img
                      src={u.imageUrl}
                      alt={u.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-700 mt-0.5"
                    />
                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center gap-1.5 justify-start">
                        <span className="font-semibold">{u.name}</span>
                        {u.role === UserRole.MANAGER && (
                          <Shield size={11} className="text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {getTraineeSubLabel(u)}
                      </div>
                      <div className="mt-1 flex gap-1 items-center">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-medium ${getBadgeStyle(u)}`}>
                          {u.membershipStatus === MembershipStatus.ACTIVE && 'מנוי פעיל'}
                          {u.membershipStatus === MembershipStatus.DEBT && 'חסום - חוב כספי ❌'}
                          {u.membershipStatus === MembershipStatus.EXPIRED && 'חסום - פג תוקף ❌'}
                        </span>
                        {u.priorityScore < 100 && (
                          <span className="px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-900 rounded text-[8px] font-medium flex items-center gap-0.5">
                            <AlertOctagon size={8} />
                            עדיפות נמוכה
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <div className="mt-3 bg-slate-950/50 rounded-lg p-2 border border-slate-800/80 flex items-center gap-2">
        <UserCheck size={14} className="text-emerald-400 shrink-0" />
        <span className="text-[11px] text-slate-300">
          משתמש מדמה פעיל כעת:{' '}
          <strong className="text-white font-semibold">{activeUser.name}</strong> (
          {activeUser.role === UserRole.MANAGER && 'מנהל'}
          {activeUser.role === UserRole.COACH && 'מאמן'}
          {activeUser.role === UserRole.TRAINEE && 'מתאמן'}
          )
        </span>
      </div>
    </div>
  );
};
