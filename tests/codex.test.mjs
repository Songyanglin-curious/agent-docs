import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../plugins/codex-agent-docs/scripts/stop.mjs', import.meta.url));

/** 通过真实标准输入输出调用 Hook，覆盖解析和退出行为。 */
function run(input, extraEnv = {}) {
  const result = spawnSync(process.execPath, [script], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8', env: { ...process.env, AGENT_DOCS_RULES_DIR: join(tmpdir(), 'agent-docs-codex-test-rules'), ...extraEnv },
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('真实 Stop 仅续接一次、保留路径，无 Docs 与其他事件均放行', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-docs-codex-'));
  const input = { hook_event_name: 'Stop', cwd, turn_id: 'one', stop_hook_active: false };
  assert.deepEqual(run(input), {});
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'index.md'), '# 项目');
  const response = run(input);
  assert.equal(response.decision, 'block');
  assert.match(response.reason, /maintain\.md/);
  assert.deepEqual(run({ ...input, stop_hook_active: true }), {});
  assert.deepEqual(run({ ...input, hook_event_name: 'SubagentStop' }), {});
  assert.deepEqual(run({ ...input, stop_hook_active: undefined }), {});
});

test('损坏输入与配置错误不会阻塞用户任务', () => {
  assert.deepEqual(run('{bad'), {});
  const cwd = mkdtempSync(join(tmpdir(), 'agent-docs-codex-error-'));
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'index.md'), '# 项目');
  assert.deepEqual(run({ hook_event_name: 'Stop', cwd, stop_hook_active: false }, { AGENT_DOCS_RULES_DIR: 'relative' }), {});
});

test('通过目录映射启动已安装 Hook 时仍输出提醒与放行 JSON', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-docs-codex-link-'));
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'index.md'), '# 项目');
  const alias = join(cwd, 'mapped-scripts');
  symlinkSync(fileURLToPath(new URL('../plugins/codex-agent-docs/scripts/', import.meta.url)), alias, process.platform === 'win32' ? 'junction' : 'dir');
  for (const active of [false, true]) {
    const result = spawnSync(process.execPath, [join(alias, 'stop.mjs')], {
      input: JSON.stringify({ hook_event_name: 'Stop', cwd, stop_hook_active: active }),
      encoding: 'utf8', env: { ...process.env, AGENT_DOCS_RULES_DIR: join(cwd, 'rules') },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).decision, active ? undefined : 'block');
  }
});
