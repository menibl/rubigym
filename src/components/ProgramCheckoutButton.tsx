import React from 'react';

export const ProgramCheckoutButton = ({ kind, onCheckout }: {
  kind: 'workout' | 'nutrition';
  onCheckout: () => void;
}) => <button
  type="button"
  onClick={onCheckout}
  className="min-h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm py-2.5 px-6 rounded-lg shadow-sm transition"
>
  {kind === 'workout' ? 'לתשלום עבור תוכנית אימון אישית' : 'לתשלום עבור תוכנית תזונה'}
</button>;
