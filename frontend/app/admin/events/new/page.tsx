"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import EventForm from "@/components/EventForm";
import { api } from "@/lib/api";

export default function NewEventPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin" className="text-sm text-muted hover:text-ink">← Your events</Link>
      <h1 className="mt-8 font-display text-4xl">New event</h1>
      <p className="mt-2 text-muted">Attendees can RSVP as soon as you publish it.</p>

      <div className="mt-10">
        <EventForm
          submitLabel="Publish event"
          onCancel={() => router.push("/admin")}
          onSubmit={async (input) => {
            const created = await api.createEvent(input);
            router.push(`/admin/events/${created.id}?created=1`);
          }}
        />
      </div>
    </div>
  );
}
