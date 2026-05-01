/**
 * ESLint rule: no-admin-audit-mutation
 *
 * Prevents direct prisma.adminAuditLog.update/delete/updateMany/deleteMany calls.
 * AdminAuditLog is append-only. All writes must go through recordAdminAction().
 */

"use strict";

const BLOCKED_METHODS = new Set(["update", "updateMany", "delete", "deleteMany"]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow mutation calls on prisma.adminAuditLog — it is append-only",
    },
    messages: {
      noMutation:
        "AdminAuditLog is append-only. Use recordAdminAction() to write; never update or delete.",
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          node.object?.type === "MemberExpression" &&
          node.object.property?.name === "adminAuditLog" &&
          BLOCKED_METHODS.has(node.property?.name)
        ) {
          context.report({ node, messageId: "noMutation" });
        }
      },
    };
  },
};
