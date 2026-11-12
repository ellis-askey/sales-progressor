import Anthropic from "@anthropic-ai/sdk";
import { aiEnabled, AiDisabledError } from "@/lib/ai/enabled";

const realClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// AI master switch (#291): a Proxy that routes EVERY `anthropic.messages.create`
// through the global switch, so every direct user (content studio, prospect
// research, file summary, memo parse, the outreach ClaudeProvider, callClaude,
// etc.) short-circuits in one place when AI is off — no model call is made and
// callers catch AiDisabledError to fall back to code/manual. Non-create access
// (and any other method) passes straight through.
export const anthropic = new Proxy(realClient, {
  get(target, prop, receiver) {
    if (prop !== "messages") return Reflect.get(target, prop, receiver);
    const messages = Reflect.get(target, prop, receiver);
    return new Proxy(messages, {
      get(mTarget, mProp, mRecv) {
        if (mProp !== "create") return Reflect.get(mTarget, mProp, mRecv);
        return async (...args: unknown[]) => {
          if (!(await aiEnabled())) throw new AiDisabledError();
          return (mTarget.create as (...a: unknown[]) => unknown)(...args);
        };
      },
    });
  },
});

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 512
): Promise<string> {
  // Fast-fail at the shared helper too (clearer than letting the Proxy throw
  // mid-request); the Proxy above is the catch-all for direct client users.
  if (!(await aiEnabled())) throw new AiDisabledError();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text.trim();
}
