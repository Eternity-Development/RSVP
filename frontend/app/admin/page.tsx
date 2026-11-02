"use client";

import Link from "next/link";
import { LoadError, Skeleton, button } from "@/components/ui";
import { api, formatDate, useResource } from "@/lib/api";

export default function OrganizerPage() {
  const { data: events, error, reload } = useResource(api.listEvents);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Your events</h1>
          <p className="mt-2 text-muted">Create an event, share its public page, then track RSVPs here.</p>
        </div>
        <Link href="/admin/events/new" className={button}>+ New event</Link>
      </header>

      {error ? (
        <LoadError error={error} what="events" onRetry={reload} />
      ) : !events ? (
        <Skeleton className="h-40" />
      ) : events.length === 0 ? (
        <div className="border-y border-line py-16 text-center">
          <p className="font-display text-3xl">No events yet.</p>
          <Link href="/admin/events/new" className="mt-4 inline-block text-sm underline underline-offset-4">
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[15px]">
            <thead className="text-xs uppercase tracking-[0.15em] text-muted">
              <tr>
                <th className="py-3 pr-4 font-medium">Event</th>
                <th className="py-3 pr-4 font-medium">Starts</th>
                <th className="py-3 pr-4 font-medium">Confirmed</th>
                <th className="py-3 pr-4 font-medium">Waitlist</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-y border-line">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="py-3 pr-4 font-medium">{e.title}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-muted">{formatDate(e.startsAt)}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {e.confirmedCount} / {e.capacity}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{e.waitlistCount}</td>
                  <td className="py-3 text-right">
                    <Link href={`/admin/events/${e.id}`} className="font-medium underline-offset-4 hover:underline">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
