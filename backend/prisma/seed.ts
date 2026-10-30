import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const day = 24 * 60 * 60 * 1000;

async function main() {
  await prisma.event.deleteMany({ where: { title: { startsWith: "[Sample]" } } });

  const workshop = await prisma.event.create({
    data: {
      title: "[Sample] TypeScript Workshop",
      description: "Hands-on session covering generics, narrowing and strict mode.",
      location: "Room 204, Tech Hub, Bengaluru",
      startsAt: new Date(Date.now() + 7 * day),
      capacity: 3,
    },
  });
  await prisma.event.create({
    data: {
      title: "[Sample] Product Demo Webinar",
      description: "Live walkthrough of the new release followed by Q&A.",
      location: "https://meet.example.com/product-demo",
      startsAt: new Date(Date.now() + 14 * day),
      capacity: 50,
    },
  });
  await prisma.event.create({
    data: {
      title: "[Sample] Past Meetup (hidden from listing)",
      description: "Already happened, so it should not appear on the homepage.",
      location: "Community Hall",
      startsAt: new Date(Date.now() - 3 * day),
      capacity: 20,
    },
  });

  // Fill the workshop and put one person on the waitlist. Sequential inserts keep queue order.
  const people = [
    ["Asha Rao", "asha@example.com", "CONFIRMED"],
    ["Vikram Singh", "vikram@example.com", "CONFIRMED"],
    ["Meera Iyer", "meera@example.com", "CONFIRMED"],
    ["Rohan Das", "rohan@example.com", "WAITLISTED"],
  ] as const;
  for (const [name, email, status] of people) {
    await prisma.rsvp.create({ data: { eventId: workshop.id, name, email, status } });
  }

  console.log("Seeded 3 sample events (1 full with a waitlist, 1 open, 1 in the past).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
