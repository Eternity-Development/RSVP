import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type RsvpStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED";
export type FieldErrors = Record<string, string[] | undefined>;

export interface EventSummary {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  capacity: number;
  createdAt: string;
  confirmedCount: number;
  waitlistCount: number;
  seatsRemaining: number;
  isFull: boolean;
}

export type EventInput = Pick<EventSummary, "title" | "description" | "location" | "startsAt" | "capacity">;

export interface Rsvp {
  id: string;
  eventId: string;
  name: string;
  email: string;
  status: RsvpStatus;
  createdAt: string;
  waitlistPosition: number | null;
}

export type CreatedRsvp = Rsvp & { cancelToken: string };
export type Attendee = Pick<Rsvp, "id" | "name" | "email">;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: FieldErrors,
  ) {
    super(message);
  }
}

export const toApiError = (err: unknown) =>
  err instanceof ApiError ? err : new ApiError(500, "Something went wrong. Please try again.");

async function send(path: string, init: RequestInit = {}) {
  const res = await fetch(API_URL + path, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
  }).catch(() => {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error?.message ?? `Request failed (${res.status}).`, body?.error?.fields);
  }
  return res;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => (await (await send(path, init)).json()).data;
const withBody = (method: string, data: unknown) => ({ method, body: JSON.stringify(data) });
const statusQuery = (status?: RsvpStatus) => (status ? `?status=${status}` : "");

export const api = {
  listEvents: () => request<EventSummary[]>("/api/events"),
  getEvent: (id: string) => request<EventSummary>(`/api/events/${id}`),
  createEvent: (input: EventInput) => request<EventSummary>("/api/events", withBody("POST", input)),
  updateEvent: (id: string, input: EventInput) =>
    request<{ event: EventSummary; promoted: Attendee[] }>(`/api/events/${id}`, withBody("PATCH", input)),
  deleteEvent: (id: string) => request<{ id: string }>(`/api/events/${id}`, { method: "DELETE" }),
  createRsvp: (eventId: string, input: { name: string; email: string }) =>
    request<CreatedRsvp>(`/api/events/${eventId}/rsvps`, withBody("POST", input)),
  listRsvps: (eventId: string, status?: RsvpStatus) => request<Rsvp[]>(`/api/events/${eventId}/rsvps${statusQuery(status)}`),
  cancelRsvp: (id: string, token?: string) =>
    request<{ rsvp: Rsvp; promoted: Attendee | null }>(`/api/rsvps/${id}/cancel`, withBody("PATCH", { token })),

  async downloadCsv(eventId: string, status?: RsvpStatus) {
    const res = await send(`/api/events/${eventId}/rsvps.csv${statusQuery(status)}`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(await res.blob());
    link.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "rsvps.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  },
};

export function useResource<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (err) {
      setError(toApiError(err));
    }
  }, [load]);

  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);

  return { data, error, reload };
}

export const formatDate = (iso: string, options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) =>
  new Date(iso).toLocaleString(undefined, options);

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export const isOnline = (location: string) => /^https?:\/\//i.test(location);
