import { prisma } from "../lib/prisma";
import { isContactEmailSuppressed } from "../lib/email";

(async () => {
  const r = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'Contact' AND column_name = 'unsubscribedAt'`,
  );
  console.log("Contact.unsubscribedAt column:", r);

  const n = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'Notification'`,
  );
  console.log("Notification table:", n);

  const test = await prisma.contact.findMany({ select: { id: true, unsubscribedAt: true }, take: 1 });
  console.log("Sample contact (unsubscribedAt readable):", test);

  if (test.length > 0) {
    const suppressed = await isContactEmailSuppressed(test[0].id);
    console.log(`isContactEmailSuppressed(${test[0].id}) →`, suppressed);
  }

  await prisma.$disconnect();
})();
