"use client";

// Browser-side fetch helpers for the Boardwalk Forms API. Thin and typed —
// every call returns parsed JSON or throws an Error with the server's message.

export class FormsApiError extends Error {
  status: number;
  failures?: { questionId: string; message: string }[];
  constructor(message: string, status: number, failures?: { questionId: string; message: string }[]) {
    super(message);
    this.status = status;
    this.failures = failures;
  }
}

export async function formsApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // non-JSON (e.g. 500 HTML) — fall through to generic error
  }
  if (!res.ok) {
    throw new FormsApiError(
      (body.error as string) || "Something went wrong. Try again.",
      res.status,
      body.failures as FormsApiError["failures"]
    );
  }
  return body as T;
}
