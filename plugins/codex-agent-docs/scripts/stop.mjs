import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { hasDocs, resolveRule, ruleInstruction, rulesDirectory } from './rules.mjs';

/** 按 Codex Stop 协议续接一次；无 Docs、已续接或异常时返回合法放行 JSON。 */
export function stop(input, options = {}) {
  if (!input || input.hook_event_name !== 'Stop' || input.stop_hook_active !== false || !hasDocs(input.cwd)) return {};
  const defaultsDir = options.defaultsDir || fileURLToPath(new URL('../defaults/', import.meta.url));
  const directory = rulesDirectory('codex', options.rulesDir);
  const path = resolveRule(defaultsDir, directory, 'maintain');
  return { decision: 'block', reason: ruleInstruction('maintain', path) };
}

/** 读取标准输入，所有异常均放行原任务；标准输出始终只包含一个 JSON。 */
function main() {
  try { process.stdout.write(JSON.stringify(stop(JSON.parse(readFileSync(0, 'utf8'))))); }
  catch (error) {
    process.stderr.write(`Agent Docs 跳过本轮检查：${error.message}\n`);
    process.stdout.write('{}');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
