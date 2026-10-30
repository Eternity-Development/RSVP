"use client";

import Link from "next/link";
import { useState } from "react";
import EventForm from "@/components/EventForm";
import { Notice, button, buttonOutline } from "@/components/ui";
import { api, type EventSummary } from "@/lib/api";

export default function NewEventPage() {
  const [created, setCreated] = useState<EventSummary | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl">New event</h1>
      <p className="mt-2 text-muted">Attendees can RSVP as soon as you publish it.</p>

      <div className="mt-10">
        {created ? (
          <div className="space-y-5">
            <Notice tone="success">
              <strong>{created.title}</strong> is live with {created.capacity} {created.capacity === 1 ? "seat" : "seats"}.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/events/${created.id}`} className={button}>Manage event</Link>
              <Link href={`/events/${created.id}`} className={buttonOutline}>View public page</Link>
              <button onClick={() => setCreated(null)} className={buttonOutline}>Create another</button>
            </div>
          </div>
        ) : (
          <EventForm submitLabel="Publish event" onSubmit={async (input) => setCreated(await api.createEvent(input))} />
        )}
      </div>
    </div>
  );
}
