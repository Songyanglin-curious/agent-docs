import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hasDocs, resolveRule, rulesDirectory } from '../src/rules.mjs';

/** 创建独立目录，验证时不触碰真实用户规则和项目。 */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'agent-docs-'));
  const defaults = join(root, 'defaults');
  mkdirSync(defaults);
  writeFileSync(join(defaults, 'init.md'), '默认初始化');
  writeFileSync(join(defaults, 'maintain.md'), '默认维护');
  return { root, defaults, user: join(root, 'user') };
}

test('默认读取包内规则且随包更新，不创建用户规则目录', () => {
  const f = fixture();
  assert.equal(rulesDirectory('dsh', undefined, {}), undefined);
  assert.equal(rulesDirectory('codex', undefined, {}), undefined);
  assert.equal(resolveRule(f.defaults, undefined, 'maintain'), join(f.defaults, 'maintain.md'));
  writeFileSync(join(f.defaults, 'maintain.md'), '升级的默认规则');
  assert.equal(readFileSync(resolveRule(f.defaults, undefined, 'maintain'), 'utf8'), '升级的默认规则');
  assert.equal(existsSync(f.user), false);
});

test('显式自定义目录缺失时创建规则，升级不覆盖用户文件', () => {
  const f = fixture();
  const path = resolveRule(f.defaults, f.user, 'maintain');
  assert.equal(readFileSync(path, 'utf8'), '默认维护');
  writeFileSync(path, '用户新规则');
  writeFileSync(join(f.defaults, 'maintain.md'), '升级的默认规则');
  assert.equal(resolveRule(f.defaults, f.user, 'maintain'), path);
  assert.equal(readFileSync(path, 'utf8'), '用户新规则');
});

test('配置目录不可写时回退随包规则，默认也不可读时报告失败', () => {
  const f = fixture();
  writeFileSync(f.user, '阻挡目录创建');
  const warnings = [];
  assert.equal(resolveRule(f.defaults, f.user, 'init', m => warnings.push(m)), join(f.defaults, 'init.md'));
  assert.equal(warnings.length, 1);
  assert.throws(() => resolveRule(join(f.root, 'missing'), f.user, 'init'));
});

test('首次调用补齐原则与规格，之后保留用户自定义的依赖规则', () => {
  const f = fixture();
  writeFileSync(join(f.defaults, 'principles.md'), '默认原则');
  writeFileSync(join(f.defaults, 'spec.md'), '默认规格');
  resolveRule(f.defaults, f.user, 'init');
  assert.equal(readFileSync(join(f.user, 'principles.md'), 'utf8'), '默认原则');
  assert.equal(readFileSync(join(f.user, 'spec.md'), 'utf8'), '默认规格');
  writeFileSync(join(f.user, 'principles.md'), '用户原则');
  resolveRule(f.defaults, f.user, 'maintain');
  assert.equal(readFileSync(join(f.user, 'principles.md'), 'utf8'), '用户原则');
});

test('只认当前项目的文件入口，拒绝相对配置及非法规则名称', () => {
  const f = fixture();
  assert.equal(hasDocs(f.root), false);
  mkdirSync(join(f.root, 'docs'));
  mkdirSync(join(f.root, 'docs', 'index.md'));
  assert.equal(hasDocs(f.root), false);
  assert.equal(hasDocs('relative'), false);
  assert.throws(() => rulesDirectory('dsh', './relative'));
  assert.equal(rulesDirectory('codex', f.user), f.user);
  assert.throws(() => resolveRule(f.defaults, f.user, '../escape'));
});
