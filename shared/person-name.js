// Preserve the existing full-name data format; never invent a customer's surname.
export function splitPersonName(value) {
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

export function hasFullPersonName(value) {
  const { firstName, lastName } = splitPersonName(value);
  return /\p{L}/u.test(firstName) && /\p{L}/u.test(lastName);
}
