# Contributing to Kalea

Every change reaches `main` through a reviewed pull request, and the maintainer (the project CTO) approves scope before work starts. This guide covers how to propose work, build it and get it merged.

## Quick path

1. **Open an issue** describing the problem or feature, and wait for the maintainer to approve it.
2. **Branch from `main`** with a typed name: `feat/<topic>`, `fix/<topic>`, `docs/<topic>` or `chore/<topic>`.
3. **Build with tests first**, commit in small work units using [Conventional Commits](https://www.conventionalcommits.org/).
4. **Run the checks locally**: `pnpm typecheck`, `pnpm test`, `pnpm --filter @kalea/web build`.
5. **Open a pull request** to `main`, linking the issue. CI (`check`) must pass, and the maintainer merges.

Pull requests that skip step 1 may be closed without review, even if the code is good. The issue is where scope gets agreed.

## Ground rules

| Rule | Why |
| --- | --- |
| English for all artifacts: code, comments, UI copy, docs, commits and PRs | Kalea targets all of LATAM and international integrators |
| Kalea is B2B infrastructure. Never frame it as a consumer exchange, a wallet or a P2P marketplace | See [docs/business-model.md](docs/business-model.md) |
| Kalea never holds local fiat. Never claim "no custody" or that anyone is "not responsible" | Legal wording must stay accurate. The escrow contract holds USDC |
| No funding-application or grant material in the repository | The project stands on its own |
| Never commit secrets. Only `.env.example` files are tracked | Use the examples as templates for your local `.env` |
| No AI attribution or Co-Authored-By trailers in commits or PRs | Conventional Commits only; human ownership and clean git provenance |
| One order lifecycle everywhere | [docs/order-lifecycle.md](docs/order-lifecycle.md) is canonical for docs, types, API and web |

## Setup

Requirements: Node.js 22 and pnpm 11 (pinned in `package.json`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # set INTEGRATOR_API_KEYS and MERCHANT_ACCOUNTS for local testing
cp apps/web/.env.example apps/web/.env   # PUBLIC_API_URL, defaults to http://localhost:8787
pnpm dev                                 # API on :8787, web on :3000
```

The web runs on port 3000 because the API only accepts browser requests from `WEB_ORIGIN` (default `http://localhost:3000`).

## Where things live

| Path | What | Checks |
| --- | --- | --- |
| `packages/shared` | Domain model: corridors, rails, quotes, orders, lifecycle | `vitest` |
| `apps/api` | Hono API on Node.js: integrator `/v1`, merchant SEP-10, public demo endpoints | `vitest`, `tsc` |
| `apps/web` | Astro static site with Preact islands | `astro check`, `astro build` |
| `contracts` | Soroban escrow (not implemented yet) | — |
| `docs` | Business model, architecture, order lifecycle | Review |
| `legacy` | Frozen consumer prototype, reference only | Do not edit |
| `.github/workflows` | CI checks (`ci.yml`) and secret detection (`secrets.yml`) | Actions |

## Working on code

### Tests first

When a change has a runnable, deterministic test and a clear expected result:

1. Write the test and watch it fail (red).
2. Implement until it passes (green).
3. Refactor with the tests still green.

Mention the red step in the PR. Docs-only changes have no test step; check headings, links and wording instead.

### Commits

- Use Conventional Commits: `feat(api): ...`, `fix(shared): ...`, `docs: ...`, `chore: ...`. Use the package name as the scope.
- Each commit is one coherent work unit, with its tests and docs alongside the behavior.
- Do not mix unrelated changes, formatting sweeps or dependency bumps into a feature commit.
- **Never add "Co-Authored-By" or AI attribution** (Claude, Cursor, Antigravity, ChatGPT, Copilot, etc.) to commit messages or PR descriptions. CI blocks any pull request containing AI co-authorship trailers.

### Package notes

- **`apps/web` pins TypeScript 6.** `astro check` does not run on TypeScript 7. The rest of the repo uses TypeScript 7.
- **Integrator keys never reach the browser.** The web only calls the public demo endpoints (`/v1/demo/*`) and the merchant endpoints.
- **Order status changes go through `canTransition`** in `packages/shared`. Do not hardcode transitions in the API or web.

## Security rules

The repo is **public**. Anything you push can be seen and copied.

- **Never commit secrets:** Stellar secret seeds (`S…`), API keys, JWT secrets, passwords, or `.env` files.
- Local secrets live in git-ignored `.env` files (`apps/api/.env`, `apps/web/.env`). Use the `.env.example` files as templates.
- Read keys from environment variables and document every new key in the respective `.env.example`.
- CI runs automated secret detection with Gitleaks (`.github/workflows/secrets.yml`) on every pull request and push to `main`, including Stellar secret seed patterns (`S[A-Z2-7]{55}`).
- If you leak a secret, notify the team right away and rotate it immediately. Deleting or amending the commit is not enough.

## Pull requests

### Size

Keep a pull request reviewable in about an hour, which is around **400 changed lines** (additions plus deletions, lockfiles excluded).

If the work is bigger, split it into **chained pull requests**:

```text
main
 └── feat/<topic>              ← integration branch, draft tracker PR to main
      └── feat/<topic>-t1-...   ← PR 1, base: feat/<topic>
           └── feat/<topic>-t2-...  ← PR 2, base: the PR 1 branch
```

- Merge children in order. Change a child's base to the integration branch only **after** its parent has merged.
- Merge the tracker into `main` last.
- Never shrink a PR by deleting tests, comments or docs. If a unit genuinely cannot be split (for example a framework swap), say why in a "Size exception" section.

### Description

Open the PR against `main`. The description is pre-filled from `.github/pull_request_template.md`. Every PR description includes:

- **Summary**: what changed and why, plus the linked issue (`Closes #N` or `Refs #N`).
- **Acceptance criteria**: copy the checklist from the issue and tick what is done.
- **Verification evidence**: each command you ran and its real output (screenshots, tx hashes if applicable).
- **Notes for reviewers**: anything out of scope or requiring attention.
- For chained PRs, **Chain context**: position, base, dependencies and a diagram that marks the current PR.

### Review and merge

- `main` is protected. A merge needs a pull request, a passing, up-to-date `check` CI job and resolved conversations.
- Only the maintainer can merge into `main`. Force pushes and branch deletion are disabled.
- Address review comments with new commits. Do not force-push over a branch that is under review.

## Before you open a PR

- [ ] An approved issue exists and is linked.
- [ ] The branch name and commits follow the conventions above.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm --filter @kalea/web build` pass locally.
- [ ] Behavior changes include tests, with the red step observed when applicable.
- [ ] Docs are updated if behavior, endpoints or the order lifecycle changed.
- [ ] No Spanish copy, secrets, funding material or "not responsible" claims.
- [ ] The PR is under ~400 changed lines, or it is chained, or it justifies a size exception.

## Questions

Open an issue labeled `question`. Product decisions (pricing, fees, corridors, dispute rules) belong to the maintainer and are decided in issues, not in pull requests.
