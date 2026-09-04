---
name: codex-with-chatgpt
description: >
  Use ChatGPT (web) as the planning and review brain for Codex coding sessions,
  while Codex keeps full execution ownership. Use when the user says
  "使用 Codex with ChatGPT ..." / "Set up Codex with ChatGPT" / "用 ChatGPT 规划",
  when they ask to connect ChatGPT to the current workspace, disconnect it,
  or run a task through the ChatGPT planning loop.
---

# Codex with ChatGPT

ChatGPT thinks. Codex works.

You (Codex) own execution: local investigation, editing, shell, git, tests,
authorized effects, and recovery. ChatGPT owns architecture/product reasoning,
planning, real-effect risk judgment, scope discipline, independent review, and
debug strategy.
The C2C Bridge gives ChatGPT read-only MCP access to the current workspace, so
control messages between you and ChatGPT stay tiny (< 1 KB) — ChatGPT pulls
whatever data it needs by itself.

For an Issue-backed task, Codex reads the current GitHub Issue itself, retains
the complete frozen contract, and sends ChatGPT only a compact `TASK_CONTEXT`
with the goal, must-preserve constraints, key success criteria, and material
durable decisions. Target the whole control message at < 1 KB. Never ask
ChatGPT to fetch or read the Issue directly. Repository/runtime facts come from
the live connector; current task intent comes from current `TASK_CONTEXT` /
HANDOFF; account/Project memory is advisory only and loses when stale or in
conflict with the applicable live or current-task source.

Human involvement is reserved for genuine product/business choices, real L3
authorization, login/2FA/CAPTCHA, and secret entry. Codex uses its own engineering
judgment for allowed L0/L1/L2 work. Durable Minimum Sufficient Governance lives in
Project instructions; keep the Boot Prompt short. Default human-readable semantic
content in PLAN/review/HANDOFF/Human-facing explanations to Simplified Chinese,
while existing C2C machine tokens, enums, and field names stay in English.

**Golden rules**

1. NEVER paste file contents, diffs, or logs into ChatGPT. ChatGPT reads them through MCP.
2. NEVER show the user technical internals (MCP, OAuth, PKCE, tunnel, ports, localhost).
   Speak in terms of "连接 ChatGPT / 安全连接 / 配对". During guided manual
   setup, expose only the exact settings field labels/values the user must
   enter, without explaining internals.
3. The pairing code is the ONLY credential you may ever type into a browser.
   Never touch OAuth tokens, cookies, or session storage.
4. If something fails, run `c2c doctor` and repair silently. Only involve the user
   for logins, CAPTCHA, 2FA, explicit consent screens, or guided manual ChatGPT
   setup — and then give them ONE action. Load the setup/repair reference only
   when the observed state enters one of those lifecycle branches.
5. Use the current Codex host's built-in browser / browser-use capability for
   every ordinary ChatGPT Web step. Follow **Built-in browser capability
   (ChatGPT)** below. Generic screenshot-driven Computer Use is not the normal
   control plane. NEVER launch or control a third-party/external browser
   (Chrome, Safari, Edge…), and never use `open <url>` to hand off to one.
   - The ONLY exception: the user explicitly says the Cloudflare login must use
     their own browser session — that single Cloudflare login step may go through
     their browser; everything else stays in the built-in browser.
   - If the user asks to run ChatGPT in their own browser, refuse politely and
     explain: "Codex 需要持续调用 ChatGPT 和配置连接，这会频繁操作页面，可能影响
     你浏览器的正常使用。ChatGPT 只能跑在内置浏览器里。" Only if the user replies
     with an explicit "我愿意承担影响" may you proceed in their browser; otherwise
     keep ChatGPT in the built-in browser, every time they ask.
6. Conversation reuse depends on `c2c session --json` → `conversation.mode`
   (see Conversation management). Do not invent a second mode.
   - **long-chat** (legacy session file, or the user opted out): ONE ChatGPT
     conversation per workspace. Never silently start a new chat.
   - **project** (new workspaces, or an existing workspace that opted in):
     ONE ChatGPT Project (collection) per workspace. Same Codex conversation
     reuses the ChatGPT chat URL saved in THIS thread. A new Codex
     conversation opens a new chat from the Project collection page — never
     navigate to `https://chatgpt.com/` to create it, and never reuse another
     Codex conversation's chat URL just because `session.url` exists.
   Each workspace also has exactly ONE ChatGPT connector. Do not create a
   second connector for the same workspace. Other workspaces may have their
   own connectors — never edit those. This connector exclusivity is only among
   C2C workspace connectors: GitHub, Web, and other non-C2C apps may be used
   when the task needs them, but they never replace the bound C2C connector as
   the source of live local-workspace facts.
7. After first-time setup, never ask the user to approve writing C2C's local
   settings directory. Run `c2c sandbox-allow --json` (idempotent). If it fails
   with EPERM / Operation not permitted, request elevated permissions and retry
   ONCE. After `{ "alreadyAllowed": true }` or `{ "added": true }`, stay silent.
8. ChatGPT pages: only the URLs in **Built-in browser capability (ChatGPT)**. Never start
   from chatgpt.com and click through menus.
9. **Doctor gate.** After `c2c doctor --json`, do not navigate to ChatGPT and do not
   send `[C2C]` until local is green — except the reconnect settings pages when
   `chatgptRepair.needed` is true. Not green:
   - `report.bridge.ok` is not true
   - `report.mcp.ok` is not true (unauthenticated local `/mcp` must be 401)
   - sandbox / state-dir write failed (EPERM)
   - this workspace used to have a public URL and the tunnel is down
   - `chatgptRepair.needed` is true (fix the connector first, then doctor again)
   - `namedRepair.needed` is true (user must log in to Cloudflare, then doctor again.
     Do not Delete the ChatGPT connector — the address did not change)
   - `report.bridge` says 状态无法确认: the local bridge may still be running.
     Do not `c2c start`, do not Delete the connector, do not treat it as
     `chatgptRepair`. Wait and run doctor again.
   A ChatGPT-side 401 after a sent message is different: repair then, do not
   treat it as permission to skip this gate next time.
10. **Durable Sync Rule.** At a natural phase boundary (normally Draft PR
   creation and again before terminal `DONE`/merge), ask exactly one materiality
   question from `docs/operating-model.md`. If the task materially changed a
   durable rule, external-product assumption, cross-task decision, or live
   Project-instructions contract, update its canonical source in the same
   task/change set. Otherwise do nothing. This is a workflow check, not a new
   protocol state, Human Gate, preflight, evidence layer, or review phase.

## Built-in browser capability (ChatGPT)

Use the current Codex host-provided built-in browser / browser-use capability.
Depend only on the capability contract exposed by the current host, never an
undocumented runtime API or helper name. If that capability is unavailable,
fail closed: do not substitute generic screenshot-driven Computer Use. For a
setup, reconnect, or repair branch, load the setup/repair reference and guide
the user manually; for a normal coding loop, report that ChatGPT Web control is
unavailable and stop before sending or duplicating a control message.

1. **One visible tab.** Create or claim one ChatGPT tab through the available
   built-in browser capability. Reuse that tab for the session and navigate it
   directly; never open a second ChatGPT tab or reload the URL already shown.

2. **Foreground + keep (standby).** Keep setup and ChatGPT chatting visible so
   the user can watch. Preserve the tab across turns and waits when the host
   offers retention/handoff semantics, without depending on any particular
   helper name. Never close the tab. Finished, waiting for the user, or timed
   out: leave it available in standby.

3. **URLs only** (same tab, direct navigation — never hunt menus):
   - 开发人员模式: `https://chatgpt.com/#settings/Security`
     (skip when `c2c prefs --json` has `developerModeEnabled: true`)
   - 插件总管: `https://chatgpt.com/plugins`
   - 加插件: `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`
   - 新对话 (long-chat only, and only if no saved chat): `https://chatgpt.com/`
   - Saved C2C chat: `conversation.chatUrl` / `session.url` (long-chat, or
     the chat already bound in THIS Codex conversation)
   - Saved Project collection: `conversation.projectUrl`
     (`https://chatgpt.com/g/g-p-…/project`)
   Never click Reconnect / Refresh on an existing connector. The old address is
   dead and that page hangs on "This site cannot be reached". When the address
   changed: Delete THIS workspace's `connectorName` only, then create it again
   via the 加插件 URL (same name, new Server URL). Do not put that public
   address into Project instructions — write the connector **name** only.

4. **Do not wait for 8 tools** on the settings page. "Connected" / authorize
   success / pairing accepted is enough. Confirm tools in the conversation with
   `workspace_info`.

5. **Batch.** Fill a known form in one browser-capability operation when you
   can. After an action, make one cheap DOM check. Do not screenshot-poll.

6. **One conversation, Chat mode.** The first ChatGPT chat is the C2C
   conversation. Chat and Work (聊天 / 工作) are separate: a Work conversation
   cannot become Chat. On every NEW conversation, if a Chat/Work switcher is
   visible (often top-left), confirm **Chat** is selected before the boot
   prompt. If it is Work, do not continue there — Switch to a new Chat
   conversation (HANDOFF). If no switcher is visible, do not hunt menus; continue.
   Send the boot prompt and the workspace_info check in that Chat conversation.
   Confirm the reply names the current workspace **before** saving or replacing
   the session URL. If validation fails, keep the old saved URL. Do not open a
   throwaway verify chat and later another C2C chat.

7. **Wait for a ChatGPT reply (do not hold one long browser wait).** After you
   send INIT, EXECUTED, boot, or the workspace_info check, keep the tab visible
   and stay in this same task. Do not hold one browser wait for 5 minutes
   and do not screenshot-poll. Every 20–30 seconds, one cheap DOM check:
   - still generating → wait again (do not type, do not resend);
   - `STATE: PLAN` / `DONE` / `BLOCKED` / the verify workspace name → read it
     and continue the existing protocol;
   - visible error → repair; do not start a new chat.
   A browser-operation timeout is not failure. Reuse the same tab, read the page, keep
   standby. If ChatGPT is still thinking, keep polling. Never open a second
   tab and never resend INIT/EXECUTED just because a wait timed out.

## Locations

- The codex-with-chatgpt checkout lives at: `<ACTUAL_CHECKOUT_PATH>`
  (installer/update MUST replace this line in the installed Skill with the user's actual checkout path.)
- CLI: let `<checkout>` mean the path on the previous line; run
  `node "<checkout>/bin/c2c.js" <command>` (or `c2c <command>` if globally linked).
  All commands support `--json` for parsing.
- If the checkout has no `node_modules` or no `dist/`, first run
  `corepack pnpm install && corepack pnpm build` inside it.
- Always pass `-w <workspace root>` (the project the user is working on, NOT the c2c repo).

## Daily update check

At the START of every workflow below (before anything else), run these two
commands (both are cheap / cached; never mention them unless an update exists):

1. `c2c update-check --json`
2. `c2c sandbox-allow --json` — writes the C2C state directory into Codex's
   sandbox `writable_roots` (macOS: `~/Library/Application Support/codex-with-chatgpt`;
   Windows: `%LOCALAPPDATA%\codex-with-chatgpt`; config file is
   `~/.codex/config.toml` on both, or `%USERPROFILE%\.codex\config.toml` on Windows).
   If already allowlisted, this is a no-op and does not trigger elevation.

- `{ "updateAvailable": false }` → continue silently. Never mention the check.
- `{ "updateAvailable": true }` → tell the user one line:
  "检测到 Codex with ChatGPT 有新版本，我先更新一下（约 1 分钟），随后继续你的任务。"
  Then read [setup-and-repair.md](references/setup-and-repair.md), run its
  update workflow, and CONTINUE the original task afterwards.

## Conditional references

- **Lifecycle only:** For setup, update, reconnect, repair, or disconnect, read
  [setup-and-repair.md](references/setup-and-repair.md) before acting.
- **Project binding / host app-registry recovery:** For first Bind Project,
  Project repair, or the confirmed conversation-level app-registry symptom
  described below, read [project-setup.md](references/project-setup.md) before
  acting.
- **Normal coding:** read neither reference unless the current observed state
  enters one of those explicit branches.

## Conversation management

`c2c session -w <ws> --json` → `{ session, conversation }`.
`conversation.mode` is the only switch. Missing / legacy files with a chat URL
and no Project stay **long-chat**. Do not ask those users to migrate. If they
later say they want a Project, run **Bind Project**. A brand-new workspace
(no session file) is **project**.

Never match a Project or a chat by display name. Never upload the repo to
Project sources. Never click 分享 / Share. Do not rename ChatGPT chats.

### long-chat (do not rewrite this path)

ONE ChatGPT conversation per workspace. Same as before.

- **Find it**: if `conversation.reuseSavedChat` and `conversation.chatUrl`,
  navigate the retained built-in browser tab to that URL and continue there.
- **Save it**: after boot + workspace_info, and the reply names this workspace,
  `c2c session set -w <ws> --mode long-chat --url <url> --title "C2C <workspace name>"`.
  If the name does not match, do not overwrite a previously saved URL.
- **Update it**: after each EXECUTED/DONE,
  `c2c session set -w <ws> --task <id> --iteration <n> --state <STATE>`
  plus checkpoint flags from the coding workflow (`--protocol-state`,
  `--waiting-for`, `--goal`, `--next-step`, `--known-issues`, or
  `--clear-checkpoint` on DONE). Do not put logs or diffs in those fields.
- **Switch it** ONLY when (a) the user asks for a new chat, (b) the current
  chat visibly lags, or (c) this conversation is Work. Then:
  1. In the same built-in browser tab, navigate to `https://chatgpt.com/`,
     confirm Chat mode (**Built-in browser capability** §6), then send the boot prompt.
  2. Send a HANDOFF (`docs/protocol.md`) — goal, progress, state, issues,
     next step, and for an Issue-backed task only the refreshed material
     `TASK_CONTEXT` from the Codex-read Issue. Never paste files or the Issue.
  3. workspace_info check; only then `c2c session set --url`. On failure,
     leave the old saved URL unchanged.
- Saved chat 404s: treat as a switch. Reconstruct HANDOFF from
  `session.checkpoint` (goal, progress, issues, next step). If there is no
  checkpoint, use `task` / `iteration` / `lastState` and `execution_summary`
  metadata only. Never paste logs or output bodies.

### project (new workspaces)

One ChatGPT Project per workspace. Mapping:

1. Same Codex conversation (this thread still has context) → same ChatGPT
   chat URL. Navigate directly to that URL. Do not open the collection first.
2. Same workspace, a **new** Codex conversation → new ChatGPT chat from the
   collection page (`conversation.projectUrl`). Ignore `session.url` unless
   you already saved it earlier in THIS Codex thread.
3. Different workspace → different Project and different connector.

**Open a chat in this Codex thread**

- If you already saved a ChatGPT chat URL earlier in THIS Codex conversation:
  navigate to that URL. Continue. No new chat. No HANDOFF.
- Else if `conversation.projectReady`: navigate to `conversation.projectUrl`.
  On that page, use the on-page composer (「{项目名}中的新聊天」 / "New chat
  in …"). Do not use the sidebar and do not navigate to `https://chatgpt.com/`.
  Confirm Chat mode (**Built-in browser capability** §6). Boot prompt, then workspace_info
  with the **exact** `connectorName`. After the reply names this workspace,
  `c2c session set -w <ws> --mode project --project-url <collection> --url <chat> --connector-name "<connectorName>" --title "C2C <workspace name>"`.
  If this Codex thread is continuing a previous C2C task, send HANDOFF right
  after the boot prompt. For an Issue-backed task, Codex reads the current
  Issue and refreshes only its material compact `TASK_CONTEXT`; ChatGPT does
  not fetch the Issue.
- Else: read [project-setup.md](references/project-setup.md), then Bind Project.

**Update it**: same `c2c session set --task / --iteration / --state` as long-chat.

**Project binding or repair**: if the expected collection is missing/wrong, a
new chat lands outside it, Project identity/settings drift, or the confirmed
conversation-level app-registry symptom occurs, read
[project-setup.md](references/project-setup.md). The app-registry symptom is:
an unrelated app disappears from both `@` resolution and the current Chat's
Apps picker, that app remains installed/enabled, and a new Chat in the same
Project exposes it normally. For that symptom, do not treat it as connector
repair. Normal coding in an already bound Project does not load this reference.

**Saved chat 404s** (this thread): navigate to the collection, open a new chat
there, boot + HANDOFF from `session.checkpoint` (no logs) + workspace_info,
then save the new chat URL. Keep `--project-url`.

## Workflow: coding task（"使用 Codex with ChatGPT 完成 XXX"）

Protocol states sent to ChatGPT: INIT → PLAN → EXECUTING → EXECUTED → REVIEW → (PLAN | DONE | BLOCKED).
Local checkpoint states (session only, never a ChatGPT `STATE:` line):
`INIT`, `PLAN_RECEIVED`, `EXECUTING`, `EXECUTED_LOCAL`, `EXECUTED_SENT`, `DONE`, `BLOCKED`.
Do not invent `STATE: RESUME`. If the original chat is gone, send HANDOFF.
All control messages start with `[C2C]`. Keep Codex→ChatGPT messages under 1 KB.
ChatGPT's replies are expected to be substantive (see step 3). Docs: `docs/protocol.md`.

Before INIT for an Issue-backed task, Codex must read the current Issue itself
and freeze it as the complete execution contract. Distill only the goal,
must-preserve constraints, key success criteria, and material durable decisions
into optional `TASK_CONTEXT`; never paste the full Issue and never instruct
ChatGPT to read GitHub. Refresh that compact context in a later HANDOFF when the
Issue contract has materially changed.

**Decision-only precedence:** before generic `STATE: PLAN` handling, check for
a `HUMAN_GATE_DECISION` block. When Session is `waitingFor=USER`, the current
Gate is WAITING or GRANTED, and the block matches its exact gate ID and
fingerprint, this message is only a continuation of the current execution. Do
not increment iteration, set `PLAN_RECEIVED`, execute or re-execute ACTIONS, or
change the current `protocolState`. Process only GRANT/CANCEL, then change only
`waitingFor` from `USER` to `none`.

0. `c2c tunnel status -w <workspace> --json`. If `needsChoice`, read
   [setup-and-repair.md](references/setup-and-repair.md) and follow its
   Connection choice (existing installs: ask once, then remember).
   Then `c2c doctor -w <workspace> --json` (auto-repairs). **Doctor gate:** if local
   is not green, do not open ChatGPT and do not send INIT. For
   `namedRepair.needed` or `chatgptRepair.needed`, read the same lifecycle
   reference and complete the matching repair, then run doctor again. Continue
   only when the gate is green.
   Generate task id: `c2c_` + 4 random hex chars — unless a checkpoint already
   has one (reuse that id; do not mint a second task).
1. `c2c session -w <workspace> --json`. Open ChatGPT in the same retained,
   visible built-in browser tab per **Conversation management** for
   `conversation.mode`. long-chat: saved chat, or `https://chatgpt.com/` if none.
   project: this thread's chat URL, or the collection page for a new chat,
   or read [project-setup.md](references/project-setup.md) and Bind Project if
   `projectReady` is false. On a NEW conversation confirm Chat mode
   (**Built-in browser capability** §6), then send the boot prompt from
   `docs/protocol.md` §Boot Prompt and the workspace_info check (name the
   exact `connectorName`). Confirm the reply names the current workspace
   before saving the session URL. Do not use the browser to re-read code MCP
   already provides. After sending a control message, wait per
   **Built-in browser capability** §7.

   **Resume from `session.checkpoint` before any INIT.** Missing checkpoint
   (legacy session): continue as a normal new/continued loop. A browser-operation
   timeout is not a lost task — reuse the original tab; do not INIT, re-run,
   or resend EXECUTED just because a wait timed out.
   - If `waitingFor=USER`, run
     `c2c governance gate status -w <ws> --json` before interpreting the
     checkpoint state. WAITING means keep the same `protocolState`, Gate, and
     chat and continue waiting. GRANTED means do not ask again: set the same
     `protocolState` with `waitingFor=none`, return to the marked L3 boundary,
     and continue with the final check and consume. CONSUMED is fail-closed:
     do not replay the effect or automatically request another Gate; establish
     the real outcome first, and request again with `--retry` only for
     an explicit retry.
     INVALIDATED means skip that consequential action and clear only
     `waitingFor`; it does not make the task BLOCKED or permit an automatic
     repeat. The same action may be requested again only with `--retry` after
     ChatGPT/Human explicitly choose a new attempt.
   - `EXECUTED_SENT` + `waitingFor=GPT_REVIEW`: do not INIT, do not re-run,
     do not resend EXECUTED. Stay on the saved chat and wait for review. If
     that chat 404s: HANDOFF from checkpoint fields (no logs), then wait.
   - `EXECUTED_LOCAL`: local work is done; only send EXECUTED (record first
     if this iteration has no record yet). Do not re-run.
   - `EXECUTING`: not finished. Continue the current PLAN if you still have
     it; otherwise HANDOFF and ask ChatGPT to restate the last PLAN. Do not
     treat it as done and do not INIT a new task.
   - `PLAN_RECEIVED`: execute that plan. Do not INIT.
   - `INIT` / `waitingFor=GPT_PLAN`: claim the tab and wait. Do not resend INIT.
   - `DONE`: summarize to the user if needed; `c2c session set --clear-checkpoint`.
   - `BLOCKED`: surface ChatGPT's reason; do not INIT.
   Never re-pair, never recreate the connector, and never rewrite Project
   instructions just to resume.
2. Send INIT with the user's goal (skip when the checkpoint says not to):

```
[C2C]
STATE: INIT
TASK_ID: c2c_f81a
ITERATION: 0

GOAL:
<用简体中文概括用户目标，一段即可>

TASK_CONTEXT:
<可选；Issue-backed 时由 Codex 提炼必要语义，使整条控制消息目标小于 1 KB>

INSTRUCTION:
请通过当前绑定的 Codex with ChatGPT connector/MCP 检查 live workspace，
并输出一份有限、具体、可执行的 C2C PLAN。
```

   Then:
   `c2c session set -w <ws> --task <id> --iteration 0 --state INIT --protocol-state INIT --waiting-for GPT_PLAN --goal "<short goal>" --next-step "wait for PLAN"`
3. Wait for ChatGPT's `STATE: PLAN` reply (**Built-in browser capability** §7 — short DOM
   checks, same tab; do not treat a 5-minute browser timeout as failure).
   Read GOAL/ACTIONS/TESTS/SUCCESS_CRITERIA.
   A PLAN may include one `HUMAN_GATE` block with `BEFORE_ACTION`, but only for
   the exact L3 consequential action. That marker does not block earlier
   actions and does not change the protocol state.
   A good PLAN also carries RATIONALE and concrete Simplified-Chinese edit
   suggestions (which file, what to change, why). If the reply is a bare
   one-liner with no rationale or file-level guidance, ask once:
   "请补充方案依据，以及逐文件说明改什么、为什么改。"
   Then:
   `c2c session set -w <ws> --protocol-state PLAN_RECEIVED --waiting-for none --next-step "execute PLAN"`
4. Execute the plan yourself with your own harness (your tools, your judgment;
   ChatGPT does not micro-manage tool calls).
   Before you start:
   `c2c session set -w <ws> --protocol-state EXECUTING --waiting-for none --next-step "finish PLAN then record"`

   If the PLAN has a `HUMAN_GATE`, first complete every allowed action before
   `BEFORE_ACTION`: local edits, tests/build, reversible preparation, read-only
   readiness and material consistency checks. Do not request the Gate when the
   PLAN first arrives. At the marked boundary:

   1. Write only the `ExecutionEnvelopeInput` fields from the block to a local
      temporary JSON file. Do not construct Governance state JSON.
   2. Run
      `c2c governance gate request -w <ws> --envelope-file <file> --json`.
      The CLI creates or reuses the exact envelope and Gate. Same WAITING or
      GRANTED authorization is reused; do not ask the Human twice. Ordinary
      boundary handling never adds `--retry`. If the same-material Gate is
      terminal (CONSUMED or INVALIDATED), the request must fail closed and must
      not execute the effect or create a Gate. For CONSUMED, establish the prior
      effect's actual result first; for INVALIDATED, preserve the Human's cancel
      decision. Only after ChatGPT/Human explicitly choose a new attempt may
      Codex run the same request with `--retry`. That creates a new WAITING Gate
      and requires a new Human authorization; retry is never automatic.
   3. If the Gate is WAITING, keep the current checkpoint state (normally
      `EXECUTING`) and set only `waitingFor=USER`. Send `HUMAN_GATE_READY` with
      the returned machine gate ID and fingerprint to the same ChatGPT chat.
      ChatGPT must not show those IDs or internal state names in its Human
      prompt. It shows the action, environment, targets, allowed/forbidden
      writes and rollback in Simplified Chinese, then asks once:
      `是否授权执行这一步？`
   4. Grant only after all workflow provenance conditions hold: the local Gate
      is WAITING; Session is waiting for USER; that exact Gate was shown in the
      same chat; the Human subsequently gave explicit consent; and ChatGPT
      returned a `HUMAN_GATE_DECISION` block with `DECISION: GRANT` and the
      exact current gate ID and fingerprint. This decision-only continuation
      takes precedence over generic PLAN handling. A model recommendation
      never qualifies. Feishu never qualifies. Run
      `c2c governance gate decide -w <ws> --decision grant --gate-id <id> --fingerprint <fingerprint> --json`,
      then set the same checkpoint state with `waitingFor=none`.
   5. For a `HUMAN_GATE_DECISION` block with `DECISION: CANCEL`, verify the
      same identifiers, run
      `c2c governance gate decide -w <ws> --decision cancel --gate-id <id> --fingerprint <fingerprint> --json`,
      and set the same checkpoint state with `waitingFor=none`. Do not execute
      that action and do not force the task to BLOCKED; continue safe work or
      wait for the next PLAN/DONE/BLOCKED response.
   6. For GRANTED, perform only the final read-only consistency and target
      checks, then run
      `c2c governance gate consume -w <ws> --gate-id <id> --envelope-file <file> --json`.
      Safe mode or any identity/material mismatch must stop the action. Only
      after status is durably CONSUMED may the exact consequential side effect
      begin, and it must begin immediately rather than after more tests or a
      new preflight phase.

   Gate CLI commands never update Session. Always preserve the current
   `protocolState` while changing `waitingFor`. Governance is authoritative:
   `waitingFor=none` never permits an effect while the Gate is still WAITING.
5. Record the execution so ChatGPT can read it via MCP. Metadata always:
   `c2c record -w <ws> --task c2c_f81a --iteration 1 --changed-files "src/a.ts,src/b.ts" --tests "27 passed" --exit-status ok`
   If this iteration ran a **test / build / lint / typecheck** command, also
   pass that command's output. Write stdout/stderr to a local temp file first,
   then:
   `c2c record … --command "pnpm test" --output-file <temp> --exit-code <n>`
   Record both success and failure. Do not record shell history, `.env`,
   keys, or unrelated dumps. Never paste that file (or any log) into ChatGPT.
   If the CLI says the output was not released, still send EXECUTED; ChatGPT
   reviews from git. Then:
   `c2c session set -w <ws> --iteration 1 --state EXECUTED --protocol-state EXECUTED_LOCAL --waiting-for none --next-step "send EXECUTED"`
6. Send EXECUTED (no diffs, no logs). Tell ChatGPT to use MCP, including
   `execution_output` when a readable item exists:

```
[C2C]
STATE: EXECUTED
TASK_ID: c2c_f81a
ITERATION: 1

RESULT:
本轮执行已完成。

CHANGED_FILES:
4

TESTS:
27 项通过

请通过 MCP 独立检查 live workspace 与当前 git diff。
如果 execution_output 列出本 iteration 的 readable 项，请先 list 再 read；
如果状态为 restricted，请忽略正文并改从 git_diff 审查。
```

   Then:
   `c2c session set -w <ws> --protocol-state EXECUTED_SENT --waiting-for GPT_REVIEW --next-step "wait for PLAN or DONE"`
7. ChatGPT reviews via MCP (`git_diff`, `read_file`, `test_status`,
   `execution_output`) and replies DONE / PLAN (next iteration) / BLOCKED.
8. Loop. Respect maxIterations (`.c2c.json`, default 12). At the limit, pause and ask
   the user: "已完成 12 轮协作，仍有未解决问题，是否继续？"
9. On DONE: summarize the result to the user in plain language.
   `c2c session set -w <ws> --state DONE --clear-checkpoint`
10. On BLOCKED: read ChatGPT's reason, fix what you can, or surface in Simplified
    Chinese the single decision the user must make.
    `c2c session set -w <ws> --protocol-state BLOCKED --waiting-for USER --known-issues "<short reason>"`