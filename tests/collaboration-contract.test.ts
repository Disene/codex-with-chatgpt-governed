import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function fencedBlockAfter(markdown: string, heading: string): string {
  const headingIndex = markdown.indexOf(heading);
  expect(headingIndex).toBeGreaterThanOrEqual(0);
  const fenceIndex = markdown.indexOf("```", headingIndex);
  const bodyIndex = markdown.indexOf("\n", fenceIndex) + 1;
  const endIndex = markdown.indexOf("```", bodyIndex);
  expect(fenceIndex).toBeGreaterThanOrEqual(headingIndex);
  expect(endIndex).toBeGreaterThan(bodyIndex);
  return markdown.slice(bodyIndex, endIndex).trim();
}

describe("Collaboration Contract & Chinese UX V1", () => {
  const protocol = read("docs/protocol.md");
  const coreSkill = read("skill/SKILL.md");
  const projectSetup = read("skill/references/project-setup.md");
  const bootPrompt = fencedBlockAfter(protocol, "## Boot Prompt");
  const protocolProjectInstructions = fencedBlockAfter(protocol, "## Project instructions");
  const setupProjectInstructions = fencedBlockAfter(projectSetup, "## Project instructions");

  it("defaults human-readable C2C semantics to Simplified Chinese", () => {
    expect(bootPrompt).toMatch(/语义内容默认使用简体中文/);
    expect(protocolProjectInstructions).toMatch(/语义内容默认使用简体中文/);
    expect(coreSkill).toMatch(/Default human-readable semantic[\s\S]{0,120}Simplified Chinese/);
    expect(protocol).toContain("本轮执行已完成。");
    expect(protocol).toContain("说明阻塞任务的真实原因。");
  });

  it("keeps machine protocol identifiers and the state flow stable", () => {
    const contract = `${protocol}\n${coreSkill}`;
    const stableIdentifiers = [
      "[C2C]",
      "STATE",
      "INIT",
      "PLAN",
      "EXECUTING",
      "EXECUTED",
      "DONE",
      "BLOCKED",
      "HANDOFF",
      "HUMAN_GATE",
      "HUMAN_GATE_READY",
      "HUMAN_GATE_DECISION",
      "GRANT",
      "CANCEL",
    ];
    for (const identifier of stableIdentifiers) {
      expect(contract).toContain(identifier);
    }
    expect(protocol).toContain(
      "INIT → PLAN → EXECUTING → EXECUTED → REVIEW → PLAN | DONE | BLOCKED | ERROR"
    );
    expect(coreSkill).toContain(
      "INIT → PLAN → EXECUTING → EXECUTED → REVIEW → (PLAN | DONE | BLOCKED)"
    );
  });

  it("keeps the Boot Prompt concise instead of duplicating durable governance", () => {
    expect(bootPrompt).toMatch(/方案设计[\s\S]*风险判断[\s\S]*独立审查/);
    expect(bootPrompt).toMatch(/Codex 负责本地调查、实现、测试与已授权执行/);
    expect(bootPrompt).toMatch(/Human 只处理真实 L3 授权/);
    expect(bootPrompt).not.toMatch(/\bL0\b|\bL1\b|\bL2\b/);
    expect(bootPrompt).not.toContain("one risk -> one control");
    expect(bootPrompt).not.toContain("Preflight -> Evidence");
    expect(bootPrompt).not.toContain("CONSUMED");
  });

  it("preserves minimum Human Gate bootstrap semantics in the Boot Prompt", () => {
    expect(bootPrompt).toContain("HUMAN_GATE_READY");
    expect(bootPrompt).toMatch(/动作、环境、目标、允许与禁止写入及回滚/);
    expect(bootPrompt).toMatch(/不展示 machine ID 或内部状态名，并只问一次/);
    expect(bootPrompt).toMatch(/同一 chat 中 Human 随后明确授权/);
    expect(bootPrompt).toContain("HUMAN_GATE_DECISION: GRANT");
    expect(bootPrompt).toContain("CANCEL");
    expect(bootPrompt).toContain("GATE_ID");
    expect(bootPrompt).toContain("ENVELOPE_FINGERPRINT");
    expect(bootPrompt).toMatch(/模型建议与 Feishu 消息从不构成授权/);
  });

  it("encodes the ChatGPT, Codex, and Human role contract durably", () => {
    expect(protocolProjectInstructions).toMatch(
      /ChatGPT[\s\S]*架构\/产品决策[\s\S]*风险分类[\s\S]*独立核验/
    );
    expect(protocolProjectInstructions).toMatch(
      /Codex[\s\S]*本地调查[\s\S]*build\/test\/lint\/typecheck[\s\S]*Draft PR/
    );
    expect(protocolProjectInstructions).toMatch(
      /Human[\s\S]*产品\/业务选择[\s\S]*L3[\s\S]*登录\/2FA\/CAPTCHA[\s\S]*secret\/credential/
    );
  });

  it("encodes Minimum Sufficient Governance and DONE bias", () => {
    expect(protocolProjectInstructions).toMatch(/L0 observe\/read-only：直接执行/);
    expect(protocolProjectInstructions).toMatch(/L1 local reversible：执行并测试/);
    expect(protocolProjectInstructions).toMatch(/L2 remote reversible：已有授权时通常执行/);
    expect(protocolProjectInstructions).toMatch(/L3 consequential[\s\S]*exactly one Human Gate/);
    expect(protocolProjectInstructions).toContain("one risk -> one control");
    expect(protocolProjectInstructions).toMatch(/不确定时先做 read-only investigation/);
    expect(protocolProjectInstructions).toContain(
      "Preflight -> Evidence -> Readback -> duplicate Review"
    );
    expect(protocolProjectInstructions).toMatch(/倾向 `DONE`；PASS 后不制造 final-final review/);
  });

  it("uses Default memory for ordinary personal Projects and keeps memory advisory", () => {
    expect(projectSetup).toContain("默认记忆（Default memory）");
    expect(projectSetup).not.toContain("记忆请选「仅限项目记忆」");
    expect(projectSetup).toMatch(/明确需要隔离[\s\S]*共享\/敏感[\s\S]*仅限项目记忆/);
    expect(protocolProjectInstructions).toMatch(
      /ChatGPT account\/Project memory[\s\S]*advisory context/
    );
    expect(protocolProjectInstructions).toMatch(
      /陈旧或冲突时[\s\S]*live source 或当前任务上下文/
    );
  });

  it("relays Issue-backed tasks through compact TASK_CONTEXT without direct ChatGPT Issue reads", () => {
    const contract = `${protocol}\n${coreSkill}`;
    expect(contract).toMatch(/Issue-backed task[\s\S]*Codex reads the current (GitHub )?Issue itself/);
    expect(contract).toMatch(/TASK_CONTEXT[\s\S]*target < 1 KB/);
    expect(contract).toMatch(/goal, must-preserve constraints, key success criteria/);
    expect(contract).toMatch(/never ask\s+ChatGPT to fetch or read the Issue directly/i);
    expect(protocol).toMatch(/TASK_CONTEXT:[\s\S]*保持现有主题 API/);
    expect(coreSkill).toMatch(/Refresh that compact context in a later HANDOFF/);
  });

  it("preserves connector identity, fact-type authority, HANDOFF continuity, and L3-only gates", () => {
    expect(protocolProjectInstructions).toContain("Workspace name: {{workspace_name}}");
    expect(protocolProjectInstructions).toContain(
      "Connector (use this one only): {{connector_name}}"
    );
    expect(protocolProjectInstructions).toMatch(
      /repository\/runtime 当前事实[\s\S]*connector 读取的 live code/
    );
    expect(protocolProjectInstructions).toMatch(
      /当前任务意图、约束与成功标准[\s\S]*`TASK_CONTEXT` \/ HANDOFF/
    );
    expect(protocolProjectInstructions).toMatch(
      /稳定 workflow 与 workspace identity[\s\S]*Project instructions/
    );
    expect(protocolProjectInstructions).toMatch(/HANDOFF 表示继续同一任务/);
    expect(protocolProjectInstructions).toMatch(/仅在真实 L3 边界处理 Human Gate/);
    expect(bootPrompt).toMatch(/Human Gate 只用于真实 L3 后果边界/);
    expect(protocol).toMatch(
      /`HUMAN_GATE` is optional and is only valid for a real L3 consequential action/
    );
    expect(setupProjectInstructions).toBe(protocolProjectInstructions);
  });
});
