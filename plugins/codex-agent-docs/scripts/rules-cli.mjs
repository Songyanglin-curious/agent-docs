import { fileURLToPath } from 'node:url';
import { resolveRule, ruleInstruction, rulesDirectory } from './rules.mjs';

/** 显式初始化与规则定位入口，不直接修改项目资料。 */
function main() {
  const mode = process.argv[2] || 'info';
  const rulesDir = rulesDirectory('codex');
  const defaultsDir = fileURLToPath(new URL('../defaults/', import.meta.url));
  if (mode === 'info') {
    console.log(JSON.stringify({ rulesDir, init: resolveRule(defaultsDir, rulesDir, 'init'), maintain: resolveRule(defaultsDir, rulesDir, 'maintain') }));
  } else {
    const path = resolveRule(defaultsDir, rulesDir, mode);
    console.log(JSON.stringify({ path, instruction: ruleInstruction(mode, path) }));
  }
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
