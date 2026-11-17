import './build.mjs';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = join(root, 'dist');

/** 执行构建工具并传播失败，避免产生貌似成功的半成品。 */
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.error?.message || result.stdout);
  return result.stdout;
}

/** 生成 npm tarball、可解压的 Codex 插件市场及校验和清单。 */
function pack() {
  mkdirSync(dist, { recursive: true });
  if (!process.env.npm_execpath) throw new Error('请通过 npm run pack 执行');
  const result = JSON.parse(run(process.execPath, [process.env.npm_execpath, 'pack', '--json', '--ignore-scripts', '--pack-destination', dist], join(root, 'plugins/dsh-agent-docs')));
  const version = JSON.parse(readFileSync(join(root, 'plugins/codex-agent-docs/.codex-plugin/plugin.json'))).version;
  const marketplace = join(dist, `codex-agent-docs-${version}`);
  const plugin = join(marketplace, 'plugins', 'codex-agent-docs');
  mkdirSync(join(marketplace, '.agents', 'plugins'), { recursive: true });
  cpSync(join(root, 'plugins', 'codex-agent-docs'), plugin, { recursive: true });
  writeFileSync(join(marketplace, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({
    name: 'agent-docs-local',
    interface: { displayName: 'Agent Docs 本地插件' },
    plugins: [{ name: 'codex-agent-docs', source: { source: 'local', path: './plugins/codex-agent-docs' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }],
  }, null, 2));
  cpSync(join(root, 'scripts', 'install-codex.ps1'), join(marketplace, 'install-codex.ps1'));
  cpSync(join(root, 'scripts', 'uninstall-codex.ps1'), join(marketplace, 'uninstall-codex.ps1'));
  for (const file of ['安装与测试.md', '开发与验证.md']) {
    cpSync(join(root, 'docs', file), join(marketplace, file));
    cpSync(join(root, 'docs', file), join(dist, file));
  }
  const zipName = `codex-agent-docs-${version}.zip`;
  run('pwsh.exe', ['-NoProfile', '-File', join(root, 'scripts', 'zip.ps1'), '-Source', marketplace, '-Destination', join(dist, zipName)]);
  const files = [result[0].filename, zipName];
  writeFileSync(join(dist, 'SHA256SUMS.txt'), files.map(file => `${createHash('sha256').update(readFileSync(join(dist, file))).digest('hex')}  ${file}`).join('\n') + '\n');
  const transfer = join(dist, `agent-docs-${version}`);
  mkdirSync(transfer, { recursive: true });
  for (const file of [...files, 'SHA256SUMS.txt', '安装与测试.md', '开发与验证.md']) cpSync(join(dist, file), join(transfer, file));
  cpSync(join(root, 'rules'), join(transfer, 'rules'), { recursive: true });
  run('pwsh.exe', ['-NoProfile', '-File', join(root, 'scripts/zip.ps1'), '-Source', transfer, '-Destination', join(dist, `agent-docs-${version}-安装包.zip`)]);
  // 根目录同时提供当前版本安装包，便于直接复制到其他机器。
  for (const file of [...files, 'SHA256SUMS.txt', `agent-docs-${version}-安装包.zip`]) cpSync(join(dist, file), join(root, file));
  console.log(files.map(file => join(dist, file)).join('\n'));
}
pack();
