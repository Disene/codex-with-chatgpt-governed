import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("Skill context and browser contracts", () => {
  const core = read("skill/SKILL.md");
  const readme = read("README.md");
  const readmeZh = read("README.zh-CN.md");
  const protocol = read("docs/protocol.md");

  it("uses a capability-level browser contract without legacy runtime APIs", () => {
    const legacyApis = [
      ["control", "in", "app", "browser"].join("-"),
      ["setupBrowser", "Runtime()"].join(""),
      ["agent.browsers.get(", '"iab"', ")"].join(""),
    ];
    for (const legacyApi of legacyApis) {
      expect(core).not.toContain(legacyApi);
    }
    expect(core).toMatch(/host-provided built-in browser \/ browser-use capability/i);
    expect(core).toMatch(/capability is unavailable,\s+fail closed/i);
    expect(core).toMatch(/setup, reconnect, or repair[\s\S]{0,160}guide[\s\S]{0,40}manual/i);
  });

  it("keeps both references conditional and out of the normal coding path", () => {
    expect(fs.existsSync(path.join(projectRoot, "skill/references/setup-and-repair.md"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "skill/references/project-setup.md"))).toBe(true);
    expect(core).toMatch(
      /setup, update, reconnect, repair, or disconnect[\s\S]{0,240}references\/setup-and-repair\.md/i
    );
    expect(core).toMatch(
      /first Bind Project or Project repair[\s\S]{0,240}references\/project-setup\.md/i
    );
    expect(core).toMatch(/Normal coding[^\n]*read neither reference/i);
  });

  it("installs and updates the complete Skill bundle", () => {
    expect(readme).toMatch(
      /copy (?:the )?(?:complete )?`?skill\/?`? (?:directory )?to\s+`?~\/\.codex\/skills\/codex-with-chatgpt\/?`?/i
    );
    expect(readmeZh).toMatch(
      /把完整的 `skill\/` 目录复制到\s+`~\/\.codex\/skills\/codex-with-chatgpt\/`/
    );

    const setupAndRepair = read("skill/references/setup-and-repair.md");
    expect(setupAndRepair).toMatch(
      /copy the complete `skill\/` directory to `~\/\.codex\/skills\/codex-with-chatgpt\/`/i
    );
    expect(`${readme}\n${readmeZh}\n${setupAndRepair}`).not.toMatch(
      /copy (?:the repository's )?`?skill\/SKILL\.md`? to/i
    );
  });

  it("does not define ordinary ChatGPT web control as Computer Use", () => {
    const publicContract = `${protocol}\n${readme}\n${readmeZh}`;
    expect(publicContract).not.toMatch(
      /Control plane:\s*Computer Use|Control plane \(Computer Use\)|控制面（Computer Use）/i
    );
    expect(publicContract).toMatch(/built-in browser \/ browser-use capability/i);
    expect(publicContract).toMatch(/not (?:the )?normal control plane/i);
  });
});
