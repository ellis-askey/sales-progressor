/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ["next/core-web-vitals"],
  plugins: ["local-rules"],
  rules: {
    // Prevent mutating the append-only AdminAuditLog table directly via Prisma.
    // All writes must go through recordAdminAction() in lib/command/audit/write.ts.
    "local-rules/no-admin-audit-mutation": "error",

    // Prevent importing command centre internals from outside app/command or lib/command.
    "local-rules/no-command-import-outside": "warn",
  },
};
