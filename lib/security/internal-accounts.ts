/**
 * Shared filter fragments for excluding internal Sales Progressor accounts
 * (Ellis's logins + the Zero Progressor test agency) from product metrics,
 * detector queries, and the Founder Brief / Weekly Review aggregates.
 *
 * Use these in any Prisma `where` clause that aggregates "customer" activity.
 * Spread them into the existing where:
 *
 *   prisma.propertyTransaction.count({
 *     where: { createdAt: { gte: start, lt: end }, ...excludeInternalAgency },
 *   })
 */

/** Direct exclusion for queries on the Agency table itself. */
export const internalAgencyFilter = { isInternal: false } as const;

/** Direct exclusion for queries on the User table itself. */
export const internalUserFilter = { isInternal: false } as const;

/** Spread into a where on any model with an `agency` relation. */
export const excludeInternalAgency = {
  agency: { isInternal: false },
} as const;

/** Spread into a where on any model with a `user` relation. */
export const excludeInternalUser = {
  user: { isInternal: false },
} as const;

/** Spread into a where on any model whose `transaction` relation has an `agency`. */
export const excludeInternalViaTransaction = {
  transaction: { agency: { isInternal: false } },
} as const;
