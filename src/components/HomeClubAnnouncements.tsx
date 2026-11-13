import React from 'react';
import type { Announcement } from '../types';

export function HomeClubAnnouncements({ announcements, onShowAll, expanded = false }: { announcements: Announcement[]; onShowAll: () => void; expanded?: boolean }) {
  if (!announcements.length) return null;
  const ordered = [...announcements].sort((a, b) => b.date.localeCompare(a.date));
  return <section className="home-section mb-6" dir="rtl" aria-label="הודעות המועדון">
    <h3>הודעות המועדון <button type="button" onClick={onShowAll}>{expanded ? 'הצג פחות' : `כל ההודעות (${ordered.length})`}</button></h3>
    <div className="home-announcements">{(expanded ? ordered : ordered.slice(0, 3)).map(announcement => <article key={announcement.id}>
      <div><span>{announcement.createdBy}</span><time dateTime={announcement.date}>{announcement.date}</time></div>
      <h4>{announcement.title}</h4><p className="whitespace-pre-wrap break-words">{announcement.content}</p>
    </article>)}</div>
  </section>;
}
