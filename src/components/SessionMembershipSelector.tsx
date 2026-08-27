import React from 'react';
import { CURRENT_MEMBERSHIP_CATALOG, MEMBERSHIP_TYPE_LABELS, MembershipType } from '../types';

interface SessionMembershipSelectorProps {
  value: MembershipType[];
  onChange: (value: MembershipType[]) => void;
  className?: string;
}

const groupMemberships = [MembershipType.GROUP_MONTHLY, MembershipType.GROUP_ANNUAL];

const options = [
  ...CURRENT_MEMBERSHIP_CATALOG
    .filter(type => !groupMemberships.includes(type))
    .map(type => ({ key: type, label: MEMBERSHIP_TYPE_LABELS[type].label, values: [type] })),
  { key: 'GROUP_ACCESS', label: 'קבוצתי', values: groupMemberships }
];

export const SessionMembershipSelector: React.FC<SessionMembershipSelectorProps> = ({ value, onChange, className = '' }) => {
  const toggle = (values: MembershipType[]) => {
    const selected = values.some(type => value.includes(type));
    const withoutOption = value.filter(type => !values.includes(type));
    onChange(selected ? withoutOption : [...withoutOption, ...values]);
  };

  return (
    <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${className}`}>
      {options.map(option => {
        const selected = option.values.some(type => value.includes(type));
        return (
          <button
            type="button"
            key={option.key}
            onClick={() => toggle(option.values)}
            aria-pressed={selected}
            className={`min-h-10 rounded-xl border px-2 py-2 text-[11px] font-black transition ${selected
              ? 'border-emerald-400 bg-emerald-100 text-emerald-900'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}
          >
            {selected ? '✓ ' : ''}{option.label}
          </button>
        );
      })}
    </div>
  );
};
