"use client";

import { useState } from "react";
import { z } from "zod";
import { api, type CreatedRsvp, type FieldErrors } from "@/lib/api";
import { Field, Notice, button, buttonOutline, input, useAction, useConfirm } from "./ui";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name must be at most 120 characters."),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
});

const empty = { name: "", email: "" };

export default function RsvpForm({ eventId, isFull, onChange }: { eventId: string; isFull: boolean; onChange: () => void }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [rsvp, setRsvp] = useState<CreatedRsvp | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const { busy, error, run } = useAction();
  const [confirm, confirmDialog] = useConfirm();

  const fieldError = (key: string) => (errors[key] ?? error?.fields?.[key])?.[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    setErrors(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors);
    if (parsed.success) {
      run(async () => {
        setRsvp(await api.createRsvp(eventId, parsed.data));
        onChange();
      });
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: "Cancel your RSVP?",
      body: "If you hold a seat, it goes to the next person on the waitlist.",
      action: "Cancel RSVP",
    });
    if (ok && rsvp) {
      run(async () => {
        await api.cancelRsvp(rsvp.id, rsvp.cancelToken);
        setCancelled(true);
        onChange();
      });
    }
  }

  if (rsvp) {
    return (
      <div className="space-y-4">
        {confirmDialog}
        {error && <Notice tone="error">{error.message}</Notice>}
        {cancelled ? (
          <Notice tone="info">Your RSVP is cancelled.</Notice>
        ) : rsvp.status === "CONFIRMED" ? (
          <Notice tone="success">
            <strong>You&apos;re in, {rsvp.name}.</strong> Your seat is confirmed under {rsvp.email}.
          </Notice>
        ) : (
          <Notice tone="warning">
            <strong>You&apos;re #{rsvp.waitlistPosition} on the waitlist.</strong> If someone cancels, you&apos;ll be moved
            up to confirmed automatically.
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          {!cancelled && (
            <button type="button" onClick={cancel} disabled={busy} className={`${buttonOutline} text-accent`}>
              {busy ? "Cancelling…" : "Cancel my RSVP"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setRsvp(null);
              setCancelled(false);
              setForm(empty);
            }}
            className={buttonOutline}
          >
            Register someone else
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {isFull && <p className="text-sm text-muted">Every seat is taken. Sign up and you&apos;ll get one automatically if someone cancels.</p>}
      {error && <Notice tone="error">{error.message}</Notice>}
      <Field label="Name" error={fieldError("name")}>
        <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
      </Field>
      <Field label="Email" error={fieldError("email")}>
        <input
          type="email"
          className={input}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          autoComplete="email"
        />
      </Field>
      <button disabled={busy} className={`${button} w-full`}>
        {busy ? "Sending…" : isFull ? "Join the waitlist" : "Reserve my seat"}
      </button>
    </form>
  );
}
