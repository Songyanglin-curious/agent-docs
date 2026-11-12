import Schema from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { fileURLToPath } from 'node:url';
import { hasDocs, resolveRule, ruleInstruction, rulesDirectory } from './rules.mjs';

export const name = 'agent-docs';
export const inject = ['agents', 'tools'];
export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('启用轮次结束时的 Docs 检查。'),
  rulesDir: Schema.string().description('可编辑规则目录的绝对路径；留空使用用户目录。'),
});

/** 注册原生轮次 Hook 和规则入口，状态按 Agent 弱引用管理并随插件卸载释放。 */
export function apply(ctx, config = {}) {
  const defaultsDir = fileURLToPath(new URL('../defaults/', import.meta.url));
  const checked = new WeakMap();
  let active = true;
  ctx.on('dispose', () => { active = false; });

  /** 每次调用重新定位规则；路径错误由调用方捕获并放行正常工作。 */
  function locate(mode) {
    return resolveRule(defaultsDir, rulesDirectory('dsh', config.rulesDir), mode,
      message => ctx.logger.warn(message));
  }

  ctx.tools.register(defineTool({
    name: 'agent_docs_rules',
    description: 'Agent Docs 规则入口。仅用户明确要求初始化或整理 Docs 时使用 init；maintain 用于显式检查，info 查看配置路径。返回规则路径后由当前 Agent 读取并执行，不创建第二个 Agent。',
    parameters: { mode: { type: 'string', enum: ['init', 'maintain', 'info'], required: true } },
    output: {
      schema: { type: 'json' },
      /** 把规则定位结果呈现给原 Agent，由其读取实际文件。 */
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    /** 返回可读规则路径；显式处理后抑制本轮自动维护，避免初始化后的重复检查。 */
    async execute(args, exec) {
      exec.signal?.throwIfAborted();
      if (!active) throw new Error('Agent Docs 已卸载');
      if (args.mode === 'info') return { rulesDir: rulesDirectory('dsh', config.rulesDir), init: locate('init'), maintain: locate('maintain') };
      const path = locate(args.mode);
      if (exec.agent) checked.set(exec.agent, ctx.agents.turnBoundaryOf(exec.agent.session).lastTurn);
      return { path, instruction: ruleInstruction(args.mode, path) };
    },
  }));

  ctx.on('agent/turn-stopping', ({ agent, turn, signal }) => {
    if (!active || config.enabled === false || signal.aborted) return;
    const header = agent.session.header;
    if (header.origin === 'subagent' || header.delegationDepth > 0) return;
    if (checked.get(agent) === turn) return;
    checked.set(agent, turn);
    if (!hasDocs(header.cwd)) return;
    try {
      const path = locate('maintain');
      if (!active || signal.aborted) return;
      agent.steer(createUserMessage({
        content: [{ type: 'text', text: ruleInstruction('maintain', path) }],
        source: { kind: 'agent-docs', form: 'instructions' },
      }));
    } catch (error) { ctx.logger.warn(`Agent Docs 跳过本轮检查：${error.message}`); }
  });
}
