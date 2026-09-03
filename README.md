# Governed Codex with ChatGPT

> ChatGPT thinks. Codex works. Human authorizes only the real consequential step.
>
> ChatGPT 负责思考与独立审查，Codex 负责实现与执行；Human 只处理真正需要本人决定的事情。

[简体中文](README.zh-CN.md)

Governed Codex with ChatGPT is a governance-focused customized fork of
[XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt).
It keeps the upstream compatibility surface — npm package `codex-with-chatgpt`,
CLI `c2c`, and Skill install directory `~/.codex/skills/codex-with-chatgpt/` —
while adding a durable collaboration contract, minimum-sufficient governance,
Human Gate handling for real L3 effects, Issue-backed handoff, and long-lived
operating rules.

## What problem it solves

ChatGPT web subscriptions are often underused while a coding agent spends its
scarcer execution context on planning and review. This project separates those
jobs:

- **ChatGPT**: architecture/product reasoning, risk/effect judgment, scope
  discipline, planning, and independent review.
- **Codex**: local investigation, editing, build/test, git/PR work, and
  authorized execution.
- **Human**: genuine product/business choices, L3 consequential authorization,
  login/2FA/CAPTCHA, and secret entry that must be done personally.

ChatGPT reads the live workspace through a secure, OAuth-protected,
**read-only** MCP connection. The repository is not uploaded into ChatGPT.

## What this fork adds

The detailed contracts live in the docs; the important public behavior is:

- **Minimum Sufficient Governance** — L0 read-only, L1 local reversible, and
  already-authorized reversible L2 work do not gain unnecessary Human Gates.
  A real L3 consequential effect gets one Human Gate at the actual effect
  boundary.
- **Independent review** — after Codex reports `EXECUTED`, ChatGPT reads the
  real diff/test state through MCP before deciding `DONE`, another `PLAN`, or
  genuine `BLOCKED`.
- **Issue-backed handoff** — Codex reads the complete GitHub Issue and relays
  only a compact `TASK_CONTEXT` to ChatGPT. ChatGPT combines that context with
  live MCP facts; the C2C MCP itself is not expected to read GitHub Issues.
- **Durable Sync** — when a task materially changes a long-lived rule or host
  assumption, the canonical source is updated in the same change set. ChatGPT
  Memory is useful context, but it is not the synchronization database or
  source of truth.
- **Presence + optional Feishu notification** — a waiting Human Gate can be
  surfaced when the Human is away. Feishu is notification-only and can never
  authorize execution.

See [Durable Operating Model](docs/operating-model.md),
[Protocol](docs/protocol.md), and [Governance V1](docs/governance-v1.md).

## Install in one paste

Give this to Codex:

```text
Please install and configure Governed Codex with ChatGPT for me.

1. Ensure git, Node.js >= 20, and cloudflared are available. Install missing
   prerequisites yourself (macOS: Homebrew; Windows: winget).
2. Clone https://github.com/Disene/codex-with-chatgpt-governed into
   ~/codex-with-chatgpt-governed (or fast-forward that checkout if it exists).
3. In the checkout run:
   npx -y pnpm@11.24.0 install --frozen-lockfile
   npx -y pnpm@11.24.0 build
4. Copy the complete skill/ directory to
   ~/.codex/skills/codex-with-chatgpt/ and replace only the installed SKILL.md
   checkout-path placeholder with the real checkout path.
5. Follow the installed Skill's first-time setup flow. Use the host-provided
   built-in browser/browser-use capability for ChatGPT control.
6. For an ordinary personal, non-shared ChatGPT Pro Project, use Default memory.
   Use Project-only only when I explicitly want isolation or the Project is
   shared/sensitive.
7. If Library access is host-coupled/read-only, accept and report the effective
   value; do not change memory mode just to force Library off. Library being
   available is not authorization to search unrelated Library content.
8. Interrupt me only for login/2FA/CAPTCHA, a genuine product/business choice,
   or a real L3 authorization. Give me one action at a time.
9. Finish with the setup checklist and confirm the workspace read test passes.
```

Compatibility names intentionally stay unchanged:

- npm package: `codex-with-chatgpt`
- CLI: `c2c`
- installed Skill directory: `~/.codex/skills/codex-with-chatgpt/`

## Normal use

Direct task:

```text
使用 Codex with ChatGPT 完成 XXX。
```

Issue-backed task:

```text
使用 Governed C2C 处理：<Issue URL>
```

Issue-backed flow:

```text
GitHub Issue
    ↓ Codex reads the complete task contract
compact TASK_CONTEXT
    ↓
ChatGPT PLAN / independent review + live MCP facts
    ↓
Codex implementation / tests / git / authorized execution
```

A startup message can stay short because the Issue is the durable task source;
old conversation history is not replayed as task authority.

## ChatGPT Project memory and Library

For the current personal/non-shared Pro workflow, **Default memory** is the
normal choice so relevant saved/account-level context can help orientation.
Use **Project-only** when you explicitly need isolation or when shared/sensitive
boundaries require it.

Memory is advisory only. It never overrides live workspace facts, the current
`TASK_CONTEXT`/HANDOFF, or stable Project instructions.

Library availability is capability-aware. If the host exposes an independent
Library control, ordinary C2C prefers it disabled unless the task needs it. If
Library is host-coupled/read-only, setup accepts the effective value. In all
cases, Library availability is **not** authorization to search or use unrelated
Library content.

## Updates and upstream

`c2c update-check` performs a cheap daily check against the installed checkout's
own `origin HEAD`. For this Governed fork, normal self-update therefore follows
this repository's `origin/main`.

The upstream project is **not** automatically merged into the customized stable
`main`. Upstream drift is integrated only through the operating-model flow:
read-only detection → compatibility/sync branch → tests/review → PR → merge.
See [docs/operating-model.md](docs/operating-model.md).

## How it works

```text
             ┌───────────────────────────┐
             │       ChatGPT Web         │
             │ Reason / Plan / Review    │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ Built-in browser
            Data Plane  │          │ Control Plane (<1 KB)
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │
             │   read-only MCP     │
             │ OAuth + Pairing     │
             │ Tunnel Manager      │
             └──────────┬──────────┘
                        │ read-only
                        ▼
             ┌─────────────────────┐          ┌─────────────────────┐
             │   Local Workspace   │◀─────────│    Codex Harness    │
             └─────────────────────┘ edit/git │ shell / tests / fix │
                                              └─────────────────────┘
```

- **Control plane**: tiny structured `[C2C]` messages through the current
  host-provided built-in browser/browser-use capability. Generic screenshot-
  driven Computer Use is not the normal control plane.
- **Data plane**: ChatGPT pulls workspace, git, test, and released execution
  facts through read-only MCP tools.
- **Execution plane**: Codex owns editing, shell, git, tests, and authorized
  effects.

## Security model, short version

- The MCP server is read-only by construction; write/delete/shell tools are not
  exposed through the bridge.
- One workspace is one security boundary; tokens and canonical-path containment
  are workspace-scoped.
- Sensitive files are denied by default and `.c2cignore` can add local rules.
- The public MCP endpoint requires OAuth 2.1; knowing the URL grants nothing.
- Long-lived credentials do not belong in ChatGPT, GitHub Issues, docs, or
  Project sources.
- Human Gate authorization is explicit and one-shot for the exact L3 effect;
  model recommendations, Presence, and Feishu notifications never authorize.

Full threat model: [docs/security.md](docs/security.md)

## Documentation map

- New-user overview: this README / [README.zh-CN.md](README.zh-CN.md)
- Cross-task operating rules: [docs/operating-model.md](docs/operating-model.md)
- C2C protocol and collaboration: [docs/protocol.md](docs/protocol.md)
- Governance / Human Gate: [docs/governance-v1.md](docs/governance-v1.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Security: [docs/security.md](docs/security.md)
- Presence: [docs/presence-v1.md](docs/presence-v1.md)
- Notification routing: [docs/notifications-v1.md](docs/notifications-v1.md)
- Feishu local setup: [docs/feishu-setup-v1.md](docs/feishu-setup-v1.md)
- Troubleshooting: [docs/troubleshooting.md](docs/troubleshooting.md)
- Conditional setup/repair mechanics: `skill/references/`

## For developers

```bash
npx -y pnpm@11.24.0 install --frozen-lockfile
npx -y pnpm@11.24.0 typecheck
npx -y pnpm@11.24.0 build
npx -y pnpm@11.24.0 test

c2c setup
c2c sandbox-allow
c2c status / doctor / pair / unpair / logs / stop
c2c governance gate status
c2c governance notifications status
```

Requirements: Node.js >= 20, git, and `cloudflared` for the public connection.

## Project layout

```text
src/
  bridge/       local bridge and admin lifecycle
  mcp/          read-only MCP tools
  auth/         OAuth 2.1 and token lifecycle
  pairing/      one-time pairing codes
  workspace/    containment, ignore policy, search, git
  tunnel/       Quick/Named Cloudflare connection support
  execution/    execution records for independent review
  governance/   effect classification, Human Gate, Presence, notifications
  session/      C2C checkpoint/conversation state
  cli/          c2c CLI
skill/          Codex Skill and conditional references
tests/          contract/unit/integration tests
docs/           architecture, protocol, governance, operating model, security
```

## Status

**Governed C2C V1 is operational-ready** for day-to-day use. The collaboration,
Human Gate, Presence/Feishu, Context Hygiene, Issue-backed handoff, Default-memory
policy, and Durable Sync contracts have been exercised through the real workflow.

This remains an unofficial community project and is not affiliated with or
endorsed by OpenAI. Upstream credit belongs to
[XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt).

## License

[MIT](LICENSE)
