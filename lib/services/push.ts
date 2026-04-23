import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID keys must be set in env:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
function getWebPush() {
  const pub     = process.env.VAPID_PUBLIC_KEY;
  const priv    = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@thesalesprogressor.co.uk";

  if (!pub || !priv) return null;

  webpush.setVapidDetails(subject, pub, priv);
  return webpush;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export async function pushToContact(contactId: string, payload: PushPayload): Promise<void> {
  const wp = getWebPush();
  if (!wp) return;

  const subs = await prisma.portalPushSubscription.findMany({
    where: { contactId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    })
  );

  if (stale.length > 0) {
    await prisma.portalPushSubscription.deleteMany({ where: { id: { in: stale } } });
  }
}

export async function pushToTransaction(
  transactionId: string,
  payload: Omit<PushPayload, "url"> & { urlPath: string }
): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { propertyTransactionId: transactionId },
    select: { id: true, portalToken: true },
  });

  await Promise.allSettled(
    contacts.map((c) =>
      pushToContact(c.id, {
        ...payload,
        url: c.portalToken ? `/portal/${c.portalToken}${payload.urlPath}` : "/",
      })
    )
  );
}
