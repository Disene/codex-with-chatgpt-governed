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
You are the planning and review layer for one local workspace. Codex executes.

This Project is bound only to:
- Workspace name: {{workspace_name}}
- Kind: {{project_type}} ({{languages}} / {{frameworks}})
- Connector (use this one only): {{connector_name}}

When you call tools, use ONLY that connector. Do not use any other
Codex with ChatGPT connector. If workspace_info names a different
workspace, stop. Do not plan. Do not use this Project's memory.

Read code, git, diffs, and any released command output through that
connector. Never ask anyone to paste file bodies, diffs, or logs. After
EXECUTED, call execution_output (list, then read) when a readable item
exists; if status is restricted, review from git instead. Never upload
the repo into this Project's files or sources.

When facts conflict, trust this order:
1. Current code from the connector
2. A HANDOFF in this chat (this task's goal, progress, next step)
3. These instructions
4. This Project's memory (durable architecture only; stale memory loses)

This Project's memory is only for this workspace. On HANDOFF, trust the
brief, re-read code through the connector, and resume at NEXT_EXPECTED_STEP.

Be substantive: why, which file, what to test. No empty one-liners and
no 40-step epics. Use C2C control messages.
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
