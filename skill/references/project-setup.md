# Project setup and repair

Read this reference only for first Bind Project, an explicit switch from
long-chat to Project, or Project collection/identity/settings repair. Normal
coding in an already bound Project does not preload it. The core Skill's
workspace/connector identity, browser-capability, HANDOFF, and resume rules
remain authoritative.

## Bind Project (user creates the collection once)

Use this for a new workspace or when an existing user explicitly asks to switch
to Project. The user creates the collection. Use the current host-provided
built-in browser / browser-use capability only to observe and operate the
ChatGPT Web flow it supports. Generic screenshot-driven Computer Use is not the
normal control plane, and browser automation must not hunt the sidebar menu.

1. Tell the user exactly this, filling in the workspace name:

```text
请在 ChatGPT 里新建一个项目，名字用「<workspaceName>」，记忆请选「仅限项目记忆」。

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
   - 记忆: 仅限项目记忆 (project-only).
   - 库访问权限: disabled.
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
- Connector (use this one only): {{connector_name}}

调用工具时只使用上述 connector，不得使用其他 Codex with ChatGPT connector。
若 workspace_info 返回不同 workspace，立即停止，不做 PLAN，也不使用本 Project memory。
通过 connector 读取代码、git、diff、测试和已释放的 command output；不要要求任何人
粘贴可由 MCP 读取的文件、diff 或日志。`EXECUTED` 后，有 readable 项时对
execution_output 先 list 再 read；若 restricted，则改从 git 审查。不得把 repo 上传到
本 Project 的 files 或 sources。

事实冲突时，信任顺序固定为：
current code > HANDOFF > Project instructions > Project memory

- current code：connector 读取的当前事实；
- HANDOFF：本 chat 当前任务的目标、进度与下一步；
- Project instructions：本说明；
- Project memory：仅保存该 workspace 的 durable architecture，陈旧记忆失效。

HANDOFF 表示继续同一任务；它对当前任务历史优先。按 NEXT_EXPECTED_STEP 恢复前，
通过 connector 重新读取需要的 live code、diff 与测试事实。

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
- 不推测或扩张 scope。success criteria、tests 与 independent review 通过且无 blocker 时，
  倾向 `DONE`；PASS 后不制造 final-final review。

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
- **Memory/settings drift:** restore project-only memory and disabled library
  access. Preserve the verified collection binding and exact connector name.

After any repair, call `workspace_info` through the named connector and require
the expected workspace name before planning, saving a new chat URL, or sending
a task control message.
