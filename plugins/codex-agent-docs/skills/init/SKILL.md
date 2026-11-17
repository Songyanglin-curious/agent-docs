---
name: init
description: 仅在用户明确要求给当前项目初始化、接入或整理 Docs 结构时使用 Agent Docs 初始化规则；保留已有资料并增量建立文档入口。
---

确认用户明确发起了初始化或整理请求。当前 Agent 执行以下步骤，不启用其他 Agent：

1. 使用当前技能所在插件根目录下的 `scripts/rules-cli.mjs`：`node "<插件根目录>/scripts/rules-cli.mjs" init`。技能文件在 `skills/init/SKILL.md`，插件根目录是其上两级目录。路径包含空格时保持引号。
2. 读取命令返回的实际 `path`，按照完整 `init.md` 执行，尊重用户及项目已有约束。规则错误或歧义时不要改写规则文件。
3. 初始化完成后直接结束。若本轮 Stop Hook 再次提醒维护，只确认初始化已覆盖本轮所需工作后结束，不重复建设目录。

设置 `AGENT_DOCS_RULES_DIR` 可指定规则目录的绝对路径；未显式配置时直接读取插件包内 defaults/，不创建用户目录。仅用户明确要求时才修改插件规则。
