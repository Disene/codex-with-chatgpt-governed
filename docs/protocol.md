# C2C Agent Protocol

Control plane: the Codex host-provided built-in browser / browser-use capability
(tiny structured messages typed into the ChatGPT UI). Generic screenshot-driven
Computer Use is not the normal control plane.
Data plane: MCP (ChatGPT pulls files, diffs, search results itself).

Never mix the two: control messages carry compact task state and semantics,
never file bodies, diffs, or logs.

## States

```
INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED | ERROR
```

| State | Sender | Meaning |
| --- | --- | --- |
| INIT | Codex | New task; asks ChatGPT to inspect + plan |
| PLAN | ChatGPT | Executable plan for the next iteration |
| EXECUTING | Codex | (optional) execution in progress |
| EXECUTED | Codex | Iteration finished; metadata only |
| REVIEW | ChatGPT | (implicit) ChatGPT is inspecting via MCP |
| DONE | ChatGPT | Success criteria met |
| BLOCKED | ChatGPT | Cannot proceed; contains reason |
| ERROR | either | Protocol/infrastructure failure |
| HANDOFF | Codex | Continuation brief sent to a replacement conversation |

There is no `STATE: RESUME`. If Codex restarts mid-task, it reads a **local
checkpoint** on the session file (`protocolState`, `waitingFor`, goal, issues,
next step). Those values are not ChatGPT protocol states. ChatGPT still sees
only the table above. If the original chat is gone, Codex sends HANDOFF
built from the checkpoint (never from logs).

Local checkpoint values (session only):

| Checkpoint | Meaning |
| --- | --- |
| `INIT` | INIT sent; waiting for PLAN |
| `PLAN_RECEIVED` | PLAN in hand; not finished executing |
| `EXECUTING` | Codex is applying the current PLAN |
| `EXECUTED_LOCAL` | Recorded locally; EXECUTED not yet typed |
| `EXECUTED_SENT` | EXECUTED typed; waiting for review |
| `DONE` / `BLOCKED` | Terminal; DONE should `--clear-checkpoint` |

Legacy sessions without a checkpoint keep the old loop. The first normal
iteration after this version writes a checkpoint automatically.

Do not re-pair, recreate the connector, or rewrite Project instructions
just to resume.

## Message format

Every control message starts with `[C2C]` and key-value headers, then sections.
Keep messages < 1 KB. No diffs, no logs, no file bodies.

`TASK_CONTEXT` is an optional compact semantic brief. For an Issue-backed task,
Codex reads the current Issue itself before INIT, retains the complete frozen
contract, and distills only the goal, must-preserve constraints, key success
criteria, and material durable decisions into a target < 1 KB control message.
ChatGPT uses that brief with live MCP facts; it is never asked to fetch or read
the GitHub Issue directly.

### INIT (Codex → ChatGPT)

```
[C2C]
STATE: INIT
TASK_ID: c2c_f81a
ITERATION: 0

GOAL:
实现带持久化偏好的深色模式。

TASK_CONTEXT:
保持现有主题 API；成功标准为重载后保留偏好并通过相关测试。

INSTRUCTION:
请通过当前绑定的 Codex with ChatGPT connector/MCP 检查 live workspace，
并为 Codex 输出一份有限、具体、可执行的 PLAN。
```

### PLAN (ChatGPT → Codex)

```
[C2C]
STATE: PLAN
TASK_ID: c2c_f81a
ITERATION: 1

GOAL:
实现带持久化偏好的深色模式。

RATIONALE:
说明方案选择、范围判断与值得控制的真实风险。

ACTIONS:
1. 在相关文件中实现主题状态与持久化。
2. 增加覆盖初始加载和切换行为的测试。
3. 仅在确有 L3 后果时执行下述动作。

HUMAN_GATE:
  BEFORE_ACTION: 3
  EFFECT: L3
  ACTION: 执行真实的 L3 后果动作
  ENVIRONMENT: 目标环境
  TARGETS: 明确目标
  ALLOWED_WRITES: 已授权写入
  FORBIDDEN_WRITES: 禁止写入
  BASE_REF: ...
  ROLLBACK: 可验证的回滚方法

FILES_LIKELY_INVOLVED:
列出预计涉及的文件。

TESTS:
列出应执行的测试与验证。

SUCCESS_CRITERIA:
列出可独立审查的完成条件。
```

Plans must be finite, concrete, executable. Not 40-step epics.

`HUMAN_GATE` is optional and is only valid for a real L3 consequential action.
`BEFORE_ACTION` marks the first action that may not start without authorization.
Codex completes the earlier L0/L1/L2 work, tests, build, and read-only readiness
checks first. The existence of this block is not `STATE: BLOCKED` and does not
change the local protocol state.

### Human Gate at the L3 effect boundary

At `BEFORE_ACTION`, Codex creates or reuses the local Gate and sends machine
control information to the same ChatGPT conversation:

```
[C2C]
STATE: EXECUTING
TASK_ID: c2c_f81a
ITERATION: 1

HUMAN_GATE_READY:
  GATE_ID: gate_...
  ENVELOPE_FINGERPRINT: ...
```

ChatGPT does not repeat those identifiers in the Human-facing prompt. It shows
only what will run, the environment and targets, allowed and forbidden writes,
and rollback, then asks once: `是否授权执行这一步？`

Only after the Human explicitly answers in that same conversation may ChatGPT
return the machine decision:

```
[C2C]
STATE: PLAN
TASK_ID: c2c_f81a
ITERATION: 1

HUMAN_GATE_DECISION:
  DECISION: GRANT
  GATE_ID: gate_...
  ENVELOPE_FINGERPRINT: ...
```

This is a decision-only continuation message even though it keeps the existing
`STATE: PLAN`. When Session is waiting for `USER`, the current Gate is WAITING
or GRANTED, and the block matches that Gate, `HUMAN_GATE_DECISION` takes
precedence over generic PLAN handling. Codex processes only GRANT or CANCEL: it
does not increment the iteration, write `PLAN_RECEIVED`, execute ACTIONS, or
change the current `protocolState`. After the decision it changes only
`waitingFor` from `USER` to `none`.

`DECISION` may be `GRANT` or `CANCEL`. A model recommendation is never Human
authorization. Feishu only links back to the ChatGPT conversation and can never
authorize. While waiting, the local checkpoint keeps its current
`protocolState` and sets only `waitingFor=USER`. GRANT or CANCEL restores
`waitingFor=none`; CANCEL maps the Governance Gate to `INVALIDATED` and does not
make the task `BLOCKED`.

An ordinary request never retries a terminal Gate. For the same material
envelope, CONSUMED or INVALIDATED causes `gate request` to fail closed and
preserves the terminal Gate. Only after ChatGPT/Human explicitly choose a new
attempt may Codex pass the single `--retry` option; that creates a new WAITING
Gate and requires new Human authorization. A different material envelope is a
different consequential action and does not require `--retry`.

Before the exact consequential side effect, Codex performs the final read-only
material consistency check, then invokes Gate consume. Safe mode rejects
consume even for a GRANTED Gate. The side effect may start only after the Gate
has been durably persisted as `CONSUMED`, and must follow immediately rather
than after another long test or preflight phase.

### EXECUTED (Codex → ChatGPT)

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

Before sending EXECUTED, Codex records the iteration:
`c2c record --task c2c_f81a --iteration 1 --changed-files ... --tests ... --exit-status ok`
and, when a test/build/lint/typecheck was run, `--command` plus `--output-file`.
ChatGPT reads metadata via `execution_summary` / `test_status`. Command output
is a separate opt-in: `execution_output` (`list` then `read`). Codex nominates
the log; a **local sanitizer** decides whether ChatGPT may see the body
(tokens/paths redacted; private keys withheld entirely; size/line caps).
Restricted items appear in `list` with no body. Old records without output
stay valid. Never paste logs into the control message.

### DONE / BLOCKED (ChatGPT → Codex)

```
[C2C]
STATE: DONE
TASK_ID: c2c_f81a
ITERATION: 3

SUMMARY:
成功条件、测试与独立审查均已通过，没有剩余 blocker。
```

```
[C2C]
STATE: BLOCKED
TASK_ID: c2c_f81a
ITERATION: 3

REASON:
说明阻塞任务的真实原因。

NEEDS:
说明继续所需的单一决定或外部条件。
```

### HANDOFF (Codex → new ChatGPT conversation)

`c2c session --json` → `conversation.mode` chooses how chats are grouped.

- **long-chat:** one long-lived C2C conversation per workspace. Codex opens a
  replacement chat only when the user asks, the old chat lags, or the chat was
  lost.
- **project:** one ChatGPT Project (collection) per workspace. A new Codex
  conversation starts a new chat **inside that Project**. The same Codex
  conversation keeps using its saved chat URL.

Right after the boot prompt, Codex sends a HANDOFF so the new chat can
continue — a brief, never a data dump (the new chat re-reads code via MCP).
For an Issue-backed task, Codex refreshes only the material `TASK_CONTEXT` from
the current Codex-read Issue; it does not paste the Issue or ask ChatGPT to read
it. Authority depends on the fact type:

- repository/runtime facts: the live connector wins;
- current task intent, constraints, and success criteria: current
  `TASK_CONTEXT` / HANDOFF wins;
- stable workflow and workspace identity: Project instructions win;
- account/Project memory: advisory context only; stale or conflicting memory
  loses to the applicable live or current-task source.

```
[C2C]
STATE: HANDOFF
TASK_ID: c2c_f81a
ITERATION: 4

ORIGINAL_GOAL:
实现带持久化用户偏好的深色模式。

TASK_CONTEXT:
保持现有主题 API；成功标准为重载后保留偏好并通过相关测试。

PROGRESS:
- Iter 1-2：已实现主题 context 与开关，审查通过。
- Iter 3：已加入持久化；审查发现首次加载时开关闪烁。

CURRENT_STATE:
EXECUTED（iteration 4 的修复已应用，尚未审查）。

KNOWN_ISSUES:
需要核验 src/theme/ThemeProvider.tsx 中的首次加载闪烁修复。

NEXT_EXPECTED_STEP:
通过 git_diff 独立审查 iteration 4，并回复 PLAN 或 DONE。
```

## Loop limits

`maxIterations` (default 12, configurable in `.c2c.json`). When reached, Codex
pauses and asks the user whether to continue.

## Durable Sync Rule

At a natural phase boundary (normally Draft PR creation and again before
terminal `DONE`/merge), perform exactly one materiality check defined in
`docs/operating-model.md`. A material durable contract change updates its
canonical source in the same task/change set; a non-material result creates no
documentation churn. This workflow check adds no protocol state, Human Gate,
preflight, evidence layer, background updater, or extra review.

## Boot Prompt

Send once at the start of every new C2C conversation:

```
你是 Codex coding session 的方案设计、架构与产品推理、风险判断和独立审查层；
Codex 负责本地调查、实现、测试与已授权执行。Human 只处理真实 L3 授权、
真正的产品/业务选择、登录/2FA/CAPTCHA，以及必须亲自输入的凭证。

通过当前绑定的 connector/MCP 重新读取 live workspace 的代码、git diff、
测试与已释放输出；不要要求 Codex 或 Human 粘贴 MCP 已可读取的文件、diff 或日志。
若位于 ChatGPT Project，只使用 Project instructions 指定的 connector；workspace 错误即停止。

PLAN、review、HANDOFF 与 Human-facing 解释的语义内容默认使用简体中文；
`[C2C]`、`STATE`、`INIT`、`PLAN`、`EXECUTED`、`DONE`、`BLOCKED`、`HANDOFF`、
`HUMAN_GATE`、`GRANT`、`CANCEL` 及既有字段名保持 English，不翻译或另设别名。

HANDOFF 表示继续同一任务：以其当前任务历史为准，并通过 MCP 复核实时事实。
Human Gate 只用于真实 L3 后果边界。收到 `HUMAN_GATE_READY` 时，以简体中文向 Human
说明动作、环境、目标、允许与禁止写入及回滚，不展示 machine ID 或内部状态名，并只问一次。
仅在同一 chat 中 Human 随后明确授权时输出 `HUMAN_GATE_DECISION: GRANT`；明确取消时输出
`CANCEL`。精确 `GATE_ID` 与 `ENVELOPE_FINGERPRINT` 只放在 machine decision block；
模型建议与 Feishu 消息从不构成授权。收到 `EXECUTED` 后必须独立检查真实结果，不能仅凭
Codex 的完成声明作出 `DONE`。输出有限、具体、可执行且有实质依据的 C2C 控制消息。
```

## Project instructions

New workspaces store durable identity in the ChatGPT Project settings
(指令), not in every boot prompt. The Skill fills this template once.
Never put a public or temporary URL in the instructions — only the
connector **name**.

```
ChatGPT 是该本地 workspace 的方案设计、架构与产品推理、风险/效果判断和独立审查层；
Codex 负责实现与执行。

本 Project 仅绑定：
- Workspace name: {{workspace_name}}
- Kind: {{project_type}} ({{languages}} / {{frameworks}})
- Connector (use this one only): {{connector_name}}

调用工具时只使用上述 connector，不得使用其他 Codex with ChatGPT connector。
若 workspace_info 返回不同 workspace，立即停止，不做 PLAN，也不使用本 Project memory。
通过 connector 读取代码、git、diff、测试和已释放的 command output；不要要求任何人
粘贴可由 MCP 读取的文件、diff 或日志。`EXECUTED` 后，有 readable 项时对
execution_output 先 list 再 read；若 restricted，则改从 git 审查。不得把 repo 上传到
本 Project 的 files 或 sources。
Library 可用不构成搜索或使用任意 Library 内容的授权；仅在当前任务明确需要或 Human
明确请求时使用相关内容，不检索无关文件。

按事实类型确定权威来源：
- repository/runtime 当前事实：以 connector 读取的 live code、git、diff 与测试为准；
- 当前任务意图、约束与成功标准：以当前 `TASK_CONTEXT` / HANDOFF 为准；
- 稳定 workflow 与 workspace identity：以本 Project instructions 为准；
- ChatGPT account/Project memory：只作较广背景的 advisory context；陈旧或冲突时，必须让位于
  对应的 live source 或当前任务上下文。

HANDOFF 表示继续同一任务；`TASK_CONTEXT` 只携带完成当前任务所需的精简语义。按
NEXT_EXPECTED_STEP 恢复前，通过 connector 重新读取需要的 live code、diff 与测试事实。

角色与交付：
- ChatGPT 理解目标与约束，做高层架构/产品决策、scope 判断与真实风险分类，给出有限、
  具体、可执行的 PLAN；`EXECUTED` 后独立核验真实代码、diff 与测试，再决定
  `DONE`、另一个 `PLAN` 或真实 `BLOCKED`。仅在真实 L3 边界处理 Human Gate。
- Codex 使用自己的工程判断做本地调查、编辑、build/test/lint/typecheck、git，以及任务已
  授权的 branch/commit/push/Draft PR；直接执行允许的 L0/L1/L2，L3 仅在有效 Human Gate 后执行。
- Human 只为真正的产品/业务选择、L3 后果授权、登录/2FA/CAPTCHA，或必须亲自进行的
  secret/credential 输入而介入。routine 调查、编辑、测试、branch、Draft PR 与已授权的
  可逆 L2 不增加重复确认。

Minimum Sufficient Governance：
- L0 observe/read-only：直接执行；L1 local reversible：执行并测试；
  L2 remote reversible：已有授权时通常执行；L3 consequential：仅在真实效果边界设置
  exactly one Human Gate。
- one risk -> one control；不确定时先做 read-only investigation，不自动升级。
- 已有 Human authorization 有效，不重复询问；不默认堆叠
  Preflight -> Evidence -> Readback -> duplicate Review。
- `HUMAN_GATE_READY` 后只向 Human 展示动作、环境、目标、允许与禁止写入及回滚，并只问一次；
  不展示 machine ID 或内部状态名。仅在同一 chat 中 Human 随后明确授权/取消时，才输出
  `HUMAN_GATE_DECISION` 的 `GRANT`/`CANCEL`。精确 `GATE_ID` 与
  `ENVELOPE_FINGERPRINT` 只出现在 machine decision block；模型建议与 Feishu 永不授权。
- 不推测或扩张 scope。success criteria、tests 与 independent review 通过且无 blocker 时，
  倾向 `DONE`；PASS 后不制造 final-final review。
- 在 Draft PR creation 与 terminal `DONE`/merge 的自然 phase boundary，各执行一次
  `docs/operating-model.md` 定义的 materiality check；仅 material durable contract 变化才在
  same task/change set 更新 canonical source，NO 则不制造文档 churn。它不是新 state、Gate、
  preflight、evidence layer 或 review phase。

PLAN、review、HANDOFF、BLOCKED reason 与 Human-facing 解释的语义内容默认使用简体中文。
`[C2C]`、`STATE`、`INIT`、`PLAN`、`EXECUTED`、`DONE`、`BLOCKED`、`HANDOFF`、
`HUMAN_GATE`、`HUMAN_GATE_READY`、`HUMAN_GATE_DECISION`、`GRANT`、`CANCEL`
及既有字段名保持 English，不翻译或另设别名。C2C 回复要有实质依据，但保持精炼。
```
