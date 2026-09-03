# Governed C2C V1 — Governance Core

This layer is intentionally orthogonal to the upstream C2C protocol. It does not add new protocol states and does not modify MCP, OAuth, workspace containment, tunneling, or the Codex harness.

## Goals

- Apply **minimum sufficient governance** rather than maximum caution.
- Classify the *next effect* as L0 (observe), L1 (workspace), L2 (remote reversible), or L3 (consequential).
- Give each level both a governance floor and a governance ceiling.
- Reserve the Human Gate for one final L3 consequential decision.
- Treat uncertainty as a reason to investigate before escalating.
- Treat successful acceptance criteria as a reason to finish, not search for more work.
- Persist governance separately from upstream session/checkpoint state.

## Human Gate boundary

The workflow gate is fail-closed inside the governed C2C flow, but it is not a universal shell security boundary. Codex still owns edit/shell/git/test execution in the upstream architecture. Consequential production actions should later be paired with Codex sandbox/rules or a governed execution adapter so the technical enforcement matches the workflow decision.

The CLI is the trusted local lifecycle seam. It creates or reuses the one active
Gate only when Codex reaches the exact L3 effect boundary, records the Human's
GRANT or CANCEL decision, and consumes the exact GRANTED envelope. Safe mode
always rejects consume. The Gate must be durably `CONSUMED` before the exact
consequential side effect starts; consumed authorization is never replayed.

Session state remains UX/resume coordination only. Waiting for the Human keeps
the current protocol state and changes only `waitingFor` to `USER`. Governance
remains the authorization source of truth.

## V1 exclusions

Governance V1 does not provide direct production adapters, universal shell
interception, authorization history or TTL, cryptographic ChatGPT-user
provenance, upstream synchronization automation, or mobile approval. Presence
and optional Feishu notification are advisory only; Feishu is never an
authorization surface and its configuration is not required for Gate use.
