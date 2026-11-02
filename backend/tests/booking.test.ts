import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { bookingTransaction } from "../src/lib/booking";
import { Prisma } from "@prisma/client";
import { csvCell } from "../src/lib/csv";

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function createEvent(capacity: number, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/events")
    .send({ title: "Test event", location: "Hall A", startsAt: inDays(3).toISOString(), capacity, ...overrides });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

function rsvp(eventId: string, email: string, name = email.split("@")[0]) {
  return request(app).post(`/api/events/${eventId}/rsvps`).send({ name, email });
}

const statusCounts = async (eventId: string) => {
  const rows = await prisma.rsvp.groupBy({ by: ["status"], where: { eventId }, _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
};

beforeEach(async () => {
  await prisma.$executeRaw`TRUNCATE "Rsvp", "Event" CASCADE`;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("events", () => {
  it("creates an event and lists only upcoming ones in start order", async () => {
    const later = await createEvent(10, { title: "Later", startsAt: inDays(10).toISOString() });
    const sooner = await createEvent(10, { title: "Sooner", startsAt: inDays(1).toISOString() });
    await prisma.event.create({
      data: { title: "Past", location: "X", startsAt: inDays(-1), capacity: 5 },
    });

    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { id: string }) => e.id)).toEqual([sooner.id, later.id]);
    expect(res.body.data[0]).toMatchObject({ confirmedCount: 0, seatsRemaining: 10, isFull: false });
  });

  it("rejects invalid event input with field errors", async () => {
    const res = await request(app)
      .post("/api/events")
      .send({ title: "", location: " ", startsAt: "not-a-date", capacity: 0 });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["capacity", "location", "startsAt", "title"]);
  });

  it("returns 400 for malformed ids and 404 for unknown events", async () => {
    expect((await request(app).get("/api/events/abc")).status).toBe(400);
    expect((await request(app).get("/api/events/00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });

  it("edits and deletes an event, cascading its RSVPs", async () => {
    const event = await createEvent(2);
    await rsvp(event.id, "a@x.com");

    const edit = await request(app).patch(`/api/events/${event.id}`).send({ title: "Renamed" });
    expect(edit.status).toBe(200);
    expect(edit.body.data.event.title).toBe("Renamed");

    expect((await request(app).delete(`/api/events/${event.id}`)).status).toBe(200);
    expect((await request(app).get(`/api/events/${event.id}`)).status).toBe(404);
    expect(await prisma.rsvp.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("RSVP creation", () => {
  it("confirms while seats remain, then waitlists", async () => {
    const event = await createEvent(2);
    const results = [];
    for (const email of ["a@x.com", "b@x.com", "c@x.com"]) results.push((await rsvp(event.id, email)).body.data);

    expect(results.map((r) => r.status)).toEqual(["CONFIRMED", "CONFIRMED", "WAITLISTED"]);
    expect(results[2].waitlistPosition).toBe(1);
  });

  it("normalises email and blocks duplicates for the same event", async () => {
    const event = await createEvent(5);
    const first = await rsvp(event.id, "  Alice@Example.COM ");
    expect(first.status).toBe(201);
    expect(first.body.data.email).toBe("alice@example.com");

    const dup = await rsvp(event.id, "alice@example.com");
    expect(dup.status).toBe(409);
    expect(dup.body.error.message).toMatch(/already registered/);
  });

  it("allows the same email on a different event", async () => {
    const one = await createEvent(5);
    const two = await createEvent(5);
    expect((await rsvp(one.id, "same@x.com")).status).toBe(201);
    expect((await rsvp(two.id, "same@x.com")).status).toBe(201);
  });

  it("validates name and email", async () => {
    const event = await createEvent(5);
    const res = await request(app).post(`/api/events/${event.id}/rsvps`).send({ name: " ", email: "nope" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(["email", "name"]);
  });

  it("rejects RSVPs for events that have already started", async () => {
    const past = await prisma.event.create({
      data: { title: "Past", location: "X", startsAt: inDays(-1), capacity: 5 },
    });
    expect((await rsvp(past.id, "a@x.com")).status).toBe(409);
  });
});

describe("concurrency", () => {
  it("never confirms more RSVPs than capacity under simultaneous requests", async () => {
    const event = await createEvent(5);
    const responses = await Promise.all(Array.from({ length: 40 }, (_, i) => rsvp(event.id, `user${i}@x.com`)));

    expect(responses.every((r) => r.status === 201)).toBe(true);
    expect(await statusCounts(event.id)).toEqual({ CONFIRMED: 5, WAITLISTED: 35 });

    // Waitlist positions handed out must be 1..35 with no gaps or repeats.
    const positions = responses.map((r) => r.body.data.waitlistPosition).filter((p) => p !== null);
    expect(positions.sort((a, b) => a - b)).toEqual(Array.from({ length: 35 }, (_, i) => i + 1));
  });

  it("accepts exactly one of several simultaneous duplicate registrations", async () => {
    const event = await createEvent(5);
    const responses = await Promise.all(Array.from({ length: 10 }, () => rsvp(event.id, "dup@x.com")));
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(9);
  });

  it("promotes only one waitlisted attendee when the same RSVP is cancelled concurrently", async () => {
    const event = await createEvent(1);
    const confirmed = (await rsvp(event.id, "a@x.com")).body.data;
    await rsvp(event.id, "b@x.com");
    await rsvp(event.id, "c@x.com");

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).patch(`/api/rsvps/${confirmed.id}/cancel`)),
    );
    expect(responses.filter((r) => r.status === 200)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await statusCounts(event.id)).toEqual({ CONFIRMED: 1, WAITLISTED: 1, CANCELLED: 1 });
  });

  it("keeps confirmed count within capacity when cancellations and new RSVPs race", async () => {
    const event = await createEvent(3);
    const initial = [];
    for (let i = 0; i < 6; i++) initial.push((await rsvp(event.id, `p${i}@x.com`)).body.data);

    await Promise.all([
      ...initial.slice(0, 3).map((r) => request(app).patch(`/api/rsvps/${r.id}/cancel`)),
      ...Array.from({ length: 10 }, (_, i) => rsvp(event.id, `new${i}@x.com`)),
    ]);

    const counts = await statusCounts(event.id);
    expect(counts.CONFIRMED).toBe(3);
    expect(counts.CANCELLED).toBe(3);
    expect(counts.WAITLISTED).toBe(10);
  });
});

describe("cancellation and waitlist promotion", () => {
  async function fullEventWithWaitlist() {
    const event = await createEvent(2);
    const people = [];
    for (const email of ["c1@x.com", "c2@x.com", "w1@x.com", "w2@x.com"]) {
      people.push((await rsvp(event.id, email)).body.data);
    }
    return { event, people };
  }

  it("cancelling a CONFIRMED RSVP promotes the oldest waitlisted attendee", async () => {
    const { event, people } = await fullEventWithWaitlist();
    const res = await request(app).patch(`/api/rsvps/${people[0].id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.rsvp.status).toBe("CANCELLED");
    expect(res.body.data.promoted.email).toBe("w1@x.com");
    expect(await statusCounts(event.id)).toEqual({ CONFIRMED: 2, WAITLISTED: 1, CANCELLED: 1 });
  });

  it("cancelling a WAITLISTED RSVP leaves confirmed attendees unchanged", async () => {
    const { event, people } = await fullEventWithWaitlist();
    const res = await request(app).patch(`/api/rsvps/${people[2].id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.data.promoted).toBeNull();
    expect(await statusCounts(event.id)).toEqual({ CONFIRMED: 2, WAITLISTED: 1, CANCELLED: 1 });
  });

  it("cancelling twice does not promote again", async () => {
    const { event, people } = await fullEventWithWaitlist();
    await request(app).patch(`/api/rsvps/${people[0].id}/cancel`);
    const again = await request(app).patch(`/api/rsvps/${people[0].id}/cancel`);

    expect(again.status).toBe(409);
    expect(await statusCounts(event.id)).toEqual({ CONFIRMED: 2, WAITLISTED: 1, CANCELLED: 1 });
  });

  it("checks the cancellation token when one is supplied", async () => {
    const { people } = await fullEventWithWaitlist();
    const wrong = await request(app)
      .patch(`/api/rsvps/${people[0].id}/cancel`)
      .send({ token: people[1].cancelToken });
    expect(wrong.status).toBe(403);

    const right = await request(app)
      .patch(`/api/rsvps/${people[0].id}/cancel`)
      .send({ token: people[0].cancelToken });
    expect(right.status).toBe(200);
  });

  it("returns 404 for an unknown RSVP", async () => {
    const res = await request(app).patch("/api/rsvps/00000000-0000-0000-0000-000000000000/cancel");
    expect(res.status).toBe(404);
  });
});

describe("capacity changes", () => {
  it("increasing capacity promotes waitlisted attendees in queue order", async () => {
    const event = await createEvent(1);
    for (const email of ["c@x.com", "w1@x.com", "w2@x.com", "w3@x.com"]) await rsvp(event.id, email);

    const res = await request(app).patch(`/api/events/${event.id}`).send({ capacity: 3 });
    expect(res.status).toBe(200);
    expect(res.body.data.promoted.map((p: { email: string }) => p.email)).toEqual(["w1@x.com", "w2@x.com"]);
    expect(res.body.data.event).toMatchObject({ confirmedCount: 3, waitlistCount: 1, seatsRemaining: 0 });
  });

  it("refuses to reduce capacity below the confirmed count", async () => {
    const event = await createEvent(3);
    for (const email of ["a@x.com", "b@x.com"]) await rsvp(event.id, email);

    const tooLow = await request(app).patch(`/api/events/${event.id}`).send({ capacity: 1 });
    expect(tooLow.status).toBe(409);

    const ok = await request(app).patch(`/api/events/${event.id}`).send({ capacity: 2 });
    expect(ok.status).toBe(200);
  });
});

describe("listing and CSV export", () => {
  it("filters RSVPs by status, oldest first", async () => {
    const event = await createEvent(1);
    for (const email of ["a@x.com", "b@x.com", "c@x.com"]) await rsvp(event.id, email);

    const res = await request(app).get(`/api/events/${event.id}/rsvps?status=WAITLISTED`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r: { email: string }) => r.email)).toEqual(["b@x.com", "c@x.com"]);
    expect(res.body.data.map((r: { waitlistPosition: number }) => r.waitlistPosition)).toEqual([1, 2]);
    expect(res.body.data[0].cancelToken).toBeUndefined();

    expect((await request(app).get(`/api/events/${event.id}/rsvps?status=BOGUS`)).status).toBe(400);
  });

  it("exports a downloadable, escaped CSV", async () => {
    const event = await createEvent(1);
    await rsvp(event.id, "a@x.com", '=SUM(1,2) "quoted", name');
    await rsvp(event.id, "b@x.com", "Line\nbreak");

    const res = await request(app).get(`/api/events/${event.id}/rsvps.csv`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
    expect(res.headers["content-disposition"]).toMatch(/^attachment; filename=".+\.csv"$/);

    const lines = res.text.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe('"Name","Email","Status","RSVP Time"');
    expect(lines[1]).toMatch(/^"'=SUM\(1,2\) ""quoted"", name","a@x.com","CONFIRMED","\d{4}-/);
    expect(lines[2]).toMatch(/^"Line\nbreak","b@x.com","WAITLISTED",/);
  });

  it("neutralises spreadsheet formula prefixes", () => {
    for (const prefix of ["=", "+", "-", "@", "\t", "\r"]) expect(csvCell(`${prefix}1`)).toBe(`"'${prefix}1"`);
    expect(csvCell("plain")).toBe('"plain"');
  });
});

describe("transaction retries", () => {
  const dbError = (code: string, sqlState?: string) =>
    new Prisma.PrismaClientKnownRequestError("db error", {
      code,
      clientVersion: Prisma.prismaVersion.client,
      meta: sqlState ? { code: sqlState } : undefined,
    });

  it("retries after deadlock and serialization failures", async () => {
    for (const err of [dbError("P2034"), dbError("P2010", "40P01"), dbError("P2010", "40001")]) {
      let calls = 0;
      const result = await bookingTransaction(async () => {
        if (++calls === 1) throw err;
        return "done";
      });
      expect(result).toBe("done");
      expect(calls).toBe(2);
    }
  });

  it("gives up after the last attempt and does not retry other errors", async () => {
    let calls = 0;
    await expect(bookingTransaction(async () => { calls++; throw dbError("P2034"); })).rejects.toThrow();
    expect(calls).toBe(3);

    calls = 0;
    await expect(bookingTransaction(async () => { calls++; throw dbError("P2002"); })).rejects.toThrow();
    expect(calls).toBe(1);
  });
});
