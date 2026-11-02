# Event RSVP & Booking

Organizers create events with limited seats. Attendees RSVP; once an event is full they join a waitlist and are promoted automatically when a seat frees up.

- `frontend/`: Next.js, TypeScript, Tailwind CSS
- `backend/`: Express, Prisma, PostgreSQL, Zod

## Setup

Requires Node.js 22.9+ and PostgreSQL. To use Docker instead of a local install, run `npm run db:up` (PostgreSQL on port 5436).

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
npm run install:all
npm run db:deploy
npm run dev          # web: http://localhost:3001  api: http://localhost:4000
```

| Command | Purpose |
| --- | --- |
| `npm test` | Backend tests (runs against `TEST_DATABASE_URL`, which is wiped on every run) |
| `npm run build` | Builds the backend and the frontend |
| `npm run db:migrate` | Creates and applies migrations during development |
| `npm run db:generate` | Generates the Prisma client |

## API

| Endpoint | Description |
| --- | --- |
| `GET/POST /api/events` | List upcoming events, or create one |
| `GET/PATCH/DELETE /api/events/:id` | Read, update or delete an event |
| `POST /api/events/:id/rsvps` | Register (returns CONFIRMED or WAITLISTED) |
| `GET /api/events/:id/rsvps?status=` | List RSVPs, optionally filtered by status |
| `GET /api/events/:id/rsvps.csv` | Export RSVPs as CSV |
| `PATCH /api/rsvps/:id/cancel` | Cancel an RSVP; promotes the next person on the waitlist |

## Booking safety

Every seat-changing operation runs in one transaction that first locks the event row (`SELECT ... FOR UPDATE`). Concurrent requests for the same event are processed one at a time, so confirmed RSVPs can never exceed capacity. A unique `(eventId, email)` constraint blocks duplicate registrations.

## Security note

Organizer pages and endpoints have no authentication yet. Add it before deploying publicly.
