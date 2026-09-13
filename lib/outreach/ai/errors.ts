// Typed errors for the outreach AI layer. The orchestrator treats any of these
// as "fail safe": log it, surface it, send nothing.

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}

// The model returned something that isn't valid JSON, or doesn't match the
// expected schema, after the allowed retries. Carries the raw text for the audit.
export class AIValidationError extends Error {
  constructor(
    message: string,
    readonly provider: string,
    readonly rawText: string,
    readonly issues?: unknown,
  ) {
    super(message);
    this.name = "AIValidationError";
  }
}

export class AIMissingKeyError extends Error {
  constructor(readonly provider: string, envVar: string) {
    super(`${provider} is not configured: set ${envVar}.`);
    this.name = "AIMissingKeyError";
  }
}
