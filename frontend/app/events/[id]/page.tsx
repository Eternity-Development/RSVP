"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback } from "react";
import RsvpForm from "@/components/RsvpForm";
import { LoadError, Skeleton } from "@/components/ui";
import { api, formatDate, isOnline, useResource } from "@/lib/api";

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const { data: event, error, reload } = useResource(useCallback(() => api.getEvent(id), [id]));

  if (error && !event) return <LoadError error={error} what="event" onRetry={reload} />;
  if (!event) return <Skeleton className="h-96" />;

  const started = new Date(event.startsAt).getTime() <= Date.now();
  const online = isOnline(event.location);
  const facts: [string, React.ReactNode][] = [
    ["Date", formatDate(event.startsAt, { dateStyle: "full" })],
    ["Time", formatDate(event.startsAt, { timeStyle: "short" })],
    [
      online ? "Online" : "Venue",
      online ? (
        <a href={event.location} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-accent">
          {event.location}
        </a>
      ) : (
        event.location
      ),
    ],
    ["Capacity", event.capacity],
    ["Confirmed", event.confirmedCount],
    ["Seats left", event.seatsRemaining],
    ["Waitlist", event.waitlistCount],
  ];

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <article>
        <Link href="/" className="text-sm text-muted hover:text-ink">← All events</Link>
        <p className={`mt-8 text-xs font-semibold uppercase tracking-[0.2em] ${event.isFull ? "text-accent" : "text-ok"}`}>
          {event.isFull ? "Full · waitlist open" : `${event.seatsRemaining} of ${event.capacity} seats left`}
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">{event.title}</h1>
        {event.description && <p className="mt-6 max-w-prose whitespace-pre-line text-[17px] leading-relaxed">{event.description}</p>}
        <dl className="mt-10 divide-y divide-line border-y border-line text-[15px]">
          {facts.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[7rem_1fr] gap-4 py-3">
              <dt className="text-muted">{label}</dt>
              <dd className="break-words tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </article>

      <aside className="h-fit border border-ink p-6 lg:sticky lg:top-8">
        <h2 className="font-display text-2xl">
          {started ? "Registration closed" : event.isFull ? "Join the waitlist" : "Reserve a seat"}
        </h2>
        <div className="mt-5">
          {started ? (
            <p className="text-sm text-muted">This event has already started.</p>
          ) : (
            <RsvpForm eventId={event.id} isFull={event.isFull} onChange={reload} />
          )}
        </div>
      </aside>
    </div>
  );
}
