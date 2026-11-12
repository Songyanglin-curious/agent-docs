import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

/** 判断当前工作目录是否已经具有 Docs 入口，不向上猜测其他项目。 */
export function hasDocs(cwd) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) return false;
  try { return statSync(join(cwd, 'docs', 'index.md')).isFile(); } catch { return false; }
}

/** 定位规则目录；显式目录必须是绝对路径，避免随项目切换而漂移。 */
export function rulesDirectory(platform, explicit, env = process.env) {
  const configured = explicit || env.AGENT_DOCS_RULES_DIR;
  if (configured) {
    if (!isAbsolute(configured)) throw new Error('rulesDir 必须为绝对路径');
    return resolve(configured);
  }
  return join(homedir(), '.agent-docs', platform);
}

/** 以独占创建保留用户规则；每次检查可读性，失败时仅回退随包默认文件。 */
export function resolveRule(defaultsDir, rulesDir, mode, warn = () => {}) {
  if (!['init', 'maintain'].includes(mode)) throw new Error('未知规则类型');
  const fallback = join(defaultsDir, `${mode}.md`);
  const target = join(rulesDir, `${mode}.md`);
  try {
    mkdirSync(rulesDir, { recursive: true });
    // 操作指南引用同目录原则与规格；首次使用补齐依赖，但不覆盖用户已有版本。
    for (const companion of ['principles.md', 'spec.md']) {
      const source = join(defaultsDir, companion);
      const destination = join(rulesDir, companion);
      if (existsSync(source) && !existsSync(destination)) {
        try { writeFileSync(destination, readFileSync(source), { flag: 'wx' }); }
        catch (error) { if (error.code !== 'EEXIST') throw error; }
      }
      if (existsSync(source)) readFileSync(destination, 'utf8');
    }
    if (!existsSync(target)) {
      try { writeFileSync(target, readFileSync(fallback), { flag: 'wx' }); }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    readFileSync(target, 'utf8');
    return target;
  } catch (error) {
    warn(`Agent Docs 规则不可读，回退默认文件：${error.message}`);
    readFileSync(fallback, 'utf8');
    return fallback;
  }
}

/** 生成简短原 Agent 指令，只提供规则路径，不复制规则内容或推断文档归属。 */
export function ruleInstruction(mode, path) {
  const location = JSON.stringify(path);
  if (mode === 'init') return `用户已明确请求初始化或整理当前项目 Docs。请先读取规则文件 ${location}，再按规则检查当前项目并增量初始化；保留既有资料，重要迁移和冲突请用户决定。初始化结束后直接完成本轮，不再重复维护检查。`;
  return `本轮正常工作已完成。请读取规则文件 ${location}，利用当前对话上下文按规则检查当前项目 Docs；无变化则直接结束。用户要求本轮不动 Docs 时跳过；重要取舍使用可用的原生提问能力，未答复不执行该项变更。只维护必要文档与直接相关索引，不修改插件规则，不运行初始化，完成后直接结束。`;
}
