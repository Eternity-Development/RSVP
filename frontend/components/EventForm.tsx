"use client";

import { useState } from "react";
import { z } from "zod";
import { toLocalInput, type EventInput, type EventSummary, type FieldErrors } from "@/lib/api";
import { Field, Notice, button, buttonOutline, input, useAction } from "./ui";

const schema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  description: z.string().trim().max(5000, "Description must be at most 5000 characters."),
  location: z.string().trim().min(1, "Venue or meeting link is required.").max(500, "Location must be at most 500 characters."),
  startsAt: z
    .string()
    .min(1, "Pick a start date and time.")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Enter a valid date and time.")
    .transform((v) => new Date(v).toISOString()),
  capacity: z.coerce
    .number<string>({ error: "Capacity must be a number." })
    .int("Capacity must be a whole number.")
    .positive("Capacity must be at least 1.")
    .max(100_000, "Capacity must be at most 100,000."),
});

interface Props {
  initial?: EventSummary;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<void>;
  onCancel?: () => void;
}

export default function EventForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [values, setValues] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    location: initial?.location ?? "",
    startsAt: initial ? toLocalInput(initial.startsAt) : "",
    capacity: initial ? String(initial.capacity) : "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const { busy, error, run } = useAction();

  const bind = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [key]: e.target.value }),
    className: input,
  });
  const fieldError = (key: string) => (errors[key] ?? error?.fields?.[key])?.[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    setErrors(parsed.success ? {} : z.flattenError(parsed.error).fieldErrors);
    if (parsed.success) run(() => onSubmit(parsed.data));
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {error && <Notice tone="error">{error.message}</Notice>}
      <Field label="Title" error={fieldError("title")}>
        <input {...bind("title")} />
      </Field>
      <Field label="Description" error={fieldError("description")}>
        <textarea rows={4} {...bind("description")} />
      </Field>
      <Field label="Venue or online meeting link" error={fieldError("location")}>
        <input {...bind("location")} placeholder="Venue address, or a Zoom / Google Meet link" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Starts at" error={fieldError("startsAt")}>
          <input type="datetime-local" {...bind("startsAt")} />
        </Field>
        <Field label="Capacity" error={fieldError("capacity")}>
          <input type="number" min={1} step={1} {...bind("capacity")} />
        </Field>
      </div>
      <div className="flex gap-2 pt-2">
        <button disabled={busy} className={button}>{busy ? "Saving…" : submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className={buttonOutline}>Cancel</button>}
      </div>
    </form>
  );
}
