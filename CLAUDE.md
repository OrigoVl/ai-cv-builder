# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Brightfolio — an AI CV builder. Upload a PDF or paste free text + a target role, an LLM drafts a
structured CV (contact/summary/experience/education/skills), anything it can't verify from the
source becomes a question back to the user, and the result can be edited by hand and downloaded
as a real A4 PDF. pnpm workspace: `server/` (Express REST API) + `client/` (React SPA). Full
design rationale, the anti-hallucination approach, and documented trade-offs are in `README.md` —
read it before making architectural changes.

## Commands

Run from the repo root unless noted. The workspace has two packages (`server`, `client`); most
root scripts just fan out to both via `pnpm --filter`.

```bash
pnpm install                    # once, from root
pnpm dev                        # server (tsx watch, :3000) + client (vite, :5173) concurrently
pnpm build                      # both apps
pnpm typecheck                  # both apps (tsc --noEmit)
pnpm test                       # both apps' vitest suites
pnpm test:server / test:client  # one app only
pnpm db:generate                # drizzle-kit generate — writes a new SQL file under server/drizzle/
pnpm db:migrate                 # applies committed migrations (also runs automatically on server boot)
```

Single test file (run from `server/` or `client/`, not root):

```bash
pnpm exec vitest run src/llm/grounding.test.ts
pnpm exec vitest run src/llm/grounding.test.ts -t "invented employer"   # by test name
```

E2E (Playwright, from root) — needs a running app, see below:

```bash
pnpm exec playwright test                                    # all specs, serialized (workers: 1 — see playwright.config.ts)
pnpm exec playwright test e2e/account-settings.spec.ts -g "delete"
```

Docker (the only way the task spec requires this to run):

```bash
cp .env.example .env            # set ANTHROPIC_API_KEY, or leave blank for mock mode
docker compose up --build
docker compose up -d --force-recreate app   # after editing .env — env vars are baked in at
                                             # container CREATE time, not re-read from a running container
```

If `docker build` fails with `error getting credentials`, this machine's Docker Desktop
credential helper is broken (unrelated to this repo) — strip `"credsStore"` from
`~/.docker/config.json`, build, then restore it.

## Architecture

### The job queue (no Redis/BullMQ)

Generation and "apply an answer" both run as rows in a plain `jobs` Postgres table
(`server/src/jobs/`), claimed with `FOR UPDATE SKIP LOCKED` (`queue.ts#claimNextJob`):

```sql
UPDATE jobs SET status='running', locked_until=now()+2min, attempts=attempts+1 ...
WHERE id = (SELECT id FROM jobs WHERE status='queued' OR (status='running' AND locked_until < now())
            ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
```

Re-claiming anything whose lock expired is what recovers a job a worker crashed mid-processing —
no heartbeat protocol. `worker.ts` runs `JOB_CONCURRENCY` polling lanes in the same process.
Creating a CV and enqueuing its `generate` job happens in one DB transaction
(`cv.service.ts#createCv`) so a crash between the two can't leave a CV stuck forever. The client
has no job state of its own — `useCv` just polls `GET /cvs/:id` (1.5s while `status=generating`,
5s afterwards — kept slow-polling even once ready because an `apply_answer` job can still bump
`version` asynchronously after a question is answered).

### The anti-hallucination pipeline (`server/src/llm/`)

Three independent layers, not one:

1. **Prompting** (`prompts.ts`) separates rephrasing (allowed) from inventing (never), and wraps
   untrusted source text in tagged blocks framed as data, not instructions.
2. **Forced structured output** (`client.ts#callStructuredTool`) — tool use with
   `tool_choice: {type: "tool", name}`, JSON Schema generated from the same zod schema everything
   else validates against (`z.toJSONSchema`, zod v4 native — no separate schema-conversion
   package). One repair turn (a `tool_result` with the zod errors) before giving up.
3. **`grounding.ts`** — the actual enforcement, independent of what the model was asked to do.
   Every hard-fact field (company, title, dates) must fuzzy-match the source; every
   number/date/email/phone/URL anywhere in the output must occur verbatim in the source *or in an
   answer the user has since given*; an unverifiable claim is stripped (never shipped silently)
   and turned into an auto-generated question, merged with the model's own. This is what
   `grounding.test.ts` actually tests — prompting alone is not relied on for correctness.

`env.useLlmMock` (true when `LLM_MOCK=true` **or** no `ANTHROPIC_API_KEY` is set) swaps in
`llm/mock.ts`'s deterministic fixtures instead of calling Anthropic — used by the test suite and
lets a fresh `docker compose up` with no key still exercise the whole flow. Watch for the
`LLM_MOCK` env parsing specifically: it's `booleanFromEnv` (an explicit `=== "true"` check) in
`config/env.ts`, not `z.coerce.boolean()` — that coercion was a real bug here (`Boolean("false")`
is `true` in JS, so the naive version silently forced mock mode regardless of the flag).

### PDF: generated twice, by design, kept in sync by a test

Two templates (`classic`, `modern`) live in `server/src/pdf/templates/*.tsx` as
`@react-pdf/renderer` components, used by the real download (`GET /cvs/:id/pdf`,
`pdf/render.tsx`). The client's live preview (`client/src/features/cvs/CvPdfPreview.tsx`) is
**not** an HTML approximation — it imports hand-synced copies of the same template components from
`client/src/features/cvs/pdf-templates/`, runs them through react-pdf's `usePDF` hook (same
layout engine, now in the browser) to produce a real PDF blob, then decodes and paints it onto a
`<canvas>` via `pdf.js` directly (not react-pdf's `<PDFViewer>` iframe — that renders blank under
headless/automated screenshots, confirmed directly). `pdf-templates/templates.test.tsx` renders
the client's copies to a real PDF and asserts on extracted text, the same way the server's own
`pdf/render.test.tsx` does — that's what actually guards the two copies from drifting apart, not
just the comment saying so. Editing a template means editing both files.

A `cvs.template` column controls which template renders; it's deliberately **not** covered by the
content `version` CAS check below — switching templates is a display choice, not a content edit.

### Editing concurrency

`PUT /cvs/:id` takes `{content, version}`, writes only if `version` still matches
(`cv.repo.ts#updateCvContentCas`), 409s otherwise. The `apply_answer` job does its own CAS with up
to 3 retries, re-reading and re-merging onto the latest version on conflict rather than clobbering
a concurrent manual edit. `client/src/features/cvs/useCvDraft.ts` is the one hook owning
content/version/dirty/save-state for both the editor and the live preview, so they can't disagree
with each other.

### Auth

better-auth, email+password only (`server/src/auth/auth.ts`), Drizzle adapter against hand-written
tables in `db/schema/auth.ts` matching better-auth's expected shape exactly (not CLI-generated, so
migrations stay on this project's own committed-SQL `drizzle-kit generate` workflow). Two things
that aren't obvious from better-auth's docs:

- It applies a **hard-coded** rate limit on `/sign-in` and `/sign-up` (3 req/10s) that the global
  `rateLimit.max` config does *not* override — only `customRules` per-path does (see the comment
  in `auth.ts`).
- Client-side, never `navigate()` immediately after `signIn.email()`/`signUp.email()` resolves —
  `useSession()`'s reactive store can lag one tick behind, and `RequireAuth` reading it before it
  catches up bounces a successfully-authenticated user back to `/login`. `LoginPage.tsx`/
  `SignupPage.tsx` navigate from a `useEffect` watching the session store instead.

### Data model

`cvs` (content as validated `jsonb`, `version` for CAS, `template`, `status`:
draft/generating/ready/failed) → `cv_questions` (one row per clarifying question, `field_path`
like `experience[1].bullets[0]`, status open/answered/dismissed) and `jobs` (generic queue:
`type` generate/apply_answer, `attempts`/`max_attempts`/`locked_until`). Every CV-scoped route goes
through `cv.repo.ts#getOwnedCv(userId, id)` — missing or belongs-to-someone-else both 404, never
403 (no existence leak); this is what `cvs.api.test.ts` checks with two real signed-up users over
real HTTP.

### Client structure

`client/src/features/<domain>/` mirrors the server's `modules/<domain>/` layout. `shared/types.ts`
hand-mirrors the server's zod `CvContent` shape (documented there as a deliberate trade-off — no
shared workspace package for one small file). TanStack Query hooks live one file per domain under
`shared/queries/`. The live PDF preview (`CvPdfPreview.tsx`) is lazy-loaded (`React.lazy`) since
react-pdf's browser bundle is large — only a CV detail page pays for it, not the whole app.

### CSP

`server/src/app.ts`'s helmet config has specific additions (`'wasm-unsafe-eval'` in `script-src`,
`data:` in `connect-src`, an explicit `worker-src`) that only exist because the client-side PDF
preview needs them (react-pdf's WASM layout engine, pdf.js's worker). Found by loading the
feature in a browser and reading actual CSP violations, not by guessing — don't remove them
without checking that flow still works.
