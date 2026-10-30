"use client";

import Link from "next/link";
import EventCard from "@/components/EventCard";
import { LoadError, Skeleton } from "@/components/ui";
import { api, useResource } from "@/lib/api";

export default function HomePage() {
  const { data: events, error, reload } = useResource(api.listEvents);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2 pb-8">
        <h1 className="font-display text-4xl sm:text-5xl">Upcoming events</h1>
        {events && <p className="text-sm text-muted">{events.length} scheduled</p>}
      </div>

      {error ? (
        <LoadError error={error} what="events" onRetry={reload} />
      ) : !events ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="mb-px h-32" />)
      ) : events.length === 0 ? (
        <div className="border-t border-line py-20 text-center">
          <p className="font-display text-3xl">Nothing on the calendar yet.</p>
          <Link href="/admin/events/new" className="mt-4 inline-block text-sm underline underline-offset-4">
            Schedule the first event
          </Link>
        </div>
      ) : (
        <ul className="border-b border-line">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </ul>
      )}
    </>
  );
}
