// callStructuredTool is the one place every real Anthropic call goes through — the retry/repair
// logic here is what the grounding checker and the rest of the pipeline assume already happened
// by the time they see a result. Previously only exercised via the LLM_MOCK path (generation.
// service.test.ts), which never touches this file at all. The Anthropic SDK itself is mocked
// (no network, no real key needed) so every branch — success, max_tokens retry, a refusal, a
// failed-validation repair that then succeeds, and a repair that still fails — can be driven
// directly and deterministically.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
}));

const { env } = await import("../config/env.js");
const { callStructuredTool, LlmError } = await import("./client.js");

const SCHEMA = z.object({ name: z.string(), age: z.number() });
const TOOL_NAME = "submit_thing";

function toolUseMessage(input: unknown, overrides: Partial<{ stop_reason: string; id: string }> = {}) {
  return {
    id: "msg_1",
    content: [{ type: "tool_use", id: overrides.id ?? "toolu_1", name: TOOL_NAME, input }],
    stop_reason: overrides.stop_reason ?? "tool_use",
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function refusalMessage(stop_reason = "end_turn") {
  return {
    id: "msg_1",
    content: [{ type: "text", text: "I can't help with that." }],
    stop_reason,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

describe("callStructuredTool", () => {
  const originalKey = env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    mockCreate.mockReset();
    env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  });

  afterEach(() => {
    env.ANTHROPIC_API_KEY = originalKey;
  });

  const baseOpts = {
    model: "claude-sonnet-5",
    system: "system prompt",
    user: "user prompt",
    toolName: TOOL_NAME,
    toolDescription: "submits a thing",
    schema: SCHEMA,
  };

  it("throws without calling the API at all when no key is configured", async () => {
    env.ANTHROPIC_API_KEY = undefined;
    await expect(callStructuredTool(baseOpts)).rejects.toThrow(LlmError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns the parsed tool input on a clean first response", async () => {
    mockCreate.mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: 30 }));
    const result = await callStructuredTool(baseOpts);
    expect(result).toEqual({ name: "Jane", age: 30 });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ tool_choice: { type: "tool", name: TOOL_NAME } }),
    );
  });

  it("retries once with double the token budget on stop_reason=max_tokens, then succeeds", async () => {
    mockCreate
      .mockResolvedValueOnce(toolUseMessage({ name: "cut off" }, { stop_reason: "max_tokens" }))
      .mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: 30 }));

    const result = await callStructuredTool({ ...baseOpts, maxTokens: 100 });
    expect(result).toEqual({ name: "Jane", age: 30 });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0]![0]).toMatchObject({ max_tokens: 100 });
    expect(mockCreate.mock.calls[1]![0]).toMatchObject({ max_tokens: 200 });
  });

  it("throws when the model never calls the tool (a refusal)", async () => {
    mockCreate.mockResolvedValueOnce(refusalMessage());
    await expect(callStructuredTool(baseOpts)).rejects.toThrow(/did not call submit_thing/);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("repairs once on invalid tool input, succeeding on the second attempt", async () => {
    mockCreate
      .mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: "thirty" })) // age should be a number
      .mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: 30 }));

    const result = await callStructuredTool(baseOpts);
    expect(result).toEqual({ name: "Jane", age: 30 });
    expect(mockCreate).toHaveBeenCalledTimes(2);

    // The repair turn must be a real tool_result reply, not just a fresh prompt — the model
    // needs to see this as "your last call failed", with the actual zod errors included.
    const repairCall = mockCreate.mock.calls[1]![0];
    expect(repairCall.messages).toHaveLength(3);
    expect(repairCall.messages[1]).toMatchObject({ role: "assistant" });
    expect(repairCall.messages[2]).toMatchObject({
      role: "user",
      content: [expect.objectContaining({ type: "tool_result", is_error: true, tool_use_id: "toolu_1" })],
    });
  });

  it("throws if the repair attempt is still invalid", async () => {
    mockCreate
      .mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: "thirty" }))
      .mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: "still not a number" }));

    await expect(callStructuredTool(baseOpts)).rejects.toThrow(/still invalid after repair/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("throws if the model doesn't call the tool on the repair attempt either", async () => {
    mockCreate.mockResolvedValueOnce(toolUseMessage({ name: "Jane", age: "thirty" })).mockResolvedValueOnce(refusalMessage());

    await expect(callStructuredTool(baseOpts)).rejects.toThrow(/on repair attempt/);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
