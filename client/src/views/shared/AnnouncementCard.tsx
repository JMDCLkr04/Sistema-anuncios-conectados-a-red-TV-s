import type { ReactNode } from 'react';

import type { Announcement } from '../../models/domain';
import { PRIORITY_VIEW, STATUS_VIEW, formatDateTime, formatWindow } from '../../models';
import { PriorityBadge } from './PriorityBadge';

/**
 * VISTA: tarjeta de anuncio.
 *
 * - Los anuncios críticos se marcan con `role="alert"` para que un lector de
 *   pantalla los anuncie de inmediato (WCAG 4.1.3, 2.2.4 interruptor).
 * - Las fechas siempre van acompañadas de texto: "Vigencia: …" (3.1.1).
 */
export function AnnouncementCard({
  announcement,
  actions,
  compact = false,
}: {
  announcement: Announcement;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const view = PRIORITY_VIEW[announcement.priority];
  const isUrgent = view.isUrgent && announcement.status === 'published';

  return (
    <article
      className={view.cardClass}
      {...(isUrgent ? { role: 'alert' as const, 'aria-live': 'assertive' as const } : {})}
      aria-labelledby={`announcement-${announcement.id}-title`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <PriorityBadge priority={announcement.priority} />
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${STATUS_VIEW[announcement.status].className}`}
        >
          {STATUS_VIEW[announcement.status].label}
        </span>
        {announcement.allScreens ? (
          <span className="text-xs font-semibold text-slate-600">Todas las pantallas</span>
        ) : (
          <span className="text-xs font-semibold text-slate-600">
            {announcement.screenIds.length} pantalla(s) específica(s)
          </span>
        )}
      </div>

      <h3
        id={`announcement-${announcement.id}-title`}
        className={`mt-2 font-bold text-slate-900 ${compact ? 'text-lg' : 'text-xl'}`}
      >
        {announcement.title}
      </h3>

      <p className="mt-2 whitespace-pre-line text-slate-800">{announcement.body}</p>

      <dl className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold">Vigencia: </dt>
          <dd className="inline">{formatWindow(announcement.startsAt, announcement.endsAt)}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Publicado por: </dt>
          <dd className="inline">
            {announcement.createdByName ?? 'Sistema'} · {formatDateTime(announcement.createdAt)}
          </dd>
        </div>
      </dl>

      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
    </article>
  );
}
