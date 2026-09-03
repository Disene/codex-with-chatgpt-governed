# Setup, update, and repair

Read this reference only for install, first setup, update, connection choice,
reconnect, repair, or disconnect. A normal coding task does not preload it.
The core Skill's identity, browser-capability, Doctor-gate, and security rules
remain authoritative throughout these workflows.

## Install or re-install the Skill bundle

Copy the complete `skill/` directory to `~/.codex/skills/codex-with-chatgpt/`.
The installed bundle must contain `SKILL.md` and the `references/` directory.
After copying, replace the installed `SKILL.md` line beginning
`The codex-with-chatgpt checkout lives at:` with the actual checkout path.
Do not substitute the installation destination for the checkout path.

The updated Skill takes effect from the next Codex session.

## Workflow: update（"更新 Codex with ChatGPT"，or daily update available）

Inside the checkout directory from the core Skill's **Locations** section:

1. `git pull --ff-only`. If it fails because of local edits, preserve them with
   `git stash`, then retry `git pull --ff-only`.
2. Run `corepack pnpm install && corepack pnpm build`.
3. Re-install the complete Skill bundle using the workflow above, including
   both references and the actual checkout-path substitution.
4. Run `c2c sandbox-allow --json`, then `c2c restart -w <workspace>`, then
   `c2c update-check --force --json`. The last command should report up to date.
5. Tell the user `✓ 已更新到最新版本`, then resume the task that triggered the update.

## Connection choice (once per workspace)

Ask this **before** the public address exists (`c2c setup` or the first
`doctor --fix` that starts a connection). Do not mention tunnels, wrangler,
DNS, or hostnames. Speak only of 临时地址 / 固定域名 / 登录 Cloudflare.

1. `c2c tunnel status -w <workspace> --json`.
2. If `needsChoice` is false, do not ask again.
3. If `needsChoice` is true, tell the user exactly `userPrompt` and wait.
   - 没有账号 / 没有域名 / 临时 / 不用 →
     `c2c tunnel choose -w <ws> --mode quick --json`.
   - 有域名（例如 example.com）→ first tell them `loginPrompt`, then run
     `c2c tunnel choose -w <ws> --mode named --zone <domain> --json`.
     This one Cloudflare login may use the user's own browser under the core
     Skill's explicit exception. Wait until the command finishes.
     If they have an account but gave no domain, ask once for the domain. If
     the command returns `need: "zone"`, ask once and retry. If `fallback` is
     true, tell them `userMessage` and continue on the temporary address. Do
     not retry named unless they ask.
4. Keep connection credentials in the C2C state directory, never the project.

## Workflow: first-time setup（"使用 Codex with ChatGPT 完成首次配置"）

1. Detect prerequisites: `node --version` must be at least 20, and
   `cloudflared` must exist. If cloudflared is missing, install it with
   `brew install cloudflared` on macOS or
   `winget install Cloudflare.cloudflared` on Windows.
2. If the checkout has no `node_modules` or no `dist/`, run
   `corepack pnpm install && corepack pnpm build` inside it.
3. Run `c2c sandbox-allow --json`, then **Connection choice**, then
   `c2c setup -w <workspace> --json`.
   `sandbox-allow` adds the C2C state directory to Codex's sandbox writable
   roots. If the write is denied, request approval and retry once.
   Setup returns `{ mcpUrl, pairingCode, workspaceName, connectorName, ... }`.
   `connectorName` is this workspace's connector title. Legacy installs stay
   `Codex with ChatGPT`; additional workspaces use
   `Codex with ChatGPT · <name>`. Pairing codes expire in about five minutes;
   use `c2c pair --json` for a fresh one if necessary.
4. Run `c2c prefs --json` for this machine:
   - If `setupMode` is null, tell the user exactly `setupChoicePrompt` and wait
     for「1」or「2」. Then set `--setup-mode auto` or `--setup-mode manual`.
     Do not open ChatGPT settings or start configuration before the answer.
   - If the user later asks to switch, use the same prefs command. Do not ask
     again on another workspace or reconnect.
   - For `setupMode: "manual"`, skip automatic ChatGPT settings and use
     **Guided manual ChatGPT setup** with the chosen-manual opening line.
   - For `setupMode: "auto"`, continue below. Two explicit failures of the
     same configuration step after repair trigger guided manual fallback.
   `developerModeEnabled: true` means skip the Security settings page unless
   connector creation reports developer mode is required. If that happens,
   enable it and persist `c2c prefs set --developer-mode --json`.
5. Use the one visible, retained ChatGPT tab through the core Skill's
   **Built-in browser capability** contract. Navigate directly as needed:
   - Developer mode: `https://chatgpt.com/#settings/Security` (skip when the
     preference says it is enabled). Enable 开发人员模式 if needed, then persist
     `c2c prefs set --developer-mode --json`.
   - Existing exact `connectorName`: `https://chatgpt.com/plugins`. Delete that
     connector, then open the add-connector URL. Never use Reconnect.
   - Create:
     `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`.
     Operate only on `connectorName`. If that exact name exists, delete and
     recreate it; never rename, delete, or edit another workspace's connector.
     Use:
     - Description: `Securely connect ChatGPT to the current Codex workspace for planning and review.`
     - Server URL: the setup `mcpUrl`
     - Authentication: OAuth
     Fill the known form in one browser-capability operation when possible.
     Connect / Authorize and enter the pairing code. Continue as soon as the
     page reports Connected / authorized / pairing accepted; do not wait for
     all tools on the settings page.
6. In the same tab, open the first C2C chat per the core **Conversation
   management** section. A Project-mode workspace may require
   [project-setup.md](project-setup.md); long-chat uses the saved chat or the
   ChatGPT root only when no chat is saved. On a new conversation, confirm
   Chat mode using the core browser contract. Send the boot prompt from
   `docs/protocol.md`, then send:
   `Use the "<connectorName>" connector: call workspace_info and read hello-style top-level file. Reply with the workspace name.`
   Confirm the reply matches `workspaceName` before saving the chat URL. If it
   does not match, preserve the previous saved URL.
7. Report exactly this shape, without internals:

```text
Codex with ChatGPT

✓ 当前项目已识别
✓ Workspace Bridge 已启动
✓ 安全连接已建立
✓ ChatGPT 已连接
✓ 文件读取测试通过

Ready.
```

If a login wall appears, stop and give the user one action, such as
`请登录 ChatGPT，完成后告诉我「好了」`, then continue after they confirm.

## Guided manual ChatGPT setup

Enter this path when `setupMode` is `manual`, or when automatic ChatGPT
configuration fails twice at the same explicit setup/reconnect step after
doctor/repair. A browser-operation timeout, a page still loading/generating,
or waiting for login, 2FA, or CAPTCHA is not a failure. Chosen manual mode does
not wait for two failures.

Stop automating ChatGPT settings. Preserve the current local C2C state and the
current `mcpUrl`, `pairingCode`, `workspaceName`, and `connectorName`. Do not
fall back to Codex-only execution, disable C2C, or change the saved setup mode.

Opening line:

- Chosen manual: `接下来用手动教学配置。一次只需要做一个操作。`
- Failure fallback: `自动配置没有成功，我来带你手动完成。一次只需要做一个操作。`

Guide one action at a time and wait for「好了」before the next action:

1. If `developerModeEnabled` is not true, ask them to open
   `https://chatgpt.com/#settings/Security` and enable 开发人员模式. After they
   confirm, run `c2c prefs set --developer-mode`. Otherwise skip this step.
2. Ask them to open `https://chatgpt.com/plugins`. If the exact
   `connectorName` exists, delete only that connector.
3. Ask them to open the add-connector URL from first-time setup and create the
   exact `connectorName` with the same Description, current `mcpUrl`, and OAuth.
4. Ask them to Connect / Authorize and enter the current pairing code. If it
   expired, run `c2c pair --json` and give them only the fresh pairing code.
5. When they report Connected / authorized / pairing accepted, resume the
   normal setup/reconnect flow at ChatGPT verification. If verification reaches
   the same explicit failure twice, stop and report the exact failed step; do
   not loop or continue without C2C.

## Workflow: disconnect（"断开 ChatGPT"）

1. Run `c2c unpair -w <workspace>` to revoke all tokens immediately.
2. Optionally use the same built-in browser tab to open
   `https://chatgpt.com/plugins` and remove only this workspace's
   `connectorName`.
3. Tell the user: `已断开 ChatGPT 对该项目的访问。`

## Workflow: reconnect after address reclaim（全关掉以后地址失效）

This is normal after the user quits Codex, the terminal, or the machine: the
previous temporary address is gone and Doctor has started a new one.
`connectorAction: "update"` means delete and recreate, never Reconnect.

Doctor reports a `chatgptRepair` object containing `needed`, `connectorAction`,
`connectorName`, `userMessage`, `mcpUrl`, `pairingCode`, and settings pages.

1. Tell the user exactly `chatgptRepair.userMessage`, then repair. Do not ask
   them to navigate ChatGPT unless a login wall appears. Until repair finishes
   and a follow-up Doctor is green, do not open the C2C chat or send `[C2C]`.
   Reuse `c2c prefs --json`; never ask setup mode again. If it is manual, use
   **Guided manual ChatGPT setup**.
2. In the one retained built-in browser tab, use settings URLs only until
   Connected:
   - Developer mode: `https://chatgpt.com/#settings/Security`, skipped when the
     saved preference is true. If connector work says it is required, enable it
     and persist `c2c prefs set --developer-mode`.
   - Delete only: `https://chatgpt.com/plugins`.
   - Create after deletion:
     `https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins`.
3. Operate only on `chatgptRepair.connectorName`. If that exact name exists,
   delete it. Never click Reconnect, Refresh, Connect, or Edit on the old card;
   its Server URL is dead. Then create the same name with the standard
   Description, `chatgptRepair.mcpUrl`, and OAuth. Connect / Authorize with
   `chatgptRepair.pairingCode`, refreshing it with `c2c pair --json` if needed.
   Continue as soon as Connected; if the old name is already gone, only create.
4. Run `c2c doctor --json` again. Only after the Doctor gate is green, reopen
   the chat already used by this Codex thread. Address repair does not create a
   new audit/task chat or rewrite Project instructions because they store the
   connector name, not its address.
5. If the ChatGPT conversation was lost, use the core Conversation management
   path: long-chat switches conversation; project opens a new chat from its
   collection and sends boot + HANDOFF. If tools resolve the wrong connector,
   read [project-setup.md](project-setup.md) for Project identity repair.

## Workflow: repair（anything looks broken）

1. Run `c2c doctor -w <workspace> --json`. Until local state is green, do not
   open the C2C chat or send `[C2C]`; reconnect settings pages are the exception.
2. If `namedRepair.needed`, tell the user `namedRepair.userMessage`, run
   `c2c tunnel login --json`, then Doctor again. The connector address did not
   change, so do not delete the connector.
3. If `chatgptRepair.needed`, follow **reconnect after address reclaim**, then
   Doctor again.
4. Otherwise use the recovery map. Involve the user only for login, 2FA, or
   CAPTCHA, with one action at a time.

## Recovery map

| Symptom | Action |
| --- | --- |
| Bridge not running | `c2c start` (Doctor does this automatically) |
| Temporary address dead or unreachable | Run Doctor. Named repair logs in to Cloudflare without deleting the connector; ChatGPT repair deletes only this workspace's connector and recreates it. |
| ChatGPT tool call failed / 401 | Re-pair with a fresh code and authorize. |
| Pairing code rejected/expired | `c2c pair --json` for a fresh code. |
| Same explicit setup/reconnect browser step fails twice after repair | Use Guided manual ChatGPT setup. Timeouts, loading/generating, login, 2FA, and CAPTCHA waits do not count as failures. |
| Port conflict | Handled automatically; do not surface it to the user. |
| Every new chat repairs, or cannot write the state directory | `c2c sandbox-allow --json` once; do not ask the user. |
| cloudflared missing | Install it with brew/winget, then retry. |
| Project is missing, wrong, or has identity/settings drift | Read [project-setup.md](project-setup.md). |
