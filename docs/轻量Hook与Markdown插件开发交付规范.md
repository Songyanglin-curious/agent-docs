# 轻量 Hook 与 Markdown 插件开发交付规范

适用：主要由少量 Hook／工具代码和一组 Markdown 指令组成，供当前 Agent 读取并执行的插件。本文从 Agent Docs 的 DSH、Codex 双端开发、0.1.6 干净安装及 GitHub Release 发布实践提取，供其他插件替换名称后复用。

本文是规范和操作步骤，不会自动发布、安装或修改其他项目。本次已验证的是 Agent Docs；其他宿主版本、事件接口、依赖版本及插件协议需重新核对。

## 一、先确定输入与交付范围

开始前填写这张参数表，后续所有命令、文件名和文档使用同一组值：

| 参数 | Agent Docs 已验证实例 | 其他插件如何替换 |
| --- | --- | --- |
| 仓库 | Songyanglin-curious/agent-docs | owner/repository |
| 源码目录 | D:/mycode/agent-docs | 实际工作目录 |
| 当前交付版本 | 0.1.6 | 三端清单和发布标签一致的版本 |
| DSH npm 包名 | dsh-agent-docs | 目标包名，决定 TGZ 文件名 |
| DSH 目标 Profile | web | 实际安装目标，不默认修改所有 Profile |
| Codex 插件名 | codex-agent-docs | manifest 的 name |
| Codex 个人市场 | personal-local | 目标机器实际市场名，保留其他插件 |
| 完整安装包 Release 文件名 | agent-docs-0.1.6-bundle.zip | 建议使用 ASCII 文件名 |

同时明确本轮是只改源码、打包、发布，还是还要更新本机。用户要求“发布可安装版本”时，源码 main、版本标签、Release 附件、README 命令和远程下载回验都属于完整交付；不能只推源码就宣称完成。

## 二、实现职责与文件组织

### 2.1 Hook 只负责触发和提供入口

Hook 的执行顺序：

1. 解析宿主提供的事件输入。
2. 排除无关事件、取消、关闭、子 Agent 等不适用情况，具体条件以宿主协议为准。
3. 判断当前工作目录是否满足插件适用条件。
4. 定位随包 Markdown 规则的绝对路径。
5. 通过宿主正式机制提醒当前 Agent 读取规则；实际推理和文件操作由该 Agent 完成。
6. 同轮去重，续接后退出；失败时按宿主协议返回合法结果，不无限阻塞原任务。

不要把完整规则硬编码到 Hook 字符串，不启动第二个 Agent 承担相同工作，也不要让简单 Hook 承担任务调度和数据库管理。

Agent Docs 的具体实现：DSH 监听 agent/turn-stopping，并使用正式消息来源向原 Agent 投递提醒；Codex Stop 子进程在需要维护时输出 block 与 reason，stop_hook_active=true 时放行。其他插件不能直接猜测或照搬事件名称。

### 2.2 Markdown 承载可执行指令

每份指令应能回答：何时执行、读什么、按什么顺序操作、改哪里、何时询问、什么情况下跳过、做完检查什么、何时停止。

职责可按以下方式分工，不要求每个插件机械创建四份：

| 内容 | 作用 |
| --- | --- |
| 原则／边界 | 定义对象、职责和权限，不重复所有步骤 |
| 规格 | 定义输出结构和可检查要求 |
| 显式操作指南 | 用户主动请求的初始化等操作 |
| Hook 维护指南 | 普通工作结束后的按需检查 |

指令之间引用相对路径；依赖的 Markdown 必须一起进包。不能只打包入口指南，却漏掉它引用的原则、规格或脚本。

### 2.3 建议源码结构

```text
repository/
  README.md
  package.json
  .gitignore
  rules/                         # 唯一默认规则源
  src/rules.mjs                  # 共享定位逻辑
  plugins/
    dsh-example/
      package.json
      cordis.patch.yml
      src/index.mjs
    codex-example/
      .codex-plugin/plugin.json
      hooks/hooks.json
      scripts/stop.mjs
      scripts/rules-cli.mjs
      skills/                    # 有显式操作入口才需要
  scripts/
    build.mjs
    pack.mjs
    verify-packages.ps1
    install-codex.ps1
    uninstall-codex.ps1
  tests/
  docs/index.md
```

构建将 rules/ 复制为两个插件各自的 defaults/，将共享运行模块复制到各包内部。安装包解压后不能依赖源码仓库中的 ../../src、开发机绝对路径或 node_modules Junction。

以上是模板名称；本项目真实实现入口见 [实现说明](实现说明.md)。

## 三、安装位置、默认规则和卸载规范

### 3.1 默认文件留在对应宿主下面

| 文件 | 已验证位置／规则 |
| --- | --- |
| DSH 程序与默认规则 | Profile 中安装包内部，由 DSH／包管理器管理 |
| Codex 本地登记源 | ~/.codex/plugins/local/插件名 |
| Codex 安装缓存 | 由 codex plugin add/remove 管理，不手工伪造 |
| Codex 个人市场 | 宿主支持的 ~/.agents/plugins/marketplace.json，只维护本插件条目 |
| 默认 Markdown | 安装包 defaults/，直接读取，不自动复制到用户目录 |

不要再默认创建 ~/.插件名/规则副本和备份。否则包升级后，旧用户副本会继续遮住新默认规则，用户看到“版本升级了，行为却没更新”。

需要自定义时，用户显式指定绝对目录；可以在对应宿主目录内选择位置。保护显式自定义文件，文档明确其不会随包更新。默认读取与显式自定义是两条不同路径，不能混用“升级自动更新”和“不覆盖用户规则”的表述。

正常安装和升级不自动制造备份。开发用同步工具若保留备份能力，必须要求明确传目标目录，不加入普通安装流程。

### 3.2 仅使用宿主的正式安装接口

- DSH：通过 plugin add/remove 修改依赖和 bundle，不把 npm 解析成功等同于插件已启用。
- Codex：登记市场源后，还需 plugin add 或桌面安装流程。登记成功不等于 installed=true。
- 不直接修改安装缓存、数据库或 Hook 信任字段来冒充安装。
- 不绕过 peer 兼容性校验；宿主依赖区间由目标安装环境实测决定，不能将本项目版本照搬到其他插件。

### 3.3 完整卸载需要覆盖两个层次

1. 原生卸载：移除安装状态、宿主注册和版本缓存。
2. 插件登记清理：若安装脚本另有本地源和个人市场条目，提供清理脚本，只删除本插件源和条目。

保留其他插件、共享市场文件及宿主共享包管理缓存。自定义规则属于用户内容，不自动删除，除非用户明确要求。删除目录前验证绝对路径和所属范围；链接目录、路径异常或权限拒绝时停止，不换工具绕过。

## 四、构建、打包和本地验证

### 4.1 封存改动前基线

先读取项目 docs/index.md 和适用指令，检查工作区，限定暂存范围：

```powershell
git status --short --branch
git diff --stat
git add -- <本次明确涉及的文件>
git diff --cached --check
git commit -m '封存插件改造前基线'
git tag -a baseline-before-<版本> -m '插件改造前基线'
```

示例占位符必须替换后使用。已有不相关改动不纳入提交。记录基线 SHA，不能为了回退方便擅自 reset 或清空用户工作。

### 4.2 统一版本和忽略规则

同步根 package.json、DSH package.json、Codex manifest、README 和安装手册中的当前版本。历史验收记录保留原版本并标注历史，不全局替换所有旧数字。

提交源码、规则、构建和校验脚本。忽略 node_modules、dist、根目录生成包、临时测试输出、环境密钥和日志；不要直接忽略整个用户资料目录。发行包走 Release，不靠强制 add 大量 ZIP/TGZ 混入源码历史。

### 4.3 按顺序执行

```powershell
npm test
npm run pack
npm run verify:packages
```

这是 Agent Docs 的已验证入口；其他仓库应实现等效脚本。每一步失败就停止后续发布。

- build：从唯一源生成两个独立运行包。
- pack：在 DSH 插件目录 npm pack；Codex ZIP 包含点号目录、manifest、Hook、规则、脚本和安装／卸载入口。
- verify：从真实归档清单与独立解压内容验证，不能只检查源码目录。

新版本使用新暂存目录。重复打包前应防止旧版本文件混入同版本暂存区；清理仅限已核实的构建目录。Agent Docs 当前 pack 复用同版本目录，迁移到有文件删除或重命名的插件时，应先完善或显式执行受控暂存清理，不能假定复制会移除旧文件。

### 4.4 包的最小清单

DSH TGZ：package.json、入口模块、cordis.patch.yml、defaults/ 及运行依赖资源；不携带测试、node_modules 或 monorepo 源码树。必须声明真实 dsh.bundle.patch，peer 服务由目标 Profile 提供。

Codex ZIP：.codex-plugin、hooks、scripts、defaults、需要的 skills、市场清单、安装与卸载脚本。归档工具须保留点号目录，不用可能漏掉这些目录的打包方式。

完整安装包：两个独立包、规则原文、安装手册、SHA256SUMS.txt。Release 外层 ZIP 建议用 ASCII 名称，例如 example-1.2.3-bundle.zip；本次中文附件名曾被 GitHub 规范化，最终改用 ASCII，以免下载命令与实际名称不一致。

校验和清单覆盖独立 TGZ／ZIP。本项目不声称该清单覆盖外层完整包；外层包含清单，不应试图把它自身的哈希写回其内部清单。外层包另行计算哈希，发布后与本地比较。

### 4.5 必要验证

| 验证对象 | 实际动作 | 完成判断 |
| --- | --- | --- |
| 默认规则 | 未设置自定义目录时调用实际定位入口 | 返回安装包 defaults/；不创建宿主外目录 |
| 默认升级 | 替换测试包内默认规则后再次读取 | 返回新默认值，无旧副本遮蔽 |
| 显式自定义 | 指定独立目录并修改用户规则，再模拟默认升级 | 自定义内容保留，默认流程不受影响 |
| Codex Hook | 真实子进程通过 stdin 输入事件 | stdout 为合法协议 JSON；首次需要时提醒，续接后放行 |
| DSH 生命周期 | 使用真实 Cordis 服务加载、调用工具、投递事件、卸载、再激活 | 工具与监听随生命周期增减，无叠加 |
| 归档 | 独立解压后执行入口并比较规则哈希 | 脱离源码仍可运行；四规则与源一致 |
| 安装与卸载 | 正式命令安装、回读、卸载并检查相关路径 | 版本与启用状态正确，无本插件私有源／登记残留，其他插件不变 |
| 重复登记 | 在隔离用户根目录运行两次，再清理 | 不重复条目、不产生备份、不损坏其他条目 |

Windows 需要覆盖空格路径、目录映射／Junction。Node ESM 导入磁盘绝对路径应使用 pathToFileURL；直接比较 import.meta.url 对应路径与 argv 时注意真实路径解析。Agent Docs 曾因 C 盘用户目录映射到 D 盘，Hook 直接启动判断失败而无输出，必须用真实路径核对并保留回归测试。

真实安装不等于模型语义验收。Hook 子进程正常、配置可解析、工具能返回路径，都不能证明真实模型已完成正确的初始化或维护。跳过项和未验收项必须单独写明。

## 五、README 的安装命令怎么写

命令必须面向另一台机器，不依赖作者源码路径。分开写 GitHub 安装、本地安装、查询、卸载和自定义规则；不能只有 D:/mycode 下的本地包命令。

### 5.1 DSH：固定版本的 Release TGZ

以下 Agent Docs 命令已经存在实际可下载的 0.1.6 附件：

```powershell
dsh plugin --profile web add 'https://github.com/Songyanglin-curious/agent-docs/releases/download/v0.1.6/dsh-agent-docs-0.1.6.tgz'
```

其他插件替换 owner、repo、tag、TGZ 名和 Profile。远程下载不要加 --offline；本地包的 --offline 也要求整个 Profile 依赖缓存齐全。安装成功后说明是否需要重启宿主，并要求从正式 info 工具核对实际路径。

### 5.2 Codex：下载、校验、登记、安装

下面是本项目 README 已采用的方式，其他插件替换三个固定参数和脚本名。下载流程及原生安装分别在本次任务中验证；不能据此跳过新插件自己的完整验收。

```powershell
$ErrorActionPreference = 'Stop'
$base = 'https://github.com/Songyanglin-curious/agent-docs/releases/download/v0.1.6'
$asset = 'codex-agent-docs-0.1.6.zip'
$download = Join-Path $env:TEMP ('plugin-install-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $download | Out-Null
$zip = Join-Path $download $asset
Invoke-WebRequest "$base/$asset" -OutFile $zip
Invoke-WebRequest "$base/SHA256SUMS.txt" -OutFile (Join-Path $download 'SHA256SUMS.txt')
$lines = @(Get-Content (Join-Path $download 'SHA256SUMS.txt') | Where-Object { $_.EndsWith("  $asset") })
if ($lines.Count -ne 1) { throw '校验条目缺失或重复' }
$expected = ($lines[0] -split '  ', 2)[0]
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw '安装包校验失败' }
$unpacked = Join-Path $download 'unpacked'
Expand-Archive -LiteralPath $zip -DestinationPath $unpacked
& (Join-Path $unpacked 'install-codex.ps1')
if (-not $?) { throw '登记失败' }
codex plugin add codex-agent-docs@personal-local --json
if ($LASTEXITCODE -ne 0) { throw '安装失败' }
codex plugin list --marketplace personal-local --json
```

最后核对 version、installed、enabled，以及实际规则路径。Hook 审阅由用户通过宿主完成，不写入 trusted_hash 冒充确认。

### 5.3 卸载命令不能省略

```powershell
dsh plugin --profile web remove dsh-agent-docs
```

Codex：

```powershell
codex plugin remove codex-agent-docs@personal-local --json
& '<解压目录>/uninstall-codex.ps1'
```

说明哪条命令清宿主缓存，哪条清本地源；说明共享文件和显式自定义内容保留。不要承诺删除包管理器共享缓存。

## 六、GitHub 源码与 Release 连续发布步骤

### 6.1 发布前检查

1. 确认目标远程与分支授权；本地当前分支不能自动代表目标发布分支。
2. 确认版本已统一、测试和打包通过、无密钥或本机依赖混入包。
3. README 写当前待发布版本的准确下载地址，手册同步；历史结果不当作本版验收。
4. 文档修改会进入包时，在修改后重新打包并校验，不能上传早先的旧文档包。
5. 确认版本标签、Release 尚未被其他提交或不同附件占用；存在冲突就停止，不强推、不静默覆盖。

### 6.2 提交、推分支和标签

```powershell
git remote -v
git status --short --branch
git add -- <本次发布涉及的文件>
git diff --cached --check
git commit -m '发布插件新版本并更新安装说明'
git tag -a v<版本> -m '发布插件版本'
git push origin main refs/tags/v<版本>
```

仓库默认分支不是 main 时使用实际目标。只有明确需要上传基线时附带具体基线标签，不用 --tags 无差别发布其他本地标签。每步检查退出码，分支或标签 push 失败不继续假称发布成功。

### 6.3 创建 Release 并上传附件

本次实际使用 GitHub REST API 完成，按以下顺序执行：

| 顺序 | 请求 | 要点 |
| --- | --- | --- |
| 1 | POST /repos/{owner}/{repo}/releases | tag_name=v版本，draft=true，写版本说明与真实验证边界 |
| 2 | POST https://uploads.github.com/repos/{owner}/{repo}/releases/{id}/assets?name=附件名 | 用文件二进制上传，Content-Type=application/octet-stream；中文或特殊名称需 URL 编码，推荐 ASCII |
| 3 | 回读已上传附件 | 检查名称、数量、大小；失败则保持草稿，补齐后再发布 |
| 4 | PATCH /repos/{owner}/{repo}/releases/{id} | 所有附件完成后 draft=false |
| 5 | GET /repos/{owner}/{repo}/releases/tags/v版本 | 确认非草稿、标签及附件清单正确 |

上传 DSH TGZ、Codex ZIP、完整安装 ZIP 和 SHA256SUMS.txt。没有用到的一端可以省略，但 README 不能引用不存在的附件。

凭据通过现有 Git 凭据管理器或已认证工具获取，放在内存中的 Authorization 头，不输出令牌、不写进命令示例或仓库。Agent Docs 本次使用 git credential fill 获取 GitHub HTTPS 凭据，但不能假设所有环境都有该凭据；无认证时先解决认证，不能临时硬编码密钥。

不要求其他机器安装 gh。本次未通过 gh 发布，本文不把未经本次执行的 gh 命令标为已验证；其他项目可选择官方 CLI，但仍需满足相同完成检查。

### 6.4 从真实下载地址回验

发布后，从 README 同样的 releases/download/v版本/附件名 地址重新下载，不能只检查上传 API 的返回码：

1. 下载全部附件至独立临时目录。
2. 按远程 SHA256SUMS.txt 核对独立 TGZ／ZIP。
3. 外层完整包与本地最终包比较 SHA-256，确认不是同名旧文件。
4. 检查解压内容、版本和必要脚本；有安装授权时，从远程下载包做干净安装，不用源码目录代替。
5. 回读 main 与本地提交 SHA、标签实际指向和工作区状态。

本次 0.1.6 已完成远程四附件下载校验；两端安装／卸载验收针对发布前本地最终代码，发布后的远程附件与本地最终包一致。不要改写成已经重新进行过一轮远程包真实模型验收。

## 七、常见问题与处理

| 现象 | 本次确认的原因／处理 |
| --- | --- |
| GitHub README 还是旧版 | 本地改动尚未提交推送；先检查 git status 与远程 main，不说“本地写好了”就算发布 |
| main 更新但无法用 URL 安装 | 只推源码没更新 Release；补齐标签、附件和下载回验 |
| 插件版本更新但规则还是旧版 | 自动生成的用户副本优先；默认改读包内规则，自定义只显式启用 |
| 插件文件散落在多个用户目录 | 自建用户根目录和备份体系；采用宿主目录和标准市场，仅保留必要入口 |
| 卸载后本地源还在 | 原生缓存卸载不等于登记源清理；提供限定范围的卸载脚本 |
| Hook 成功退出却没输出 | Windows 映射路径影响入口判断；解析真实路径并测真实子进程 |
| TGZ/ZIP 在源码机器能用，换机器失败 | 引用了工作区模块、漏打依赖规则或点号目录；独立解压运行并检查归档 |
| 配置展开／单元测试通过就说功能通过 | 验收层级混淆；分别记录静态、子进程、真实宿主、安装和模型语义结果 |
| 发布包内文档仍是旧说明 | 改说明后未重打包；最后一次内容变更后重新构建归档 |
| 重复打包混入已删除文件 | 暂存复制不负责删除旧内容；核对同版本暂存区，受控清理后重建 |

## 八、交付前最后核对

- 源码提交、版本标签、manifest、README、附件名和真实下载地址一致。
- 独立包包含全部运行规则与脚本，脱离源码目录可执行。
- 默认读取包内规则，不产生宿主外副本和备份；自定义仅显式启用。
- 原生安装回读正确，完整卸载步骤已验证，其他插件不受影响。
- Release 不是空壳，附件已经重新下载并校验。
- 未验证的模型语义行为和跳过测试如实列出。
- 最终回复同时给出源码提交、Release 链接、安装入口和本机是否已更新，不再让用户追问“安装包在哪里”。

本项目对应材料：[实现说明](实现说明.md)、[安装与测试](安装与测试.md)、[开发与验证](开发与验证.md)。实际安装命令以仓库当前 README 和所选版本附件为准，宿主版本变化后重新验证。
