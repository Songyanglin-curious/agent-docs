import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../plugins/dsh-agent-docs/lib/index.mjs';

/** 模拟宿主公开事件与工具 seam，使用真实 DSH defineTool 和消息构造函数。 */
function fixture(config = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-docs-dsh-'));
  const handlers = new Map();
  const tools = [];
  const warnings = [];
  const ctx = { agents: { turnBoundaryOf: () => ({ lastTurn: 1 }) }, on: (name, callback) => handlers.set(name, callback), tools: { register: tool => tools.push(tool) }, logger: { warn: message => warnings.push(message) } };
  apply(ctx, { rulesDir: join(cwd, 'rules'), ...config });
  const messages = [];
  const agent = { session: { header: { cwd, delegationDepth: 0 } }, steer: message => messages.push(message) };
  const controller = new AbortController();
  return { cwd, handlers, tools, warnings, messages, agent, controller,
    stop: turn => handlers.get('agent/turn-stopping')({ agent, turn, signal: controller.signal }) };
}

/** 仅在测试目录建立 Docs 入口。 */
function initialize(f) {
  mkdirSync(join(f.cwd, 'docs'));
  writeFileSync(join(f.cwd, 'docs', 'index.md'), '# 项目');
}

test('同轮只投递一次，下一轮可再次检查，未初始化不自动创建', () => {
  const f = fixture();
  f.stop(1);
  assert.equal(f.messages.length, 0);
  initialize(f);
  f.stop(2); f.stop(2);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].source.kind, 'agent-docs');
  f.stop(3);
  assert.equal(f.messages.length, 2);
});

test('子 Agent、取消、关闭和卸载后不续接', () => {
  for (const mode of ['subagent', 'cancel', 'disabled', 'disposed']) {
    const f = fixture({ enabled: mode !== 'disabled' });
    initialize(f);
    if (mode === 'subagent') f.agent.session.header.origin = 'subagent';
    if (mode === 'cancel') f.controller.abort();
    if (mode === 'disposed') f.handlers.get('dispose')();
    f.stop(1);
    assert.equal(f.messages.length, 0, mode);
  }
});

test('显式初始化工具返回路径，本轮不重复维护，后续轮次恢复', async () => {
  const f = fixture();
  const response = await f.tools[0].execute({ mode: 'init' }, { agent: f.agent, signal: f.controller.signal });
  assert.match(response.path, /init\.md$/);
  initialize(f);
  f.stop(1); f.stop(1);
  assert.equal(f.messages.length, 0);
  f.stop(2);
  assert.equal(f.messages.length, 1);
});

test('规则路径错误时放行，重复停止不无限重试', () => {
  const f = fixture({ rulesDir: 'relative' });
  initialize(f);
  f.stop(1); f.stop(1);
  assert.equal(f.messages.length, 0);
  assert.equal(f.warnings.length, 1);
});
