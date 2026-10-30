import { app } from "./app";
import { prisma } from "./lib/prisma";

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
