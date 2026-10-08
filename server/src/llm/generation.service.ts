// The one place that decides "mock or real" and wires prompts + the Anthropic call + the
// grounding check together. Job handlers (jobs/handlers/*.ts) call these two functions and never
// touch client.ts, prompts.ts or grounding.ts directly.
import { env, useLlmMock } from "../config/env.js";
import { callStructuredTool } from "./client.js";
import { mockGenerateCv, mockUpdateSection } from "./mock.js";
import {
  GENERATION_SYSTEM_PROMPT,
  buildGenerationUserMessage,
  SECTION_UPDATE_SYSTEM_PROMPT,
  buildSectionUpdateUserMessage,
} from "./prompts.js";
import { GenerationResultSchema, sectionUpdateResultSchema } from "./generation.schemas.js";
import { checkGrounding, isValueGrounded, type GroundingOutcome } from "./grounding.js";

export async function generateCv(sourceText: string, targetRole: string): Promise<GroundingOutcome> {
  const raw = useLlmMock
    ? mockGenerateCv(sourceText, targetRole)
    : await callStructuredTool({
        model: env.ANTHROPIC_MODEL,
        system: GENERATION_SYSTEM_PROMPT,
        user: buildGenerationUserMessage(sourceText, targetRole),
        toolName: "submit_cv",
        toolDescription: "Submit the structured CV extracted from the source document, with evidence and open questions.",
        schema: GenerationResultSchema,
        maxTokens: 4096,
      });
  return checkGrounding(raw, sourceText);
}

export interface SectionUpdateOutcome {
  value: unknown;
  grounded: boolean;
}

/**
 * Regenerates a single field after the user answers a clarifying question. The answer is folded
 * into the trusted corpus (original source + every answer given so far on this CV) before the
 * grounding check, so a fact the user just supplied is allowed even though it wasn't in the
 * original document. If the model's new value isn't grounded even with the answer included,
 * `grounded: false` is returned and the caller (apply-answer job) falls back to using the raw
 * answer text as-is rather than discarding the user's input.
 */
export async function updateSection(opts: {
  fieldPath: string;
  currentValue: unknown;
  question: string;
  answer: string;
  sourceText: string;
  priorAnswers: string[];
}): Promise<SectionUpdateOutcome> {
  const raw = useLlmMock
    ? mockUpdateSection(opts.fieldPath, opts.currentValue, opts.answer)
    : await callStructuredTool({
        model: env.ANTHROPIC_MODEL_FAST,
        system: SECTION_UPDATE_SYSTEM_PROMPT,
        user: buildSectionUpdateUserMessage(opts),
        toolName: "update_section",
        toolDescription: "Submit the updated value for the single field named by field_path.",
        schema: sectionUpdateResultSchema(opts.fieldPath),
        maxTokens: 1024,
      });

  const corpusLower = [opts.sourceText, ...opts.priorAnswers, opts.answer].join("\n").toLowerCase();
  const grounded = isValueGrounded(raw.value, corpusLower);
  return { value: grounded ? raw.value : opts.answer, grounded };
}
