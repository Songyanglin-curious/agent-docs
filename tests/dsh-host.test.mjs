import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import LlmRuntime from '@deepseek-ai/dsh-llm';
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session';
import SessionProjections from '@deepseek-ai/dsh-session-projection';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import Agents from '@deepseek-ai/dsh-agent';

const plugin = await import(process.env.AGENT_DOCS_DSH_ENTRY ? pathToFileURL(process.env.AGENT_DOCS_DSH_ENTRY).href : '../plugins/dsh-agent-docs/lib/index.mjs');

test('DSH 默认 info 和维护指令均指向包内规则', async () => {
  const ctx = new Context();
  const previous = process.env.AGENT_DOCS_RULES_DIR;
  delete process.env.AGENT_DOCS_RULES_DIR;
  try {
    for (const service of [LlmRuntime, SessionStore, SessionProjections, SystemPrompt, Tools, Agents]) await ctx.plugin(service);
    await ctx.plugin(plugin, {});
    const tool = ctx.tools.get('agent_docs_rules');
    const info = await tool.execute({ mode: 'info' }, { signal: new AbortController().signal });
    assert.match(info.rulesDir.replaceAll('\\', '/'), /\/defaults\/$/);
    assert.equal(info.init, join(info.rulesDir, 'init.md'));
    const result = await tool.execute({ mode: 'maintain' }, { signal: new AbortController().signal });
    assert.equal(result.path, info.maintain);
    assert.ok(result.instruction.includes('maintain.md'));
  } finally {
    if (previous === undefined) delete process.env.AGENT_DOCS_RULES_DIR; else process.env.AGENT_DOCS_RULES_DIR = previous;
    await ctx.fiber.dispose();
  }
});

test('真实 Cordis 依赖注入、事件投递、工具执行、卸载与重新激活', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'agent-docs-host-'));
  mkdirSync(join(cwd, 'docs'));
  writeFileSync(join(cwd, 'docs', 'index.md'), '# 项目');
  const ctx = new Context();
  try {
    for (const service of [LlmRuntime, SessionStore, SessionProjections, SystemPrompt, Tools, Agents]) await ctx.plugin(service);
    const config = { rulesDir: join(cwd, 'rules') };
    const fiber = ctx.plugin(plugin, config);
    await fiber;
    const tool = ctx.tools.get('agent_docs_rules');
    assert.ok(tool);
    const info = await tool.execute({ mode: 'info' }, { signal: new AbortController().signal });
    assert.equal(info.rulesDir, config.rulesDir);
    const messages = [];
    const session = ctx.sessions.create(SessionId('agent-docs-host'), { meta: { cwd } });
    const agent = { session, steer: message => {
      assert.equal(message.source.kind, 'agent-docs', '维护提醒必须使用插件自己拥有的来源类型');
      session.append('user/message', message, { surfaceOp: 'append' });
      messages.push(message);
    } };
    const payload = { agent, turn: 1, signal: new AbortController().signal };
    await ctx.serial('agent/turn-stopping', payload);
    await ctx.serial('agent/turn-stopping', payload);
    assert.equal(messages.length, 1);
    await fiber.dispose();
    assert.equal(ctx.tools.get('agent_docs_rules'), undefined);
    await ctx.serial('agent/turn-stopping', { ...payload, turn: 2 });
    assert.equal(messages.length, 1);
    const reactivated = ctx.plugin(plugin, config);
    await reactivated;
    await ctx.serial('agent/turn-stopping', { ...payload, turn: 3 });
    assert.equal(messages.length, 2);
    await reactivated.dispose();
  } finally { await ctx.fiber.dispose(); }
});
