import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID keys must be set in env:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
function getWebPush() {
  const pub     = process.env.VAPID_PUBLIC_KEY;
  const priv    = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:inbox@thesalesprogressor.co.uk";

  if (!pub || !priv) return null;

  webpush.setVapidDetails(subject, pub, priv);
  return webpush;
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

// Returns how many of the contact's devices the notification actually reached.
// Callers that need "did this client get alerted?" (e.g. the feed-always,
// one-alert delivery rule in portal-messages.ts) read `delivered`: 0 means
// notifications aren't live for them right now — no subscription, VAPID not
// configured, or every subscription was stale — so the caller can fall back
// to email. Stale subscriptions (404/410) are pruned as before.
export async function pushToContact(
  contactId: string,
  payload: PushPayload
): Promise<{ delivered: number }> {
  const wp = getWebPush();
  if (!wp) return { delivered: 0 };

  const subs = await prisma.portalPushSubscription.findMany({
    where: { contactId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (subs.length === 0) return { delivered: 0 };

  const stale: string[] = [];
  let delivered = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        delivered += 1;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    })
  );

  if (stale.length > 0) {
    await prisma.portalPushSubscription.deleteMany({ where: { id: { in: stale } } });
  }

  return { delivered };
}

export async function pushToUser(userId: string, payload: PushPayload): Promise<void> {
  const wp = getWebPush();
  if (!wp) return;

  const subs = await prisma.agentPushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  const stale: string[] = [];
  const succeeded: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        succeeded.push(sub.id);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
      }
    })
  );

  if (stale.length > 0) {
    await prisma.agentPushSubscription.deleteMany({ where: { id: { in: stale } } });
  }
  if (succeeded.length > 0) {
    // Bumps the "last used" signal so the devices list in settings can show
    // "Last used 3 days ago" — helps users prune dead subscriptions.
    await prisma.agentPushSubscription.updateMany({
      where: { id: { in: succeeded } },
      data: { lastUsedAt: new Date() },
    });
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
