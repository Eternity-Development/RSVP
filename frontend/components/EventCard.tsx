import Link from "next/link";
import { formatDate, isOnline, type EventSummary } from "@/lib/api";

export default function EventCard({ event }: { event: EventSummary }) {
  const booked = Math.min(100, (event.confirmedCount / event.capacity) * 100);

  return (
    <li className="grid gap-x-8 gap-y-4 border-t border-line py-7 sm:grid-cols-[4rem_1fr_12rem]">
      <time dateTime={event.startsAt} className="flex items-baseline gap-2 sm:block">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {formatDate(event.startsAt, { month: "short" })}
        </span>
        <span className="block font-display text-4xl leading-none">{formatDate(event.startsAt, { day: "numeric" })}</span>
      </time>

      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-snug">
          <Link href={`/events/${event.id}`} className="decoration-1 underline-offset-4 hover:underline">
            {event.title}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-muted">
          {formatDate(event.startsAt, { weekday: "long", hour: "numeric", minute: "2-digit" })} ·{" "}
          {isOnline(event.location) ? "Online" : event.location}
        </p>
        {event.description && <p className="mt-3 line-clamp-2 max-w-prose text-[15px] leading-relaxed">{event.description}</p>}
      </div>

      <div className="text-sm sm:text-right">
        <p className={`font-medium ${event.isFull ? "text-accent" : "text-ok"}`}>
          {event.isFull ? "Full · waitlist open" : `${event.seatsRemaining} ${event.seatsRemaining === 1 ? "seat" : "seats"} left`}
        </p>
        <div className="mt-2 h-1 bg-line">
          <div className="h-full bg-ink" style={{ width: `${booked}%` }} />
        </div>
        <p className="mt-1.5 tabular-nums text-muted">
          {event.confirmedCount} of {event.capacity} confirmed
        </p>
        <div className="mt-3 flex gap-4 sm:justify-end">
          <Link href={`/events/${event.id}`} className="font-medium underline-offset-4 hover:underline">
            {event.isFull ? "Join waitlist" : "Details"} →
          </Link>
          <Link href={`/admin/events/${event.id}`} className="text-muted hover:text-ink">Manage</Link>
        </div>
      </div>
    </li>
  );
}
