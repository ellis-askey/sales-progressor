/**
 * ESLint rule: no-command-import-outside
 *
 * Prevents importing from lib/command/* or app/command/* outside those directories.
 * Command centre internals must not bleed into the main app surface.
 */

"use strict";

const COMMAND_PATTERN = /(?:^|\/)(?:lib|app)\/command\//;

// Sanctioned event-log write bridge. The Command Centre's analytics pipeline
// needs `recordEvent()` callable from anywhere a domain mutation happens
// (auth, transactions, milestones, etc.). This is the ONE documented exception
// to the no-cross-import boundary — every other lib/command/* import from
// outside the command centre remains forbidden.
const ALLOWLISTED_IMPORTS = new Set([
  "@/lib/command/events/write",
]);

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing lib/command/* or app/command/* from outside the command centre",
    },
    messages: {
      noCommandImport:
        "Importing from the command centre (lib/command/ or app/command/) is not allowed outside those directories.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.getFilename().replace(/\\/g, "/");
    const isInsideCommand = COMMAND_PATTERN.test(filename);

    if (isInsideCommand) return {};

    return {
      ImportDeclaration(node) {
        if (ALLOWLISTED_IMPORTS.has(node.source.value)) return;
        if (COMMAND_PATTERN.test(node.source.value)) {
          context.report({ node, messageId: "noCommandImport" });
        }
      },
    };
  },
};
