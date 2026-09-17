// Jest stand-in for the "server-only" package. The real package throws on
// import outside a React Server Components build (that's its entire job), and
// Next.js aliases it away at build time — so under jest we map it to this
// empty module instead (see moduleNameMapper in jest.config.ts). Server-only
// code under test still runs; the poison-pill import just becomes inert.
module.exports = {};
