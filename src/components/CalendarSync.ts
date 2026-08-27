/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrainingSession } from '../types';

/**
 * Format date/time to ISO-like string required by Google Calendar (YYYYMMDDTHHmmSSZ)
 */
const formatToGoogleTime = (dateStr: string, timeStr: string, durationMinutes: number): { start: string; end: string } => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const start = new Date(dateStr);
  start.setHours(hours, minutes, 0);
  
  const end = new Date(start.getTime() + durationMinutes * 60000);
  
  const toGTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  return {
    start: toGTime(start),
    end: toGTime(end)
  };
};

/**
 * Generate a Google Calendar link for a training session
 */
export const getGoogleCalendarLink = (session: TrainingSession | { title: string; date: string; time: string; durationMinutes: number; coachName?: string }): string => {
  const { start, end } = formatToGoogleTime(session.date, session.time, session.durationMinutes);
  const title = session.title;
  const details = `מאמן אחראי: ${session.coachName || 'Open Gym'}\nאימון כושר במועדון BALLYWELLNESS`;
  const location = 'BALLYWELLNESS';
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`;
};

/**
 * Download an Apple Calendar / Outlook compatible .ics file for a training session
 */
export const downloadIcsFile = (session: TrainingSession | { id: string; title: string; date: string; time: string; durationMinutes: number; coachName?: string }): void => {
  const [hours, minutes] = session.time.split(':').map(Number);
  const start = new Date(session.date);
  start.setHours(hours, minutes, 0);
  const end = new Date(start.getTime() + session.durationMinutes * 60000);

  const formatIcsDate = (d: Date) => {
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  };

  const uuid = 'id' in session ? session.id : Math.random().toString(36).substring(2, 9);

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BALLYWELLNESS//Gym Event//HE',
    'BEGIN:VEVENT',
    `UID:${uuid}@ballywellness.com`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${session.title}`,
    `DESCRIPTION:מאמן אחראי: ${session.coachName || 'Open Gym'}\\nמערכת BALLYWELLNESS`,
    'LOCATION:BALLYWELLNESS',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${session.title.replace(/\s+/g, '_')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
