import React from 'react';
import { MEMBERSHIP_TYPE_LABELS, MembershipPlanConfig, Payment, User } from '../types';
import { homeMembershipSummary } from '../../shared/home-membership-summary.js';

export function HomeMembershipSummary({ user, payments, plans = [] }: { user: User; payments: Payment[]; plans?: MembershipPlanConfig[] }) {
  const rows = homeMembershipSummary(user, payments);
  return <span className="home-membership-summary" aria-label="סיכום המנויים, התשלומים ויתרות האימונים">
    {!rows.length && <span>לא נבחר מסלול — יש לבחור מסלול ולהשלים תשלום</span>}
    {rows.map(row => <span key={row.type} className="home-membership-summary-row">
      <span className="home-membership-summary-name">{plans.find(p => p.id === row.type)?.label || MEMBERSHIP_TYPE_LABELS[row.type]?.label || row.type}</span>
      <span>{row.status} · {row.expiry ? <>תוקף <bdi>{Number(row.expiry.slice(8, 10))}/{Number(row.expiry.slice(5, 7))}/{row.expiry.slice(0, 4)}</bdi></> : 'תוקף לא תועד'}</span>
      {row.remaining !== null && <span className="home-membership-summary-balance">יתרה: <bdi>{row.remaining}{row.size ? `/${row.size}` : ''}</bdi> {row.type === 'OPEN_PUNCH_CARD' ? 'כניסות' : 'אימונים'}</span>}
    </span>)}
  </span>;
}
