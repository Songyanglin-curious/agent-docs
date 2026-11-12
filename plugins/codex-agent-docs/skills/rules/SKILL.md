---
name: rules
description: 查看 Agent Docs 的 init.md 和 maintain.md 配置路径，或在用户明确要求时编辑插件规则、指定共享规则目录。
---

运行当前插件根目录下 `node "<插件根目录>/scripts/rules-cli.mjs" info` 获取实际规则目录及文件路径。插件根目录是当前 `skills/rules/SKILL.md` 的上两级目录。

向用户说明返回路径。只有用户明确要求修改规则时才编辑；保留原内容中未涉及的约定。每次调用重新读取，无需重新打包。通过 `AGENT_DOCS_RULES_DIR` 指定绝对路径，可与 DSH 的 `rulesDir` 共用目录；不要自动假定 Windows 与 WSL 路径相同。
