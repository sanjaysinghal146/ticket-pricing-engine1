# AI-Logs — Transparency Record of AI Assistance

This document records how an AI coding assistant (Claude, by Anthropic) was
used while building this project, for review purposes. It is a factual log
of what was asked and what the assistant produced at each stage, plus what
was verified before moving on. Nothing here is fabricated after the fact —
it reflects the actual sequence of the build session.

## Tool used

Claude (Anthropic), used conversationally in a chat interface with code
execution access (a Linux container for writing/running files, installing
packages, and testing).

## Session log

### 1. Initial request — build the engine from the problem statement

**Prompt (paraphrased):** the Round 2 Build Round problem statement PDF was
shared, followed by: "create complete project and give me steps to set up
in codespace."

**What the assistant did:**
- Read the problem statement and identified the core requirements: seat
  tiers, sold-out handling, a flat + a capped percentage discount, a
  convenience fee, GST, and exact-paisa reconciliation.
- Designed the data model and calculation order (documented in
  `REASONING.md`).
- Generated the TypeScript project: `types.ts`, `errors.ts`,
  `pricingEngine.ts`, `data/sampleShow.ts`, `cli.ts`, plus a Jest test
  suite (`tests/pricingEngine.test.ts`) and project scaffolding
  (`package.json`, `tsconfig.json`, `jest.config.js`, `.devcontainer/`).
- **Verification performed by the assistant before delivering:** ran
  `npm install`, ran the full Jest suite (9/9 passing), and ran the CLI
  demo to visually confirm the printed receipt matched hand-calculated
  expected totals for a sample booking.
- Packaged the project as a zip and provided step-by-step GitHub +
  Codespaces setup instructions.

### 2. Second request — add a frontend and backend

**Prompt (paraphrased):** "yes now i want to make frontend and backend so
give me code so i am easily past in my codespace and guide me step by
step."

**What the assistant did:**
- Added an Express REST API (`src/server.ts`) exposing `/api/show`,
  `/api/quote`, and `/api/confirm` over the *same* pricing engine already
  built and tested in step 1 — no logic was duplicated or rewritten.
- Added a plain HTML/CSS/JS frontend (`public/index.html`,
  `public/styles.css`, `public/app.js`) — a seat-selection and checkout UI
  calling the new API.
- Updated `package.json` (added Express + type definitions) and
  `.devcontainer/devcontainer.json` (port forwarding for the web app).
- **Verification performed by the assistant before delivering:**
  - Ran `npx tsc --noEmit` to type-check the whole project.
  - Started the server and used `curl` to hit every endpoint directly:
    `GET /api/show`, a `POST /api/quote` with stacked offers (cross-checked
    the returned total against the CLI demo's earlier output — identical),
    a sold-out rejection case, and a `POST /api/confirm` call followed by
    re-fetching `/api/show` to confirm seat availability actually
    decremented.
  - Confirmed the static frontend files (`/`, `/app.js`, `/styles.css`)
    served with HTTP 200.
  - Re-ran the full Jest suite to confirm the new backend code hadn't
    broken the existing engine tests (still 9/9 passing).
- Re-packaged the updated project and gave updated Codespaces setup steps.

### 3. Follow-up — setup troubleshooting (Hinglish)

**Prompts (paraphrased, across several turns):** questions about
extracting the zip into an existing Codespace/GitHub repo, and about why
the Explorer's "Upload" option wasn't appearing.

**What the assistant did:** provided step-by-step guidance for uploading
the zip via GitHub's web UI, then extracting it inside the Codespace with
`unzip -o` (overwrite mode, since a partial project already existed in the
target repo), reinstalling dependencies, and re-running tests before
committing. No new code was generated in these turns — this was setup
guidance only, based on the repo state the user described.

### 4. This request — README, Reasoning, and AI-Logs documents

**Prompt (paraphrased):** a request for three submission documents —
`README.md`, `REASONING.md`, and this file — for the company/judges to
review how the project was built.

**What the assistant did:** wrote all three documents based on the actual
project and the actual conversation above — no invented steps or
retroactively "cleaned up" narrative.

## What was and wasn't verified by running actual code

Everything claimed as "verified" above was done by the assistant executing
real commands in a live container during the session — `npm install`,
`npm test`, `npx tsc --noEmit`, running the server, and `curl` requests
against it — not asserted from reasoning alone. The specific test/command
outputs are visible in the conversation transcript this log was generated
alongside.

## What a human reviewer should independently check

This log documents what the AI assistant did; it doesn't substitute for
the submitter's own review. Recommended before presenting this project:

- Run `npm test` yourself and read through `tests/pricingEngine.test.ts` —
  confirm the test cases actually match the problem statement's
  requirements, not just that they pass.
- Read `pricingEngine.ts` end to end and confirm the offer-stacking order
  and GST-base decisions (documented in `REASONING.md`) are ones you're
  prepared to explain and defend to judges, since they were design choices
  made to resolve genuine ambiguity in the problem statement — not the
  only valid choices.
- Try the web app yourself (`npm start`) and manually test at least one
  edge case not covered by the automated tests (e.g. booking every
  remaining seat in a tier at once) to build first-hand familiarity with
  the system's behavior.
