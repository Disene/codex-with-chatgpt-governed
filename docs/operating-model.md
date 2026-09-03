# Durable Operating Model

This document is the canonical source for stable, cross-task C2C operating
rules that do not belong to the protocol, Governance, security, or runtime
contracts. It is intentionally short: it is not a conversation archive,
task-history database, evidence bundle, or replacement for an active Issue.

## Authority map

- **Repository and runtime facts** come from the live repository, the bound
  read-only connector/MCP, and current tests or released execution output.
- **Current task intent** — goal, frozen constraints, success criteria, and
  material task decisions — comes from the active Issue plus the current
  Codex-produced `TASK_CONTEXT` or `HANDOFF`.
- **Protocol, security, and Governance behavior** comes from code and tests,
  together with `docs/protocol.md`, `docs/governance-v1.md`, and the related
  contract documents.
- **Stable cross-task operating rules** come from this document.
- **Implementation history** comes from merged pull requests, git history, and
  closed Issues.
- **ChatGPT account or Project memory** is advisory context only. It is never a
  canonical source and loses whenever it is stale or conflicts with the
  applicable authority above.

Current host-product behavior is a live capability fact, not an eternal
invariant. The repository template defines how setup and repair respond to the
capabilities that are actually exposed.

## Division of labor

The detailed collaboration and Human Gate contract remains in
`docs/protocol.md` and `docs/governance-v1.md`; this document only routes to it:

- ChatGPT owns architecture and product reasoning, real-effect risk judgment,
  scope discipline, planning, and independent review.
- Codex owns local investigation, implementation, build/test, git and Draft PR
  work, and authorized execution.
- Human involvement is reserved for real product or business choices, L3
  authorization, login/2FA/CAPTCHA, and required secret entry.

## Task, Issue, and session lifecycle

When the selected privacy boundary permits it, durable task detail belongs in
the task's appropriate Issue. A fresh Codex session reads the current Issue and
the live repository, keeps the complete frozen contract locally, and relays
only material constraints in a compact `TASK_CONTEXT`. ChatGPT plans and
reviews from that context plus live connector facts; old conversations are not
replayed as task authority.

The normal delivery flow is:

1. Current Issue and exact frozen Base.
2. Compact `TASK_CONTEXT` and ChatGPT PLAN.
3. Codex implementation and proportional validation.
4. Draft PR, then independent remote-diff review.
5. A passing review may proceed to the separately authorized merge boundary;
   it does not require a duplicate final-final review.

Session rotation is hybrid: one bounded Issue, PR, or implementation phase is
normally one Codex session, while the workspace-level Project and connector
remain durable. Do not rotate in the middle of an active PLAN or Human Gate.

Issue bodies are updated only at natural phase boundaries or when a material
frozen task decision changes. Per-iteration status churn is not durable state.

## Privacy and Issue routing

- A private project repository uses its own Issue for private task detail.
- A public repository receives only public-safe task content.
- This public C2C repository receives only public-safe C2C work.
- If no suitable repository exists, do not move private task detail into this
  public repository. A private fallback may be added only after a real need
  justifies it.
- An Issue is not a secrets manager.

Project or Library availability does not widen the active task's privacy or
authorization boundary. Unrelated Project sources or Library content must not
be searched or used unless the current task explicitly requires them or the
Human requests them.

## Upstream integration

Detect upstream drift automatically and read-only when useful, but do not
auto-update a customized, stable `main`. Integrate through a temporary
compatibility or sync branch, then tests, review, and a pull request before any
merge. Upstream drift alone is not an instruction to rewrite local behavior.

Use stronger review for Skill, protocol, authentication, execution-permission,
and state-schema changes. Schema migrations additionally require evidence for
backup, dry-run, resume, and rollback.

## Local-only data

Never promote credentials, local operational secrets, or protected customer
data into GitHub, documentation, ChatGPT memory, or Project sources. This
includes Feishu webhook/signing secrets, Cloudflare credentials or tokens,
OAuth access/refresh tokens, pairing codes, local Governance state, local
secure configuration, and private customer/project data excluded by the
selected Issue privacy boundary.

## Durable Sync Rule

At a natural phase boundary — normally Draft PR creation and again before
terminal `DONE` or merge — perform exactly one lightweight materiality check:

> Did this task materially create or change a durable rule, external-product
> assumption, cross-task operating decision, or live Project-instruction
> contract?

If **NO**, do nothing: do not create documentation churn. If **YES**, update
the canonical durable source in the same task/change set before declaring the
task complete:

- code, protocol, or Governance contract change -> its authoritative doc and
  test in the same PR;
- cross-task operating rule -> this document in the same PR;
- task-specific frozen decision -> the active Issue body at the phase boundary;
- Project-instructions template change -> the repository template in the same
  PR, with one live refresh recorded as an operational follow-up after merge;
- host capability change -> the capability-aware setup/repair contract, not an
  incidental UI state frozen as a permanent invariant;
- secrets or local state -> remain local and are never synchronized to GitHub
  or memory.

This check is a workflow rule, not a protocol state, Human Gate, preflight,
evidence layer, background updater, repeated Governance phase, or extra review.

## Memory is not a synchronization target

Memory and history can help orientation, but may be incomplete, stale,
non-enumerable, or product-managed. Do not mirror GitHub or documentation into
memory. The workflow must remain correct when memory is missing; durable facts
belong in the authoritative code, docs, Issue, or Project-instructions template
identified above.
