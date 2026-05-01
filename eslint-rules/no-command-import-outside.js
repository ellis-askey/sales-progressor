/**
 * ESLint rule: no-command-import-outside
 *
 * Prevents importing from lib/command/* or app/command/* outside those directories.
 * Command centre internals must not bleed into the main app surface.
 */

"use strict";

const COMMAND_PATTERN = /(?:^|\/)(?:lib|app)\/command\//;

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
        if (COMMAND_PATTERN.test(node.source.value)) {
          context.report({ node, messageId: "noCommandImport" });
        }
      },
    };
  },
};
