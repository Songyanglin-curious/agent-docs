import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

/** 从唯一规则源构建两个各自独立的插件目录，不依赖工作区外的运行时代码。 */
export function build() {
  for (const name of ['dsh-agent-docs', 'codex-agent-docs']) {
    const plugin = join(root, 'plugins', name);
    mkdirSync(join(plugin, 'defaults'), { recursive: true });
    for (const mode of ['init', 'maintain', 'principles', 'spec']) cpSync(join(root, 'rules', `${mode}.md`), join(plugin, 'defaults', `${mode}.md`));
    const runtime = join(plugin, name.startsWith('dsh') ? 'lib' : 'scripts');
    mkdirSync(runtime, { recursive: true });
    cpSync(join(root, 'src', 'rules.mjs'), join(runtime, 'rules.mjs'));
    if (name.startsWith('dsh')) cpSync(join(plugin, 'src', 'index.mjs'), join(runtime, 'index.mjs'));
    writeFileSync(join(plugin, 'README.md'), readFileSync(join(root, 'README.md')));
    cpSync(join(root, 'docs'), join(plugin, 'docs'), { recursive: true });
  }
  console.log('两个独立插件目录已构建。');
}
build();
