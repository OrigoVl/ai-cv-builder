# Brightfolio

An AI CV Builder test task. Upload a CV (PDF) or describe your background in free text, name a
target role, and get a structured CV draft you can review, answer a few clarifying questions on,
edit by hand, and download as an A4 PDF with selectable text.

## Running it

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY. AUTH_SECRET can stay as the placeholder for local use,
# or generate a real one with: openssl rand -base64 32
docker compose up --build
```

Open **http://localhost:3000**. That's it — one container for the app, one for Postgres, no
other setup.

If `ANTHROPIC_API_KEY` is left blank (or `LLM_MOCK=true` is set), generation falls back to a
small deterministic offline mock instead of calling Anthropic — the whole flow (signup, upload,
generation, questions, editing, PDF export) still works end-to-end, just with placeholder content
instead of real AI output. Useful for trying the app, and it's what the test suite runs on.

> **Note on `docker compose` and Docker Hub credentials:** if your Docker Desktop's credential
> helper is in a broken state, `docker compose up` can fail with `error getting credentials`
> while pulling the base image. If you hit that, remove `"credsStore"` from `~/.docker/config.json`
> (or just restart Docker Desktop) and retry — it's a local Docker Desktop issue, not anything
> this project's config does.

### Tests

```bash
pnpm install
pnpm test              # server + client unit/integration tests (no Docker, no API key needed)
pnpm test:server       # server only
pnpm test:client       # client only

# End-to-end, against a running app (docker compose up, or `pnpm dev` with a local Postgres):
pnpm exec playwright install chromium   # once
LLM_MOCK=true pnpm dev                  # or: docker compose up, with LLM_MOCK=true in .env
pnpm e2e
```

Server tests run against a real (in-process, WASM) Postgres via [PGlite](https://pglite.dev/) —
the same committed migrations the real app runs, no Docker needed, no network. 43 server tests
and 8 client tests, all passing; see "Tests" below for what each file actually covers.

### Local dev (without Docker)

```bash
pnpm install
# a local Postgres on 5432, e.g.: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16-alpine
cp server/.env.example server/.env   # if you want server-only env vars during dev — see server/src/config/env.ts
pnpm dev   # runs client (Vite, :5173) and server (:3000) concurrently; Vite proxies /api
```

## Architecture

```
client (React SPA; served by Express itself in prod, Vite dev server locally)
  └─ REST /api/* ──► Express
        ├─ auth            better-auth, httpOnly cookie session, email+password only
        ├─ cvs routes  ──► cv.service ──► cv.repo (Drizzle) ──► Postgres
        ├─ jobs table  ◄── worker loop (same process, SKIP LOCKED claim)
        │                     └─ llm/ (Anthropic SDK, tool use) ──► grounding check
        └─ pdf export      @react-pdf/renderer, streamed from saved content only
```

**Stack:** Node.js + Express 5 + TypeScript on the backend, Postgres via Drizzle ORM, the
official `@anthropic-ai/sdk` for all LLM calls, better-auth for email/password sessions, React 19
+ Vite + TanStack Query + Tailwind on the frontend. One Docker image serves both; one `postgres`
service; no other infrastructure.

### Data model

- **`cvs`** — `user_id` (FK), `title`, `target_role`, `source_kind` (`pdf`/`text`), `source_text`
  (the *extracted text only* — the uploaded PDF binary itself is never stored), `status`
  (`draft`/`generating`/`ready`/`failed`), `error`, `content` (jsonb, validated against the same
  zod schema used everywhere else), `version` (optimistic-concurrency counter).
- **`cv_questions`** — one row per clarifying question, with a `field_path` (e.g.
  `"experience[1].bullets[0]"`), the question text, the user's `answer`, and a status
  (`open`/`answered`/`dismissed`).
- **`jobs`** — a tiny generic job queue: `type` (`generate`/`apply_answer`), `payload`, `status`
  (`queued`/`running`/`done`/`failed`), `attempts`/`max_attempts`, `locked_until`.

### Async generation that survives a reload or a crash

`POST /api/cvs` inserts the `cvs` row and its `generate` job **in one transaction**, then returns
`202` immediately — so a crash between "CV created" and "job exists" is impossible. A worker loop
(2 concurrent lanes, in the same Node process) polls Postgres every second and claims a job with:

```sql
UPDATE jobs SET status='running', locked_until=now()+2min, attempts=attempts+1, ...
WHERE id = (
  SELECT id FROM jobs
  WHERE status='queued' OR (status='running' AND locked_until < now())
  ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` lets concurrent lanes each grab a different row without blocking each
other; re-claiming any row whose lock has expired is what recovers a job a worker crashed while
holding — no heartbeat protocol needed beyond that. This is directly tested in
`server/src/jobs/queue.test.ts`, including a test that kills a "running" job's lock and confirms
it gets reclaimed and completed.

The client has **no client-side job state at all** — it just polls `GET /api/cvs/:id` (1.5s while
`generating`, 5s afterwards — see below for why it keeps polling at all) and renders whatever
`status` the server reports. Reloading the page just re-mounts that query; it picks up exactly
where the server already is. I chose **Postgres over Redis/BullMQ** for the queue: one fewer
container, the job insert is transactional with the CV row, and at this scale (one user, a
handful of CVs) a dedicated queue would be solving a problem that doesn't exist yet.

### The anti-hallucination pipeline — "the AI may rephrase, but must not invent facts"

This is the part the task cares about most, so it's three independent layers, not one:

1. **Prompting** (`server/src/llm/prompts.ts`): the system prompt explicitly separates
   *rephrasing* (always allowed — turning a paragraph into bullets, tightening wording,
   synthesizing a summary from facts already present) from *inventing* (never allowed — a
   company, date, number, or achievement that isn't in the source). It asks the model to cite a
   verbatim **evidence quote** for every fact-bearing field, and to raise a **question** instead
   of guessing when something is missing or vague. Untrusted input (the uploaded text) is wrapped
   in `<source_document>` tags with an instruction to treat it as data, never as commands — a
   basic prompt-injection guard, since a CV could contain text like "ignore previous
   instructions."
2. **Structured output via forced tool use**, not "ask nicely for JSON": the Anthropic call uses
   `tool_choice: {type: "tool", name: "submit_cv"}` with a JSON Schema generated directly from
   the same zod schema the rest of the app validates against (`zod.toJSONSchema`, zod v4's
   built-in schema export — no translation layer that could drift from the real schema). If the
   result still fails zod validation, there's **one repair turn** (the validation errors are sent
   back as a `tool_result`) before the job fails with a readable error.
3. **A deterministic, non-LLM grounding check** (`server/src/llm/grounding.ts`) — this is the
   actual enforcement, run on every model output before it ever reaches the stored CV. Prompting
   is a request; this is what's actually checked, in plain code, with unit tests as the
   guarantee, not vibes:
   - Every "hard fact" field (company, title, school, dates) must fuzzy-match the source text —
     tolerant of punctuation ("Google" vs "Google LLC."), but every significant word must appear.
   - Every number, date, email, phone, and URL *anywhere* in the output is extracted with regexes
     and must occur verbatim in the source (or in an answer the user has since given — see
     below). A rephrased sentence with no such tokens is left alone (we can't "verify" a
     paraphrase, and don't try to).
   - A cited evidence quote must actually be found in the source — if the model says "trust me"
     without a real quote behind it, it's rejected the same as an invented fact.
   - Anything that fails is **removed or blanked**, never shipped silently, and an automatic
     question is raised ("We couldn't verify '...' — can you confirm or fill it in?"), merged
     with the model's own questions. An experience entry that loses its employer to this check is
     dropped entirely, rather than shown with a blank company and real-looking dates.
   - `server/src/llm/grounding.test.ts` has the actual test cases: an invented employer gets
     stripped and questioned; an invented metric inside an otherwise-fine bullet gets stripped
     while the rest of the bullet-list survives; a fact that only appears in a *later user
     answer* (not the original source) is correctly allowed through; a plain rephrase with no
     numbers passes untouched.

Answering a question works the same way: the relevant field gets its own small, path-scoped
tool-use call (`update_section` — see `server/src/llm/section-schema.ts`, which picks a *specific*
JSON Schema per field path, e.g. `ExperienceEntry[]` for `"experience"` but a plain string for a
single bullet — not a generic "any JSON" schema the model has to infer the shape of), the result
goes through the same grounding check with the new answer folded into the trusted corpus, and the
merge is written with the same optimistic-concurrency check a manual edit uses (next section).

### Editing, concurrency, and the one real bug this caught

`PUT /cvs/:id` takes `{content, version}` and only writes if `version` still matches
(`UPDATE ... WHERE id=$1 AND version=$2`, in `cv.repo.ts#updateCvContentCas`) — otherwise `409`.
This stops a manual edit and a background "answer applied" merge from silently clobbering each
other; whichever one loses the race gets told to reload rather than overwriting data. The
apply-answer job does its own compare-and-swap with up to 3 retries, re-reading and re-merging
onto the latest version rather than failing outright on a conflict.

Running the actual Playwright e2e test against the real container caught a real version of this
race: answering a question returns `202` *before* the merge job has actually run, and polling
used to stop entirely once a CV left `"generating"` — so the editor could be left holding a
version the server had already moved past, and the very next save would spuriously `409`. Fixed
by (a) not stopping polling, just slowing it to every 5s once ready, and (b) refetching again
~1.5s after a question is answered, giving the usually-sub-second merge job time to land. Both
are safe because the editor only ever applies a background refetch when the user has no unsaved
local edit in progress (a `dirty` flag) — see `client/src/features/cvs/CvEditor.tsx` and
`client/src/shared/queries/cvs.ts`. I'm calling this out explicitly because it's exactly the kind
of thing that's easy to miss without actually driving the real UI end-to-end, not just unit
testing each piece in isolation.

### PDF export

`GET /cvs/:id/pdf` renders the CV's **currently saved** `content` (never anything from the
request) with `@react-pdf/renderer` — a real PDF text layer (selectable, searchable), not a
screenshot of HTML, and no headless Chromium needed in the Docker image. One fixed A4 template
(multiple templates are explicitly out of scope). It uses the built-in Helvetica standard font
rather than an embedded TTF, which keeps the image free of a font-asset pipeline at the cost of
non-Latin-script support — see "what I'd do differently" below.

### Security / untrusted-input handling

- Every CV/question/PDF route goes through `getOwnedCv(userId, id)` — a row that doesn't belong
  to the caller is a `404`, not a `403` (no existence leak). Covered by
  `server/src/modules/cvs/cvs.api.test.ts` (two real users, real HTTP, real Postgres).
  `docker compose`'d or not, if you drive the actual UI as two different signed-up users you'll
  see the same thing I did when I checked it live: neither can see, edit, or delete the other's
  CVs.
- Upload: multer in-memory storage, 5MB cap, and the magic bytes (`%PDF-`) are checked — not just
  the client-supplied MIME type, which is trivially spoofable. A PDF with no real text layer
  (e.g. a scan) gets a clear `422` telling the user to paste text instead, rather than silently
  generating a near-empty CV.
- `helmet`, a rate limiter on CV creation, zod validation on every request body, and a central
  error handler that only ever leaks an explicitly-thrown `HttpError`'s message — anything else
  becomes a generic 500, logged server-side with `pino`.
- LLM output is rendered as plain text in the UI (no `dangerouslySetInnerHTML`), and the untrusted
  source text is explicitly delimited and framed as data in the system prompt (see above).

### REST API

```
POST   /api/auth/*                          better-auth: sign-up/in/out, session
GET    /api/cvs                             list mine
POST   /api/cvs                             create (multipart PDF, or JSON text) + enqueue → 202
GET    /api/cvs/:id                         cv + status + open questions
PUT    /api/cvs/:id                         edit (version check) → 200 | 409
DELETE /api/cvs/:id
POST   /api/cvs/:id/retry                   re-enqueue a failed generation
POST   /api/cvs/:id/questions/:qid/answer   → 202, enqueues the merge job
POST   /api/cvs/:id/questions/:qid/dismiss
GET    /api/cvs/:id/pdf
GET    /api/health
```

## Tests

| File | What it actually covers |
|---|---|
| `llm/grounding.test.ts` | The core anti-hallucination logic: invented facts/entities get stripped and questioned; rephrasing with no numbers passes; a fact from a later answer is allowed; an unverifiable evidence quote is rejected. |
| `llm/generation.service.test.ts` | The mock → grounding pipeline end-to-end, plus a regression test for the "experience is an array of objects" bug below. |
| `jobs/queue.test.ts` | Claim-once semantics, FIFO order, retry-then-fail after `max_attempts`, and recovering a job a worker crashed while holding (the `locked_until` expiry path). |
| `jobs/handlers/handlers.test.ts` | The generate and apply-answer handlers against a real PGlite Postgres: content/status get written correctly, `onExhausted` marks the CV failed, a CAS conflict is rebased rather than clobbering a concurrent edit, and a regression test for answering a structured-array question. |
| `modules/cvs/cvs.api.test.ts` | Real HTTP against the real app + PGlite: cross-user isolation (404, not 403) on every route, a stale-version `409`, upload validation (spoofed MIME type, oversized file), and refusing to render a PDF before generation finished. |
| `pdf/render.test.tsx` | The exported PDF is actually A4, one page, and its extracted text contains the real content — not just "didn't throw." |
| `core/json-path.test.ts` | The tiny path get/set used to merge an answered question into the right spot in the CV. |
| `e2e/cv-flow.spec.ts` | The one Playwright happy path, driven through the real UI against a real running container: sign up → describe yourself → wait for generation → answer a question → edit a field → download a real PDF. This is what caught the polling race described above — a bug three layers of unit/integration tests didn't, because each of them tested one piece in isolation and the bug was in how two pieces interacted over time. |

## What I simplified, and what I'd do differently with more time

- **PDF font**: standard Helvetica, not an embedded TTF — no non-Latin-script support (Cyrillic,
  CJK, etc.). I'd embed a font like Inter or Noto Sans with broader coverage.
- **One job worker, in-process**: fine at this scale; a second replica would need an external
  queue or at least a shared lock table partitioned differently (the current `SKIP LOCKED`
  approach actually already generalizes to multiple *processes* sharing one Postgres, just not
  tested at that scale here).
- **The mock LLM mode** is a deterministic heuristic, not a model — it extracts contact details
  from the first line/regex matches and otherwise asks the user to fill things in by hand. It's
  there to make the whole flow runnable and testable without a key, not to be a convincing demo
  of AI writing.
- **No OCR**: a scanned PDF with no text layer is rejected with a clear message rather than
  attempting OCR, which felt like real scope creep for the time budget.
- **The bullet/skills/links editors are plain textareas/comma-separated inputs** (one bullet per
  line) rather than a fully drag-and-drop rich list editor — faster to build correctly, and still
  lets you edit every field, just with slightly less polish than a dedicated per-bullet UI.
- **No password reset, email verification, or OAuth** — explicitly out of scope per the brief;
  better-auth would make all three easy to add later.
- With more time, I'd also: add a retry/backoff visible in the UI while a `generate` job is on
  attempt 2 or 3 (right now the user just sees "Generating…" throughout); make the questions
  panel let you jump the editor directly to the field in question; and add a light real-time
  channel (SSE) so a second open tab/device sees generation finish without waiting out its own
  poll interval.

## How I used AI tools

Built with Claude Code (Claude Opus 5.5), in largely one continuous session. I used it to write
essentially all of the first-draft code — schema, routes, the job queue, the grounding checker,
the React client — from a plan I reviewed and approved up front (stack choices, data model, the
three-layer anti-hallucination design, the job-queue design) rather than from a vague prompt, and
reused patterns from an existing side project of mine (Zorya, a job-tracking app with its own
better-auth/Drizzle/LLM-call setup) as a known-working reference rather than inventing patterns
from scratch. I didn't just accept the output, though:

- Fixed a real bug in generated code myself mid-build: the JSON encoding of a Unicode escape
  (`̀-ͯ`, for accent-folding in the grounding matcher) got silently decoded into literal
  combining-mark characters inside a regex literal when the file was first written, which I caught
  by reading the file back and fixed with an explicit `new RegExp("[\\u0300-\\u036f]", "g")`.
- Found and fixed a real data-corruption-adjacent bug by actually running the generated app in
  Docker end-to-end rather than trusting unit tests alone: answering the "add your experience"
  question pushed a raw string into a field that must be an array of structured objects, which
  failed validation on every retry and silently dropped the user's answer. Fixed at the root (a
  path-aware JSON Schema per field, `section-schema.ts`, so the model — and the offline mock — get
  told the actual expected shape instead of `unknown`), added regression tests for it, then
  verified the fix against the live container again.
- Found and fixed a second real bug the same way, via the Playwright e2e test against the real
  container rather than mocks: a polling/versioning race where the editor could hold a stale
  `version` after an async answer-merge completed, causing spurious `409`s on the very next save
  (see "Editing, concurrency, and the one real bug this caught" above).
- Rewrote the auth cookie config after noticing it set `Secure` cookies in production for a
  stack that has no HTTPS termination anywhere, tying correctness to browsers' special-casing of
  `localhost` rather than anything the app actually provides.
- Made deliberate, reasoned trade-offs against the plan rather than following it blindly
  (Postgres-backed queue over Redis, tool-use-with-forced-schema over "ask for JSON", a
  path-specific schema generator over a generic `unknown` field) and can account for each one
  above.
