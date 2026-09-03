# Governed Codex with ChatGPT

[English](README.md) | **简体中文**

> ChatGPT 负责方案、风险判断与独立审查；Codex 负责实现与执行；Human 只处理真正需要本人决定的事情。

这是 [XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt) 的治理增强定制 fork。
为了兼容现有工具链，以下标识继续保持不变：

- npm package：`codex-with-chatgpt`
- CLI：`c2c`
- Skill 安装目录：`~/.codex/skills/codex-with-chatgpt/`

项目对外品牌为 **Governed Codex with ChatGPT**。

## 解决什么问题

把 ChatGPT 网页版作为 Codex coding session 的“方案设计与独立 Review 层”，而把本地调查、实现、测试、git 和已授权执行留给 Codex。

ChatGPT 不需要你上传仓库。它通过 OAuth 保护的**只读 MCP** 按需读取当前 workspace 的代码、git、测试和已释放执行结果。

角色边界：

- **ChatGPT**：架构/产品推理、风险/效果判断、scope discipline、PLAN、独立 Review。
- **Codex**：本地调查、编辑实现、build/test、git/PR、已授权执行。
- **Human**：真正的产品/业务选择、L3 consequential authorization、登录/2FA/CAPTCHA，以及必须本人输入的凭证。

## Governed 版本增加了什么

### Minimum Sufficient Governance

治理既有“下限”，也有“上限”：

- L0 只读观察：直接执行；
- L1 本地可逆：执行并测试；
- L2 远端可逆：已有授权时通常直接执行；
- L3 consequential：只在真实效果边界设置一个 Human Gate。

不会因为“用了治理”就给普通代码修改、测试、branch、Draft PR额外增加重复确认。

### 独立 Review

Codex 返回 `EXECUTED` 后，ChatGPT必须通过 MCP亲自检查真实代码、git diff和测试记录，再决定：

- `DONE`
- 下一轮 `PLAN`
- 真正的 `BLOCKED`

不会因为 Codex说“已经完成”就直接相信。

### Issue-backed handoff

对于有 GitHub Issue 的任务：

```text
GitHub Issue
    ↓ Codex读取完整任务合同
精简 TASK_CONTEXT
    ↓
ChatGPT PLAN / Review + live MCP事实
    ↓
Codex实现 / 测试 / git / 已授权执行
```

GitHub Issue 是 Codex侧 durable task source；C2C MCP本身不要求 ChatGPT直接读取 Issue。

### Durable Sync

如果一个任务真的改变了长期规则、外部产品假设、跨任务工作方式或 Project instructions 合同，就在同一 change set 内同步对应 canonical source。

如果没有 material durable change，就不制造文档 churn。

ChatGPT Memory只是辅助背景，不是同步数据库，也不是权威源。

### Presence + Feishu（可选）

当 Human Gate 正在等待且你离开电脑时，可以用 Presence判断通知路由，并通过飞书提醒你回来 ChatGPT处理。

**飞书永远只能通知，不能授权。**

详细合同见：[长期运营模型](docs/operating-model.md)、[协议](docs/protocol.md)、[Governance V1](docs/governance-v1.md)。

## 一段话安装

把下面内容发给 Codex：

```text
请帮我完整安装并配置 Governed Codex with ChatGPT。

1. 检查 git、Node.js >= 20、cloudflared；缺少的依赖自行安装
   （macOS 用 Homebrew，Windows 用 winget）。
2. 克隆：
   https://github.com/Disene/codex-with-chatgpt-governed
   到 ~/codex-with-chatgpt-governed；已存在则只做安全 fast-forward 更新。
3. 在 checkout 中执行：
   npx -y pnpm@11.24.0 install --frozen-lockfile
   npx -y pnpm@11.24.0 build
4. 把完整 skill/ 目录复制到：
   ~/.codex/skills/codex-with-chatgpt/
   并且只替换已安装 SKILL.md 中的实际 checkout path。
5. 按 Skill 的 first-time setup 流程配置 ChatGPT；普通控制面使用当前 host 提供的 built-in browser/browser-use capability。
6. 普通个人、非共享 ChatGPT Pro Project 默认使用 Default memory；只有明确需要隔离，或 Project 属于共享/敏感场景时才使用 Project-only。
7. 如果 Library access 是 host-coupled/read-only，就接受并报告实际状态，不要为了强制关闭 Library 而切换 Memory mode。Library 可用也不等于可以随意搜索无关 Library 内容。
8. 只有登录/2FA/CAPTCHA、真正业务选择或真实 L3授权才打断我，并且一次只给一个动作。
9. 最后返回配置清单，并确认 workspace 文件读取测试通过。
```

兼容标识仍然保持：

```text
npm package: codex-with-chatgpt
CLI: c2c
Skill dir: ~/.codex/skills/codex-with-chatgpt/
```

## 日常怎么用

普通任务：

```text
使用 Codex with ChatGPT 完成 XXX。
```

Issue-backed任务：

```text
使用 Governed C2C 处理：<Issue URL>
```

如果 Issue已经包含完整任务合同，启动消息不需要再重复几千字。Codex会重新读取 Issue 和 live repo，只把 ChatGPT真正需要的内容压缩成 `TASK_CONTEXT`。

## ChatGPT Project、Memory 与 Library

普通个人、非共享 Pro Project 默认使用 **Default memory**，这样相关 saved/account-level context 可以帮助 ChatGPT理解你的长期偏好和历史背景。

以下情况使用 **Project-only**：

- 你明确要求隔离；
- Project是共享场景；
- Project属于敏感边界，需要限制项目外上下文。

Memory 永远只是 advisory context。发生冲突时：

```text
repository/runtime事实
→ live MCP

当前任务目标/冻结约束/成功标准
→ TASK_CONTEXT / HANDOFF

稳定协作规则
→ Project instructions / operating-model

Memory
→ 辅助背景
```

Library access 使用 capability-aware 处理：

- 如果 host暴露独立开关，普通 C2C在不需要 Library 时优先关闭；
- 如果 Library是 host-coupled/read-only，接受并报告实际值，不因此切换 Memory mode或判 setup失败；
- Library显示 ENABLED 不代表 ChatGPT获得任意检索授权，除非当前任务确实需要或 Human明确要求，否则不搜索无关 Library 内容。

## 更新与 upstream

`c2c update-check` 每天做一次便宜检查，对比的是**当前 checkout 的本地 HEAD 与该 checkout 的 `origin HEAD`**。

因此安装这个 Governed fork 后，普通自更新跟随的是本 fork 的 `origin/main`。

上游 `XiaoDuoYa/codex-with-chatgpt` 不会自动合入我们的 customized stable `main`。上游变化按 [Durable Operating Model](docs/operating-model.md) 处理：

```text
read-only detect upstream drift
        ↓
compatibility / sync branch
        ↓
tests + review
        ↓
PR
        ↓
merge
```

不会因为 upstream有变化就自动覆盖本地治理合同。

## 工作原理

```text
             ┌───────────────────────────┐
             │      ChatGPT 网页版       │
             │  推理 / PLAN / 独立审查   │
             └──────────┬──────────▲─────┘
                        │          │
               MCP      │          │ 内置浏览器
              数据面    │          │ 控制面（<1 KB）
                        ▼          │
             ┌─────────────────────┐
             │      C2C Bridge     │
             │      只读 MCP       │
             │   OAuth + 配对      │
             │    Tunnel 管理      │
             └──────────┬──────────┘
                        │ 只读
                        ▼
             ┌─────────────────────┐          ┌─────────────────────┐
             │     本地 Workspace  │◀─────────│    Codex Harness    │
             └─────────────────────┘ 编辑/git │ Shell / 测试 / 修复 │
                                              └─────────────────────┘
```

- **控制面**：Codex 和 ChatGPT之间只交换很小的 `[C2C]` 消息。普通控制面使用当前 host提供的 built-in browser/browser-use capability；基于截图的通用 Computer Use不是默认控制面。
- **数据面**：ChatGPT通过只读 MCP自己拉取 workspace、git、测试和已释放执行事实。
- **执行面**：Codex拥有编辑、shell、git、测试和已授权 effect执行能力。

## 安全模型（简版）

- MCP Bridge从构造上只读，不暴露写文件/删除/Shell工具；
- 一个 workspace对应一个安全边界；token和路径约束都绑定 workspace；
- `.env*`、密钥、凭证等敏感文件默认禁止读取，`.c2cignore`可以追加本地规则；
- 公网 MCP端点需要 OAuth 2.1，仅知道 URL没有访问权限；
- 长期凭证、Cloudflare/Feishu secret、本地 Governance state 不进入 GitHub Issue、文档、Memory或 Project sources；
- Human Gate只授权那一次精确的 L3 effect；模型建议、Presence、飞书消息都不能授权。

完整安全模型：[docs/security.md](docs/security.md)

## 文档导航

- 新用户入口：本 README / [English README](README.md)
- 跨任务长期规则：[docs/operating-model.md](docs/operating-model.md)
- C2C 协议与协作：[docs/protocol.md](docs/protocol.md)
- Governance / Human Gate：[docs/governance-v1.md](docs/governance-v1.md)
- 技术架构：[docs/architecture.md](docs/architecture.md)
- 安全：[docs/security.md](docs/security.md)
- Presence：[docs/presence-v1.md](docs/presence-v1.md)
- 飞书通知路由：[docs/notifications-v1.md](docs/notifications-v1.md)
- 飞书本机配置：[docs/feishu-setup-v1.md](docs/feishu-setup-v1.md)
- 故障排查：[docs/troubleshooting.md](docs/troubleshooting.md)
- 条件式 setup / repair 细节：`skill/references/`

## 开发者

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

环境要求：Node.js >= 20、git；公网连接需要 `cloudflared`。

## 目录结构

```text
src/
  bridge/       本地 Bridge 与 admin lifecycle
  mcp/          只读 MCP tools
  auth/         OAuth 2.1 与 token lifecycle
  pairing/      一次性配对码
  workspace/    路径边界、ignore策略、搜索、git
  tunnel/       Cloudflare Quick / Named 连接
  execution/    独立 Review所需执行记录
  governance/   effect分类、Human Gate、Presence、通知
  session/      C2C checkpoint / conversation state
  cli/          c2c CLI
skill/          Codex Skill 与 conditional references
tests/          contract / unit / integration tests
docs/           架构、协议、治理、operating model、安全等
```

## 当前状态

**Governed C2C V1 已达到 operational-ready，可用于日常真实项目。**

目前已经通过真实工作流验证：

- ChatGPT/Codex/Human 协作合同；
- Human Gate；
- Presence + Feishu通知；
- Context Hygiene；
- Issue-backed handoff / `TASK_CONTEXT`；
- Default-memory Project策略；
- Durable Operating Model / Durable Sync。

这是非官方社区项目，与 OpenAI无关联，也未获得 OpenAI背书。
原始上游项目：[XiaoDuoYa/codex-with-chatgpt](https://github.com/XiaoDuoYa/codex-with-chatgpt)。

## 许可证

[MIT](LICENSE)
