# Project setup and repair

Read this reference only for first Bind Project, an explicit switch from
long-chat to Project, Project collection/identity/settings repair, or a
confirmed conversation-level app-registry recovery. Normal coding in an
already bound Project does not preload it. The core Skill's workspace/connector
identity, browser-capability, HANDOFF, and resume rules remain authoritative.

## Bind Project (user creates the collection once)

Use this for a new workspace or when an existing user explicitly asks to switch
to Project. The user creates the collection. Use the current host-provided
built-in browser / browser-use capability only to observe and operate the
ChatGPT Web flow it supports. Generic screenshot-driven Computer Use is not the
normal control plane, and browser automation must not hunt the sidebar menu.

1. Tell the user exactly this, filling in the workspace name:

```text
请在 ChatGPT 里新建一个项目，名字用「<workspaceName>」，记忆请选择「默认记忆（Default memory）」。
只有你明确需要隔离，或该项目属于共享/敏感场景时，才选择「仅限项目记忆」。

如果侧栏里看不到「项目」：把鼠标放在「聊天」上，点右边出现的三个点，选择「按项目整理」。

建好后会打开合集页面。看到页面后跟我说「好了」。
```

2. Wait for「好了」and the collection page. In the same retained built-in
   browser tab, read the address. It must match
   `https://chatgpt.com/g/g-p-…/project`. If it does not, ask the user to open
   that Project. Then run:
   `c2c session set -w <ws> --mode project --project-url <url> --connector-name "<connectorName>"`.
3. On that collection page only, open 右上角 **… → 项目设置**. Do not click
   分享 or add 来源/files.
   - 记忆: 个人、非共享的普通 ChatGPT Pro 项目默认选择「默认记忆（Default memory）」；
     仅在用户明确要求隔离，或项目为共享/敏感场景时选择「仅限项目记忆」(project-only).
   - 库访问权限: first observe whether the current host exposes an independent
     control. If it does, prefer disabled for ordinary C2C unless the Human
     explicitly needs Library access. If it is host-coupled or read-only,
     accept and report the effective value; do not switch memory mode only to
     force Library off, and do not fail setup solely for that limitation.
   - 指令: paste the full template below, filling `{{…}}` from
     `workspace_info` / setup and using the exact `connectorName`.
   Never put a public or temporary address in the instructions. Save and close.
4. Still on the collection page, create the first chat with its on-page
   composer. Confirm Chat mode under the core browser contract, send the boot
   prompt, then verify `workspace_info` with the exact connector. Save the chat
   URL only after the reply names the expected workspace.

## Project instructions (paste into 项目设置 → 指令)

```text
ChatGPT 是该本地 workspace 的方案设计、架构与产品推理、风险/效果判断和独立审查层；
Codex 负责实现与执行。

本 Project 仅绑定：
- Workspace name: {{workspace_name}}
- Kind: {{project_type}} ({{languages}} / {{frameworks}})
- C2C connector（仅用于当前本地 workspace 事实）: {{connector_name}}

对于当前本地 workspace 的代码、git、diff、测试和已释放 command output，只使用上述
Codex with ChatGPT connector；不得使用其他 workspace 的 C2C connector 作为这些事实来源。
GitHub、Web 及其他非 C2C app 不受上述排他规则限制；当前任务需要且 host 可用时可以正常使用，
但不得替代上述 C2C connector 作为 live local workspace 事实来源。
若 workspace_info 返回不同 workspace，立即停止，不做 PLAN，也不使用本 Project memory。
不要要求任何人粘贴可由 MCP 读取的文件、diff 或日志。`EXECUTED` 后，有 readable 项时对
execution_output 先 list 再 read；若 restricted，则改从 git 审查。不得把 repo 上传到
本 Project 的 files 或 sources。
Library 可用不构成搜索或使用任意 Library 内容的授权；仅在当前任务明确需要或 Human
明确请求时使用相关内容，不检索无关文件。

按事实类型确定权威来源：
- repository/runtime 当前事实：以绑定的 C2C connector 读取的 live code、git、diff 与测试为准；
- 当前任务意图、约束与成功标准：以当前 `TASK_CONTEXT` / HANDOFF 为准；
- 稳定 workflow 与 workspace identity：以本 Project instructions 为准；
- ChatGPT account/Project memory：只作较广背景的 advisory context；陈旧或冲突时，必须让位于
  对应的 live source 或当前任务上下文。

HANDOFF 表示继续同一任务；`TASK_CONTEXT` 只携带完成当前任务所需的精简语义。按
NEXT_EXPECTED_STEP 恢复前，通过绑定的 C2C connector 重新读取需要的 live code、diff 与测试事实。

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

## Collection binding and repair

Never match a Project or chat by display name alone. Never upload the repo to
Project sources, click 分享, or edit another workspace's connector.

- **Wrong collection:** state the expected workspace name and ask the user to
  open the correct collection, then say「已找到」. Also offer「继续用长对话」.
  If they choose long-chat, run
  `c2c session set -w <ws> --mode long-chat` and follow the core long-chat path.
- **Missing or 404 collection:** offer the same choice. If they choose Project,
  repeat **Bind Project** and replace the saved `projectUrl` only after the new
  collection URL and workspace identity are verified.
- **New chat opened outside the Project:** return to the verified collection
  and create the chat from its on-page composer. Boot, send HANDOFF when
  resuming, verify workspace identity, then save the URL.
- **Wrong connector in Project behavior:** open that Project's settings and
  compare its instructions with the exact current `connectorName`. Repair only
  that field using the full template above. Never paste `mcpUrl` or another
  public/temporary address into Project instructions.
- **Conversation app-registry drift:** when an unrelated app such as GitHub is
  missing from both `@` resolution and the current Chat's Apps picker, the app
  remains installed/enabled, and a new Chat in the same Project exposes it
  normally, treat the old Chat as a host conversation-state failure. Do not
  rebuild/re-pair the C2C connector or change Project settings solely for this
  symptom. Return to the verified collection, create a new Chat there, send the
  normal boot prompt plus HANDOFF/material `TASK_CONTEXT` when resuming, verify
  `workspace_info` through the exact bound C2C connector, then save the new chat
  URL and continue. Preserve the Project and connector binding.
- **Memory/settings drift:** for a personal, non-shared ordinary Project,
  restore Default memory. Preserve project-only memory only when the user
  explicitly requested isolation or the Project is shared/sensitive. Observe
  whether Library has an independent control: prefer disabled when configurable
  unless the Human explicitly needs it; when host-coupled/read-only, accept and
  report the effective value without changing memory mode or failing repair
  solely to force Library off. Memory remains advisory and never overrides the
  applicable live connector or current `TASK_CONTEXT` / HANDOFF. Preserve the
  verified collection binding and exact connector name.

After any repair, call `workspace_info` through the named connector and require
the expected workspace name before planning, saving a new chat URL, or sending
a task control message.
