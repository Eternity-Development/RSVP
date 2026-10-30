import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-baseline justify-between px-4 py-5 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          rsvp<span className="text-accent">.</span>
        </Link>
        <nav className="flex gap-6 text-sm">
          <Link href="/" className="hover:text-accent">Events</Link>
          <Link href="/admin/events/new" className="hover:text-accent">New event</Link>
        </nav>
      </div>
    </header>
  );
}
