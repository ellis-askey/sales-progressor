/**
 * Compliance regression test — ADMIN_10 non-negotiable #2.
 *
 * Asserts that PostHog's SDK methods (init, capture, identify) are NEVER called
 * before the user gives analytics consent.
 *
 * Each test re-imports the module fresh via jest.isolateModules() so the module-level
 * _initialized flag starts at false, simulating a clean page load with no consent.
 */

// Top-level mock must be declared before any imports that touch posthog-js.
// The factory is used every time the module is re-resolved (including in isolateModules).
const mockPHInit = jest.fn();
const mockPHCapture = jest.fn();
const mockPHIdentify = jest.fn();
const mockPHReset = jest.fn();

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: {
    init: mockPHInit,
    capture: mockPHCapture,
    identify: mockPHIdentify,
    reset: mockPHReset,
  },
}));

// Set the key so init() doesn't exit early on missing key
process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test_key_for_jest";

// Helpers that re-import the wrapper fresh each time (resets _initialized = false)
function freshModule() {
  let mod: typeof import("@/lib/analytics/posthog");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("@/lib/analytics/posthog");
  });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Pre-consent: all SDK calls must be no-ops ─────────────────────────────────

test("does NOT call posthog.init when consent = false", () => {
  const { init } = freshModule();
  init(false);
  expect(mockPHInit).not.toHaveBeenCalled();
});

test("does NOT call posthog.init when called with no argument (undefined)", () => {
  const { init } = freshModule();
  // @ts-expect-error intentional: simulates missing consent flag
  init(undefined);
  expect(mockPHInit).not.toHaveBeenCalled();
});

test("does NOT capture events before init (no consent given)", () => {
  const { track } = freshModule();
  track("funnel.add_solicitor.started", { agencyId: "agency-123" });
  expect(mockPHCapture).not.toHaveBeenCalled();
});

test("does NOT identify before init (no consent given)", () => {
  const { identify } = freshModule();
  identify("user-456", { agencyId: "agency-123", userRole: "admin" });
  expect(mockPHIdentify).not.toHaveBeenCalled();
});

test("does NOT call posthog.reset before init", () => {
  const { reset } = freshModule();
  reset();
  expect(mockPHReset).not.toHaveBeenCalled();
});

// ── Post-consent: SDK initialises correctly ───────────────────────────────────

test("calls posthog.init with EU endpoint when consent = true", () => {
  const { init } = freshModule();
  init(true);
  expect(mockPHInit).toHaveBeenCalledTimes(1);
  expect(mockPHInit).toHaveBeenCalledWith(
    "phc_test_key_for_jest",
    expect.objectContaining({ api_host: "https://eu.i.posthog.com" })
  );
});

test("calls posthog.init with disable_session_recording: true", () => {
  const { init } = freshModule();
  init(true);
  expect(mockPHInit).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ disable_session_recording: true })
  );
});

test("does NOT call posthog.init a second time (idempotent)", () => {
  const { init } = freshModule();
  init(true);
  init(true); // second call
  expect(mockPHInit).toHaveBeenCalledTimes(1);
});

// ── Allow-list enforcement ────────────────────────────────────────────────────

test("drops events not in the allow-list (even after consent)", () => {
  const { init, track, _isInitialized } = freshModule();
  init(true);
  expect(_isInitialized()).toBe(true);
  track("unknown.event.not.in.allowlist", { agencyId: "agency-123" });
  expect(mockPHCapture).not.toHaveBeenCalled();
});

test("strips disallowed props from captured events", () => {
  const { init, track } = freshModule();
  init(true);
  track("funnel.add_solicitor.started", {
    agencyId: "agency-123",
    email: "sensitive@example.com",       // must be stripped
    propertyAddress: "123 Main St",        // must be stripped
    userRole: "admin",                     // must be kept
  });
  expect(mockPHCapture).toHaveBeenCalledWith(
    "funnel.add_solicitor.started",
    expect.not.objectContaining({ email: expect.anything() })
  );
  expect(mockPHCapture).toHaveBeenCalledWith(
    "funnel.add_solicitor.started",
    expect.not.objectContaining({ propertyAddress: expect.anything() })
  );
  expect(mockPHCapture).toHaveBeenCalledWith(
    "funnel.add_solicitor.started",
    expect.objectContaining({ agencyId: "agency-123", userRole: "admin" })
  );
});

// ── _initialized flag gate ─────────────────────────────────────────────────────

test("_isInitialized() returns false before init", () => {
  const { _isInitialized } = freshModule();
  expect(_isInitialized()).toBe(false);
});

test("_isInitialized() returns true after consent given", () => {
  const { init, _isInitialized } = freshModule();
  init(true);
  expect(_isInitialized()).toBe(true);
});

test("_isInitialized() resets to false after reset()", () => {
  const { init, reset, _isInitialized } = freshModule();
  init(true);
  expect(_isInitialized()).toBe(true);
  reset();
  expect(_isInitialized()).toBe(false);
});
