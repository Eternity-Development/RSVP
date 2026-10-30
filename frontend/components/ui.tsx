"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toApiError, type ApiError, type RsvpStatus } from "@/lib/api";

export const input =
  "mt-1.5 block w-full rounded-sm border border-line bg-white px-3 py-2 text-[15px] font-normal outline-none transition focus:border-ink";
export const button =
  "inline-flex items-center justify-center rounded-sm bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-accent disabled:pointer-events-none disabled:opacity-50";
export const buttonOutline =
  "inline-flex items-center justify-center rounded-sm border border-line px-3.5 py-2 text-sm font-medium transition hover:border-ink disabled:opacity-50";

const statuses: Record<RsvpStatus, [string, string]> = {
  CONFIRMED: ["text-ok", "Confirmed"],
  WAITLISTED: ["text-warn", "Waitlisted"],
  CANCELLED: ["text-muted", "Cancelled"],
};

export function Status({ status }: { status: RsvpStatus }) {
  const [color, label] = statuses[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium">
        {label}
        {children}
      </label>
      {error && <p className="mt-1 text-sm text-accent">{error}</p>}
    </div>
  );
}

const tones = {
  success: "border-ok bg-ok/5",
  error: "border-accent bg-accent/5",
  warning: "border-warn bg-warn/5",
  info: "border-ink/30 bg-ink/[0.03]",
};

export function Notice({ tone, children, action }: { tone: keyof typeof tones; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex flex-wrap items-center justify-between gap-3 border-l-2 px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}
    >
      <div>{children}</div>
      {action}
    </div>
  );
}

export function LoadError({ error, what, onRetry }: { error: ApiError; what: string; onRetry: () => void }) {
  if (error.status === 404 || error.status === 400) {
    return (
      <div className="py-20 text-center">
        <p className="font-display text-3xl">That {what} doesn&apos;t exist.</p>
        <p className="mt-2 text-muted">It may have been deleted, or the link is wrong.</p>
        <Link href="/" className="mt-6 inline-block text-sm underline underline-offset-4">Back to all events</Link>
      </div>
    );
  }
  return (
    <Notice tone="error" action={<button onClick={onRetry} className="font-medium underline underline-offset-4">Try again</button>}>
      Couldn&apos;t load the {what}. {error.message}
    </Notice>
  );
}

export const Skeleton = ({ className }: { className: string }) => (
  <div aria-busy="true" className={`animate-pulse bg-line/40 ${className}`} />
);

type ConfirmOptions = { title: string; body: string; action: string };

export function useConfirm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const resolve = useRef<(ok: boolean) => void>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = (next: ConfirmOptions) => {
    setOptions(next);
    dialog.current?.showModal();
    return new Promise<boolean>((r) => (resolve.current = r));
  };
  const close = (ok: boolean) => {
    dialog.current?.close();
    resolve.current?.(ok);
    resolve.current = null;
  };

  const element = (
    <dialog
      ref={dialog}
      onCancel={() => close(false)}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-sm border border-ink bg-paper p-6 text-ink backdrop:bg-ink/40"
    >
      <h2 className="font-display text-2xl">{options?.title}</h2>
      <p className="mt-2 text-[15px] text-muted">{options?.body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={() => close(false)} className={buttonOutline}>Keep it</button>
        <button
          type="button"
          onClick={() => close(true)}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper transition hover:bg-ink"
        >
          {options?.action}
        </button>
      </div>
    </dialog>
  );

  return [confirm, element] as const;
}

export function useAction() {
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = async (task: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return { busy, error, run };
}
