"use client";

import Link from "next/link";
import EventCard from "@/components/EventCard";
import { LoadError, Skeleton } from "@/components/ui";
import { api, useResource } from "@/lib/api";

export default function HomePage() {
  const { data: events, error, reload } = useResource(api.listEvents);

  return (
    <>
      {error ? (
        <LoadError error={error} what="events" onRetry={reload} />
      ) : !events ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="mb-px h-32" />)
      ) : events.length === 0 ? (
        <div className="border-t border-line py-20 text-center">
          <p className="font-display text-3xl">Nothing on the calendar yet.</p>
          <Link href="/admin/events/new" className="mt-4 inline-block text-sm underline underline-offset-4">
            Create one in the organizer area
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
