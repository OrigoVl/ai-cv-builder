// Thin wrapper around the official Anthropic SDK that turns "call this tool, get typed +
// zod-validated output" into one function. Structured output comes from *forced tool use*
// (tool_choice: {type: "tool", name}), not from asking the model to emit JSON prose — this means
// the SDK/API itself guarantees well-formed JSON; zod validation below is about whether the
// *shape* matches what we expect (the model can still get field types/structure wrong), and the
// grounding check (grounding.ts) is about whether the *content* is trustworthy. Those are three
// independent layers on purpose.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../core/logger.js";

/** Thrown for anything that means "this generation cannot succeed" — missing config, a model
 * refusal, output that still doesn't validate after one repair attempt. The caller (a job
 * handler) catches this, records it as the job's last_error, and retries the whole job per its
 * own backoff policy rather than retrying inside here indefinitely. */
export class LlmError extends Error {}

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new LlmError("ANTHROPIC_API_KEY is not configured");
  }
  // maxRetries covers transient network errors / 429 / 5xx with the SDK's own backoff — no need
  // to reimplement that here. timeout guards against a hung request past LLM_TIMEOUT_MS.
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: env.LLM_TIMEOUT_MS, maxRetries: 2 });
}

function toInputSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  // zod v4 ships JSON Schema generation natively — no need for the zod-to-json-schema package.
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  return jsonSchema as Anthropic.Tool.InputSchema;
}

function findToolUse(message: Anthropic.Message, name: string): Anthropic.ToolUseBlock | undefined {
  return message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === name);
}

export interface CallToolOptions<T> {
  model: string;
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

/**
 * Calls `toolName` with a forced tool_choice and validates the result against `schema`.
 * - If the model doesn't call the tool, or the input fails zod validation, we send ONE repair
 *   turn back with the validation errors (as a tool_result) and ask it to call the tool again.
 * - If `stop_reason` is "max_tokens", we retry once with double the token budget before giving up.
 * Throws LlmError if none of that recovers a valid result.
 */
export async function callStructuredTool<T>(opts: CallToolOptions<T>): Promise<T> {
  const client = getClient();
  const tool: Anthropic.Tool = {
    name: opts.toolName,
    description: opts.toolDescription,
    input_schema: toInputSchema(opts.schema),
  };
  const maxTokens = opts.maxTokens ?? 4096;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];

  async function request(tokens: number): Promise<Anthropic.Message> {
    return client.messages.create({
      model: opts.model,
      max_tokens: tokens,
      system: opts.system,
      messages,
      tools: [tool],
      tool_choice: { type: "tool", name: opts.toolName },
    });
  }

  let tokens = maxTokens;
  let response = await request(tokens);

  if (response.stop_reason === "max_tokens") {
    logger.warn({ tool: opts.toolName }, "LLM response hit max_tokens, retrying with a larger budget");
    tokens = maxTokens * 2;
    response = await request(tokens);
  }

  let toolUse = findToolUse(response, opts.toolName);
  if (!toolUse) {
    throw new LlmError(`Model did not call ${opts.toolName} (stop_reason: ${response.stop_reason})`);
  }

  let parsed = opts.schema.safeParse(toolUse.input);
  if (parsed.success) {
    logger.debug({ tool: opts.toolName, usage: response.usage }, "LLM structured call succeeded");
    return parsed.data;
  }

  // One repair attempt: show the model exactly what zod rejected and ask it to fix the SAME
  // tool call, via a proper tool_result turn (not just a fresh prompt) so the model sees it as
  // "your last call failed" rather than a brand-new request.
  logger.warn({ tool: opts.toolName, issues: parsed.error.issues }, "LLM output failed validation, repairing");
  messages.push(
    { role: "assistant", content: response.content },
    {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          is_error: true,
          content: `Your input did not match the required schema:\n${JSON.stringify(parsed.error.issues, null, 2)}\nPlease call ${opts.toolName} again with corrected input.`,
        },
      ],
    },
  );
  response = await request(tokens);
  toolUse = findToolUse(response, opts.toolName);
  if (!toolUse) {
    throw new LlmError(`Model did not call ${opts.toolName} on repair attempt (stop_reason: ${response.stop_reason})`);
  }
  parsed = opts.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new LlmError(`Model output still invalid after repair attempt: ${parsed.error.message}`);
  }
  logger.debug({ tool: opts.toolName, usage: response.usage }, "LLM structured call succeeded after repair");
  return parsed.data;
}
