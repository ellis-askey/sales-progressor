// Entry file for eslint-plugin-local-rules. The plugin walks up from cwd
// looking for this filename and consumes the exported map as rules under
// the `local-rules/` namespace. Keep this in sync with .eslintrc.js — add
// every rule defined in /eslint-rules/ here so it's actually registered.

module.exports = {
  "no-admin-audit-mutation": require("./eslint-rules/no-admin-audit-mutation"),
  "no-command-import-outside": require("./eslint-rules/no-command-import-outside"),
  "no-naive-name-split": require("./eslint-rules/no-naive-name-split"),
};
