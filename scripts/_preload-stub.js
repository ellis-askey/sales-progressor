// Preload for running server modules under ts-node: neutralise the Next.js
// "server-only"/"client-only" import guards (they throw outside the bundler).
const Module = require("module");
const orig = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only" || request === "client-only") return {};
  return orig.apply(this, arguments);
};
