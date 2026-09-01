/**
 * ESLint rule: no-naive-name-split
 *
 * Bans the pattern `<expr>.split(/\s+/)[0]` and `<expr>.split(" ")[0]` —
 * the naive "first whitespace token" extraction that fires the "Hi Mr,"
 * bug when a Contact.name like "Mr John Crowther" is split blindly.
 *
 * Use `extractFirstName` from `@/lib/contacts/displayName` instead — it
 * handles title prefixes (Mr/Mrs/Ms/Miss/Mx/Dr/Prof/Sir/Dame/Lord/Lady/Rev)
 * correctly.
 *
 * Catches both regular and optional-chaining forms:
 *   foo.name.split(/\s+/)[0]
 *   foo.name?.split(/\s+/)[0]
 *   trimmed.split(" ")[0]
 *
 * Does NOT catch the safe pattern where the split result is stored and
 * processed (`const parts = name.split(/\s+/); const first = parts[0]`) —
 * almost all of those use cases in this codebase loop and filter titles.
 */

"use strict";

function isWhitespaceSplitArg(arg) {
  if (!arg) return false;
  if (arg.type === "Literal" && arg.regex && arg.regex.pattern === "\\s+") return true;
  // Only a SPACE literal is a naive name split (`.split(" ")[0]`). Newline/tab
  // literals (`.split("\n")[0]`) are line/field splits, never name splits — do
  // not flag them.
  if (arg.type === "Literal" && typeof arg.value === "string" && /^ +$/.test(arg.value)) return true;
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow naive first-token-of-name extraction. Names entered with a title prefix (e.g. 'Mr John Crowther') yield the title rather than the first name.",
    },
    messages: {
      naiveSplit:
        "Naive name split: this returns the title (e.g. 'Mr') when the name starts with one. Use extractFirstName(name) from @/lib/contacts/displayName instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (!node.computed) return;
        if (node.property.type !== "Literal" || node.property.value !== 0) return;
        const obj = node.object;
        if (!obj || obj.type !== "CallExpression") return;
        const callee = obj.callee;
        if (!callee || callee.type !== "MemberExpression") return;
        if (callee.property?.name !== "split") return;
        if (!isWhitespaceSplitArg(obj.arguments?.[0])) return;
        context.report({ node, messageId: "naiveSplit" });
      },
    };
  },
};
