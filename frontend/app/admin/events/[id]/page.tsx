"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import EventForm from "@/components/EventForm";
import { LoadError, Notice, Skeleton, Status, buttonOutline, useAction, useConfirm } from "@/components/ui";
import { api, formatDate, useResource, type Rsvp, type RsvpStatus } from "@/lib/api";

const tabs: [RsvpStatus | undefined, string][] = [
  [undefined, "All"],
  ["CONFIRMED", "Confirmed"],
  ["WAITLISTED", "Waitlist"],
  ["CANCELLED", "Cancelled"],
];

export default function ManageEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<RsvpStatus>();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const [confirm, confirmDialog] = useConfirm();

  const event = useResource(useCallback(() => api.getEvent(id), [id]));
  const rsvps = useResource(useCallback(() => api.listRsvps(id, status), [id, status]));
  const refresh = () => Promise.all([event.reload(), rsvps.reload()]);

  const perform = (task: () => Promise<string | void>) =>
    action.run(async () => {
      setNotice(null);
      const message = await task();
      if (message) setNotice(message);
    });

  async function cancelRsvp(rsvp: Rsvp) {
    const ok = await confirm({
      title: `Cancel ${rsvp.name}'s RSVP?`,
      body: rsvp.status === "CONFIRMED" ? "Their seat goes to the first person on the waitlist." : "They'll be removed from the waitlist.",
      action: "Cancel RSVP",
    });
    if (!ok) return;
    perform(async () => {
      const { promoted } = await api.cancelRsvp(rsvp.id);
      await refresh();
      return promoted ? `Cancelled ${rsvp.name}. ${promoted.name} moved up from the waitlist.` : `Cancelled ${rsvp.name}.`;
    });
  }

  async function deleteEvent() {
    const current = event.data!;
    const ok = await confirm({
      title: "Delete this event?",
      body: `"${current.title}" and all of its RSVPs will be permanently removed. This can't be undone.`,
      action: "Delete event",
    });
    if (ok) perform(async () => {
      await api.deleteEvent(current.id);
      router.push("/");
    });
  }

  if (event.error && !event.data) return <LoadError error={event.error} what="event" onRetry={event.reload} />;
  if (!event.data) return <Skeleton className="h-96" />;
  const e = event.data;

  const stats: [string, number][] = [
    ["Capacity", e.capacity],
    ["Confirmed", e.confirmedCount],
    ["Seats left", e.seatsRemaining],
    ["Waitlist", e.waitlistCount],
  ];

  return (
    <div className="space-y-10">
      {confirmDialog}
      <p className="text-xs text-muted">
        Organizer tools aren&apos;t behind a login yet — add authentication before putting this online.
      </p>

      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Manage event</p>
          <h1 className="mt-2 font-display text-4xl leading-tight">{e.title}</h1>
          <p className="mt-2 break-words text-muted">
            {formatDate(e.startsAt, { dateStyle: "full", timeStyle: "short" })} · {e.location}
          </p>
          {e.description && <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed">{e.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/events/${e.id}`} className={buttonOutline}>Public page</Link>
          <button onClick={() => setEditing(!editing)} className={buttonOutline}>{editing ? "Close editor" : "Edit"}</button>
          <button onClick={deleteEvent} className={`${buttonOutline} text-accent`}>Delete</button>
        </div>
      </header>

      {action.error && <Notice tone="error">{action.error.message}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <dl className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="border-line py-5 sm:border-l sm:pl-6 sm:first:border-l-0 sm:first:pl-0">
            <dt className="text-xs uppercase tracking-[0.15em] text-muted">{label}</dt>
            <dd className="mt-1 font-display text-4xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {editing && (
        <section className="border border-ink p-6">
          <h2 className="mb-6 font-display text-2xl">Edit event</h2>
          <EventForm
            initial={e}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (input) => {
              const { promoted } = await api.updateEvent(e.id, input);
              setEditing(false);
              setNotice(
                promoted.length
                  ? `Saved. ${promoted.map((p) => p.name).join(", ")} moved up from the waitlist.`
                  : "Saved.",
              );
              await refresh();
            }}
          />
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink">
          <div role="tablist" className="flex gap-6">
            {tabs.map(([value, label]) => (
              <button
                key={label}
                role="tab"
                aria-selected={status === value}
                onClick={() => setStatus(value)}
                className={`-mb-px border-b-2 pb-2 text-sm font-medium ${
                  status === value ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
                {value === "WAITLISTED" && e.waitlistCount > 0 && <span className="ml-1.5 text-warn">{e.waitlistCount}</span>}
              </button>
            ))}
          </div>
          <button
            onClick={() => perform(() => api.downloadCsv(e.id, status))}
            className="mb-2 text-sm font-medium underline underline-offset-4 hover:text-accent"
          >
            Download CSV{status ? ` (${tabs.find(([v]) => v === status)![1].toLowerCase()})` : ""}
          </button>
        </div>

        {rsvps.error ? (
          <div className="pt-4">
            <LoadError error={rsvps.error} what="attendee list" onRetry={rsvps.reload} />
          </div>
        ) : !rsvps.data ? (
          <Skeleton className="mt-4 h-24" />
        ) : rsvps.data.length === 0 ? (
          <p className="py-12 text-center text-muted">{status ? "No RSVPs with this status." : "No one has RSVP'd yet."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-[15px]">
              <thead className="text-xs uppercase tracking-[0.15em] text-muted">
                <tr>
                  <th className="py-3 pr-4 font-medium">Name</th>
                  <th className="py-3 pr-4 font-medium">Email</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">RSVP time</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-line border-t border-line">
                {rsvps.data.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4 font-medium">{r.name}</td>
                    <td className="py-3 pr-4 text-muted">{r.email}</td>
                    <td className="whitespace-nowrap py-3 pr-4">
                      <Status status={r.status} />
                      {r.waitlistPosition && <span className="ml-2 text-sm tabular-nums text-muted">#{r.waitlistPosition}</span>}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 tabular-nums text-muted">{formatDate(r.createdAt)}</td>
                    <td className="py-3 text-right">
                      {r.status !== "CANCELLED" && (
                        <button
                          onClick={() => cancelRsvp(r)}
                          disabled={action.busy}
                          className="text-sm text-accent underline-offset-4 hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
