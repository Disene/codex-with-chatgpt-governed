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

## V1 exclusions

The first implementation intentionally excludes Feishu, presence detection, CLI integration, upstream synchronization automation, direct production adapters, and mobile approval. Those are later phases after the governance core is stable.
