-- AlterTable
ALTER TABLE "Rsvp" ALTER COLUMN "createdAt" SET DEFAULT clock_timestamp(),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6);
