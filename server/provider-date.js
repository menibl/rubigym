// WCF DateTime values are UTC epoch milliseconds. A trailing +HHmm/-HHmm
// denotes DateTimeKind.Local, NOT a second offset to apply to the epoch value.
// DateTimeOffset.DateTime is also serialized in GMT. Never use host timezone
// parsing or guess the meaning of a timezone-less provider timestamp.
export function providerDateFormat(value) {
  if (value === null || value === undefined || value === '') return 'MISSING';
  if (typeof value === 'object') return value && Object.hasOwn(value, 'DateTime') ? 'WCF_OFFSET_OBJECT' : 'UNSUPPORTED_OBJECT';
  if (typeof value !== 'string') return 'UNSUPPORTED_TYPE';
  const text = value.trim();
  if (/^\/Date\(/.test(text)) return 'WCF_DATE';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return 'DATE_ONLY';
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? 'ISO_OFFSET' : 'ISO_WITHOUT_ZONE';
  return 'UNSUPPORTED_STRING';
}

export function providerTimestamp(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (typeof value.DateTime !== 'string' || !Number.isInteger(value.OffsetMinutes) || Math.abs(value.OffsetMinutes) > 840) return null;
    return providerTimestamp(value.DateTime);
  }
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const wcf = text.match(/^\/Date\((-?\d{1,16})(?:([+-])(\d{2})(\d{2}))?\)\/$/);
  if (wcf) {
    if (wcf[2] && (Number(wcf[3]) > 23 || Number(wcf[4]) > 59)) return null;
    const milliseconds = Number(wcf[1]);
    if (!Number.isSafeInteger(milliseconds)) return null;
    const date = new Date(milliseconds);
    return Number.isFinite(date.getTime()) && date.getUTCFullYear() >= 1 && date.getUTCFullYear() <= 9999 ? date : null;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,7}))?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!iso) return null;
  const [, y, m, d, hh, mm, ss, fraction, zone, sign, oh, om] = iso;
  const [year, month, day, hour, minute, second] = [y, m, d, hh, mm, ss].map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59
    || (zone !== 'Z' && (Number(oh) > 14 || Number(om) > 59 || (Number(oh) === 14 && Number(om) !== 0)))) return null;
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, second, Number((fraction || '').padEnd(3, '0').slice(0, 3)));
  if (wall.getUTCFullYear() !== year || wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day) return null;
  const offsetMinutes = zone === 'Z' ? 0 : (Number(oh) * 60 + Number(om)) * (sign === '-' ? -1 : 1);
  const instant = new Date(wall.getTime() - offsetMinutes * 60000);
  return Number.isFinite(instant.getTime()) ? instant : null;
}
