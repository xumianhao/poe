# 《流放之路1》AGENTS 规则体系重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将根目录 `AGENTS.md` 重构为《流放之路1》攻略项目的强制入口，并建立七份专项规范与策略档案入口，使BD、策略、交易、剧情、版本和纠错工作拥有明确、可验证的执行规则。

**Architecture:** 采用“分层式单入口”：根 `AGENTS.md` 只保存任何任务都不能跳过的项目边界、风险分级、证据原则、任务路由、停止条件、归档触发和交付门槛；详细流程按职责拆入 `项目规范/`。各专项文件通过明确的必读路由组合使用，`交付前检查表.md` 作为统一验收接口，`策略档案/README.md` 定义正式策略档案的命名与最低结构。

**Tech Stack:** Markdown、PowerShell、Git、`rg`。本阶段不引入依赖，不实现完整自动验证器。

## Global Constraints

- 项目仅处理《流放之路1》（Path of Exile 1），禁止混入《流放之路2》事实。
- 所有事实标注适用版本；涉及版本、赛季、价格、掉落、可获取性或交易时必须标注国服、国际服或双服及核验日期。
- 采用分层证据制度：官方与当前客户端负责当前事实，PoE Wiki负责机制与英文原名，PoEDB简体中文站负责简中术语和底层数据，PoB负责指定配置计算，交易站与实测负责市场和策略样本。
- 专有名词首次出现使用 `中文（English）`；国服搜索文本必须引用当前国服客户端或PoEDB简中可见原文，不自行创造官方式译名。
- 每份正式BD或策略按“最低可执行方案 → 稳定方案 → 高投入方案”分层，并标明适用玩家水平。
- 高成本或不可逆操作证据不足时必须停止相关操作建议，只交付已确认部分、保守替代和验证步骤。
- 普通即时问答不落盘；新BD、完整策略、重大版本变化、重要纠错和可复用研究按触发规则归档。
- 当前工作区存在用户未提交的 `AGENTS.md` 修改；该工作区文件是迁移输入，实施中不得用 `git show HEAD:AGENTS.md`、检出、重置或整文件覆盖来替代它。
- 未提交内容默认属于用户；每次提交只暂存当前任务列出的文件。
- 设计依据为 `docs/superpowers/specs/2026-08-16-poe-agents-rules-redesign.md`。
- 本阶段只建立规则、模板与人工验证契约，不实现完整自动验证脚本。

---

## File Structure

- `AGENTS.md`：项目唯一强制入口；包含边界、硬规则、路由、风险、停止条件、归档触发与交付门槛。
- `项目规范/证据来源与术语.md`：来源职责、证据状态、冲突处理、双服与中文术语规范。
- `项目规范/BD分析与归档.md`：PoB快照、统一配置、BD三层结构、升级与归档规则。
- `项目规范/策略攻略与收益.md`：策略分类、角色适配、投入到奖励映射、收益样本与档案结构。
- `项目规范/装备交易与制作.md`：装备目标、交易搜索、双服市场、做装失败分支与止损。
- `项目规范/剧情宝石与工作簿.md`：宝石取得、阶段路线、舆图推进、工作簿触发和验证契约。
- `项目规范/版本管理与纠错.md`：版本状态、更新/新建条件、纠错闭环、知识晋升与文件保护。
- `项目规范/交付前检查表.md`：通用和专项验收清单、验证失败处理。
- `策略档案/README.md`：策略档案命名、最低章节和归档边界；同时让Git跟踪该目录。

## Existing Rule Migration Map

| 当前 `AGENTS.md` 内容 | 迁移目标 |
|---|---|
| 资料来源 | 根入口摘要＋`证据来源与术语.md` |
| 中文与术语 | 根入口硬规则＋`证据来源与术语.md` |
| 宝石取得与剧情路线 | 根入口路由＋`剧情宝石与工作簿.md` |
| BD归档 | 根入口归档触发＋`BD分析与归档.md` |
| 装备制作与成本 | 根入口高风险门槛＋`装备交易与制作.md` |
| 纠错闭环 | 根入口强制触发＋`版本管理与纠错.md` |
| 旧版“所有BD直接追加BD知识库” | 替换为“主档案先归档，跨案例稳定结论才晋升知识库” |

---

### Task 1: 重构根 AGENTS 强制入口

**Files:**
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: 当前工作区 `AGENTS.md` 的全部未提交规则、规格文档第2、3、8、10、11节。
- Produces: 唯一入口文件；后续专项文件必须使用这里定义的准确文件名和任务路由。

- [ ] **Step 1: 保存迁移前证据并核对用户改动**

运行：

```powershell
git status --short -- AGENTS.md
git diff -- AGENTS.md
Get-Content -Raw -LiteralPath AGENTS.md
```

预期：`AGENTS.md` 显示为已修改；当前工作区内容包含资料来源、中文术语、宝石取得、BD归档、装备制作和纠错闭环六组规则。将这些规则视为必须迁移的输入，不恢复到 `HEAD`。

- [ ] **Step 2: 用 `apply_patch` 将根文件重构为以下固定章节**

章节顺序必须是：

```markdown
# 《流放之路1》攻略项目工作规则

## 项目边界
## 所有任务的强制规则
## 风险分级
## 证据不足与停止条件
## 任务路由
## 归档触发
## 纠错强制流程
## 交付门槛
## 用户文件保护
```

必须逐字保留以下语义：

- 仅处理PoE 1；
- 结论标注版本、服务器和必要日期；
- 术语使用 `中文（English）`；
- 分层证据而非机械双源；
- 高风险建议完整核验；
- 证据不足时局部停止；
- 普通问答不落盘；
- 用户纠错先读 `纠错记录.md` 并修复根因及同类记录；
- 未提交内容属于用户。

任务路由必须使用这些相对链接：

```markdown
[证据来源与术语](项目规范/证据来源与术语.md)
[BD分析与归档](项目规范/BD分析与归档.md)
[策略攻略与收益](项目规范/策略攻略与收益.md)
[装备交易与制作](项目规范/装备交易与制作.md)
[剧情宝石与工作簿](项目规范/剧情宝石与工作簿.md)
[版本管理与纠错](项目规范/版本管理与纠错.md)
[交付前检查表](项目规范/交付前检查表.md)
```

路由表必须覆盖普通机制、PoB/BD、T16/T17/祭坛/甲虫、装备交易做装、剧情宝石Excel、版本迁移纠错和正式交付；跨领域任务要求读取全部相关规范。

- [ ] **Step 3: 验证根入口完整且没有把细则重新塞回单文件**

运行：

```powershell
$text = Get-Content -Raw -LiteralPath AGENTS.md
$required = @(
  '仅处理《流放之路1》',
  '风险分级',
  '证据不足',
  '任务路由',
  '归档触发',
  '纠错',
  '交付门槛',
  '用户文件保护',
  '项目规范/证据来源与术语.md',
  '项目规范/交付前检查表.md'
)
$missing = $required | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "AGENTS.md 缺少: $($missing -join ', ')" }
if (($text -split "`n").Count -gt 220) { throw '根入口过长，应把详细流程移入专项规范' }
```

预期：退出码0；根入口包含全部硬规则，且不超过220行。

- [ ] **Step 4: 检查本任务差异并提交**

运行：

```powershell
git diff --check -- AGENTS.md
git diff -- AGENTS.md
git add -- AGENTS.md
git diff --cached --name-only
git commit -m "docs: restructure PoE project agent entrypoint"
```

预期：暂存区只有 `AGENTS.md`；提交成功。

---

### Task 2: 建立证据来源、双服和术语规范

**Files:**
- Create: `项目规范/证据来源与术语.md`

**Interfaces:**
- Consumes: 根 `AGENTS.md` 的风险与路由术语；规格第3节。
- Produces: 所有事实研究任务共同使用的证据状态、来源职责和术语接口。

- [ ] **Step 1: 用 `apply_patch` 创建固定章节**

```markdown
# 证据来源与术语

## 适用范围
## 来源职责
## 证据状态
## 交叉核验标准
## 来源冲突处理
## 国服与国际服
## 简体中文术语
## 社区资料
## 时效性与实时查询
## 引用要求
```

来源职责表必须包含GGG官方、当前客户端/官方静态数据、PoE Wiki、PoEDB简中、PoB、官方交易站/货币市场、poe.ninja、社区攻略和用户实测。

证据状态必须精确定义：`已确认`、`条件成立`、`作者声明`、`实测观察`、`推断`、`未确认`、`历史`。

冲突规则必须包括：当前客户端优先旧数据库；官方当前补丁优先未同步百科；国服文本以当前国服客户端优先、PoEDB简中为默认；PoB不覆盖游戏机制；市场不可跨服；无法判断时披露冲突。

术语规则必须明确：

- 首次出现采用 `中文（English）`；
- PoEDB无可靠简中名时保留英文并说明；
- 不从繁中、社区译名或英文直译生成官方式名称；
- 交易搜索提供客户端实际可见属性行，不把数据库词缀内部名称冒充可搜索文本；
- 英文资料翻译为简中，不保留未翻译的大段英文。

- [ ] **Step 2: 验证职责和状态集合完整**

运行：

```powershell
$path = '项目规范/证据来源与术语.md'
$text = Get-Content -Raw -LiteralPath $path
$terms = @('GGG','PoE Wiki','PoEDB','Path of Building','官方交易站','poe.ninja','已确认','条件成立','作者声明','实测观察','推断','未确认','历史','中文（English）')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "证据规范缺少: $($missing -join ', ')" }
```

预期：退出码0。

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/证据来源与术语.md'
git add -- '项目规范/证据来源与术语.md'
git diff --cached --name-only
git commit -m "docs: add PoE evidence and terminology rules"
```

预期：暂存区只有本任务文件；提交成功。

---

### Task 3: 建立 BD 与 PoB 分析规范

**Files:**
- Create: `项目规范/BD分析与归档.md`

**Interfaces:**
- Consumes: `项目规范/证据来源与术语.md` 的证据状态和术语规则。
- Produces: BD主档案结构、PoB最低检查项、统一比较口径和归档触发。

- [ ] **Step 1: 创建以下固定章节**

```markdown
# BD分析与归档

## 四类数据必须分离
## PoB快照标识
## PoB最低检查项
## 计算条件与Full DPS
## 跨BD和升级比较
## 三层BD方案
## 正式BD档案结构
## 主档案与对比样本
## 知识库晋升条件
## BD交付前自查
```

文件必须明确分离用户当前快照、目标成型PoB、作者声明和代理统一重算数据。

PoB最低检查项必须覆盖版本、职业、升华、等级、主技能变体、等级品质连接、启用状态、实际触发技能与频率、光环诅咒防御位移触发组、装备药剂、天赋专精、普通及星团珠宝、Config、数量口径、自动选择错误触发和自定义条件。

跨BD比较必须统一敌人、技能阶段、数量、触发频率、减益、充能球、近期条件、药剂/爆发覆盖和防御环境；不能统一时禁止倍率结论。

档案结构使用规格第4.4节的17个必填主题，三层方案顺序固定为最低、稳定、高投入。

- [ ] **Step 2: 验证四类数据与关键防错规则存在**

```powershell
$path = '项目规范/BD分析与归档.md'
$text = Get-Content -Raw -LiteralPath $path
$terms = @('用户当前角色快照','目标成型PoB','攻略作者声明','统一配置','实际触发技能','触发频率','星团珠宝','Full DPS','最低可执行方案','稳定方案','高投入方案','对比样本')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "BD规范缺少: $($missing -join ', ')" }
```

预期：退出码0。

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/BD分析与归档.md'
git add -- '项目规范/BD分析与归档.md'
git commit -m "docs: add PoB analysis and build archive rules"
```

---

### Task 4: 建立策略攻略、收益和角色适配规范

**Files:**
- Create: `项目规范/策略攻略与收益.md`
- Create: `策略档案/README.md`

**Interfaces:**
- Consumes: 证据规范；BD规范提供的角色快照与能力数据。
- Produces: 正式策略档案模板、收益样本字段和投入到奖励的映射规则。

- [ ] **Step 1: 创建策略规范固定章节**

```markdown
# 策略攻略与收益

## 覆盖范围与排除项
## 理论最优与角色可执行
## 三层方案
## 前置解锁与操作顺序
## 投入项到奖励类型的映射
## 角色门槛与危险项
## 收益样本字段
## 小样本和作者声明
## 双服差异
## 策略档案结构
## 策略交付前自查
```

覆盖剧情、舆图、虚空石、收藏地图槽、T16/T17、祭坛、圣甲虫、碎片、赛季机制、首领轮转、挑战和装备策略；排除纯套利、囤货和倒卖。

必须明确区分区域物品数量、怪物群规模、特定奖励数量、更多地图、更多通货、更多圣甲虫、祭坛出现、首领专属掉落和每小时周转速度。加入示例规则：“更多地图”不能推导为更多强化首领碎片。

收益字段完整列出版本、服务器、赛季、日期、样本地图数、投入、耗时、原始掉落、易售/难售、挂单/成交、交易时间、死亡失败和净收益区间。

- [ ] **Step 2: 创建策略档案入口与模板**

`策略档案/README.md` 必须定义：

```text
文件名：<版本>-<服务器或双服>-<内容>-<目标>.md
```

必填章节：目标与玩家、版本服务器、前置、机制、理论最优、最低方案、稳定方案、高投入方案、地图/甲虫/碎片/天赋、操作、角色门槛、收益样本、失败止损、双服差异、证据边界。

同时写明普通即时问答不建档，完整可重复策略才建档。

- [ ] **Step 3: 验证策略边界与收益字段**

```powershell
$files = @('项目规范/策略攻略与收益.md','策略档案/README.md')
$text = ($files | ForEach-Object { Get-Content -Raw -LiteralPath $_ }) -join "`n"
$terms = @('理论最优','角色可执行','最低可执行方案','稳定方案','高投入方案','区域物品数量','更多地图','强化首领碎片','样本地图','挂单','成交','净收益','纯市场套利')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "策略规范缺少: $($missing -join ', ')" }
```

预期：退出码0。

- [ ] **Step 4: 检查并提交**

```powershell
git diff --check -- '项目规范/策略攻略与收益.md' '策略档案/README.md'
git add -- '项目规范/策略攻略与收益.md' '策略档案/README.md'
git commit -m "docs: add PoE strategy and yield rules"
```

---

### Task 5: 建立装备、交易和制作规范

**Files:**
- Create: `项目规范/装备交易与制作.md`

**Interfaces:**
- Consumes: 证据规范的双服、术语和实时数据要求；BD规范的当前快照。
- Produces: 交易搜索验收字段、做装步骤契约和止损规则。

- [ ] **Step 1: 创建以下固定章节**

```markdown
# 装备交易与制作

## 先定义装备目标
## 交易搜索类型
## PoB权重搜索
## 国服与国际服链接验证
## 市场样本与流动性
## 操作授权边界
## 做装前置核验
## 做装步骤与失败分支
## 止损与成品购买对比
## 装备与做装交付前自查
```

交易类型必须包含精确物品/底材、人工词缀、PoB权重、批量通货/消耗品、国服和国际服。PoB权重搜索必须包含有效 `weight`，不能被手工过滤器代替。

市场规则必须区分最低挂单、可成交价格带、批量价格、流动性和实际成交，并记录服务器、赛季、时间、条件和样本。未经明确授权，不登录、联系卖家、下单或购买。

做装核验必须覆盖底材、物品等级、影响、词缀类别/标签/等级/权重、可用工艺、前后缀空间、元工艺、腐化/分裂/隐匿等不可逆步骤、版本和双服材料。

每条路线包含准备、每步目的、成功判定、可接受半成品、失败回收、不可逆节点、单步停止、总止损、成品购买对比、替代品和升级顺序。

- [ ] **Step 2: 验证交易和止损规则完整**

```powershell
$path = '项目规范/装备交易与制作.md'
$text = Get-Content -Raw -LiteralPath $path
$terms = @('PoB权重','weight','国服','国际服','最低挂单','成交','流动性','不登录','物品等级','词缀标签','权重','失败回收','不可逆','止损','直接购买')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "装备规范缺少: $($missing -join ', ')" }
```

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/装备交易与制作.md'
git add -- '项目规范/装备交易与制作.md'
git commit -m "docs: add PoE trade and crafting rules"
```

---

### Task 6: 建立剧情、宝石和工作簿规范

**Files:**
- Create: `项目规范/剧情宝石与工作簿.md`

**Interfaces:**
- Consumes: 证据规范的术语、任务和版本要求。
- Produces: 宝石取得记录字段、阶段路线约束和工作簿人工验证契约。

- [ ] **Step 1: 创建以下固定章节**

```markdown
# 剧情宝石与工作簿

## PoB阶段组的证据边界
## 单颗宝石取得记录
## 职业可领取与可购买
## 互斥奖励和替代来源
## 阶段技能组
## 剧情路线
## 舆图推进与解锁
## 工作簿触发条件
## 工作簿标准结构
## 导出前验证契约
## 视觉检查
```

单颗宝石字段必须包含中英文名、需求等级、章节、前置任务、NPC、职业领取、职业购买、互斥、萨欧赛、莉莉、特殊来源和最早稳定阶段。

阶段组必须覆盖主连接、辅助、光环、诅咒、守护、防御、位移、触发、首领工具、练级宝石、切换条件和颜色/装备条件。禁止使用早于取得。

剧情路线必须包含必做/可跳过任务、天赋点、试炼、抗性惩罚、装备检查、技能切换、防御成型、异界前检查及白黄红图、虚空石、收藏地图槽目标，并区分快速与新手稳定路线。

工作簿只在用户要求逐步路线、采购、阶段对比或筛选数据时生成；导出前验证覆盖、职业、时点、互斥、连续性、统一数据、版本来源、当前事实源和视觉布局。

- [ ] **Step 2: 验证宝石覆盖规则完整**

```powershell
$path = '项目规范/剧情宝石与工作簿.md'
$text = Get-Content -Raw -LiteralPath $path
$terms = @('需求等级','前置任务','NPC','当前职业','互斥','萨欧赛','莉莉·罗思','最早稳定取得阶段','使用阶段','虚空石','收藏地图槽','统一数据','视觉检查')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "剧情规范缺少: $($missing -join ', ')" }
```

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/剧情宝石与工作簿.md'
git add -- '项目规范/剧情宝石与工作簿.md'
git commit -m "docs: add PoE campaign gem and workbook rules"
```

---

### Task 7: 建立版本、纠错和知识生命周期规范

**Files:**
- Create: `项目规范/版本管理与纠错.md`

**Interfaces:**
- Consumes: `纠错记录.md` 的现有字段和根入口的归档触发。
- Produces: 全领域共用的版本状态、更新/新建判定和纠错流程。

- [ ] **Step 1: 创建以下固定章节**

```markdown
# 版本管理与纠错

## 正式产物版本字段
## 当前、部分兼容、待复核与历史
## 原地更新条件
## 新版本档案条件
## 当前赛季可获取性
## 纠错触发
## 纠错十步流程
## 纠错记录字段
## 同类记录扫描
## 知识晋升与淘汰
## 用户文件保护
```

原地更新和新档案条件使用规格第9节。明确“数据库页面仍存在”不能证明当前赛季可获取，旧价格和收益不得沿用。

纠错流程固定为：暂停旧结论、读同类记录、重新核验、明确正误、定位根因、全项目搜索、更新受影响产物、写纠错、重跑检查、向用户报告。

纠错记录字段固定为错误说法、正确结论、错误原因、影响范围、修复内容、核验来源和防复发规则/自动检查。

知识晋升路径固定为即时回答→BD/策略档案→BD知识库→纠错/历史；截图、小样本和单作者观点不得直接晋升。

- [ ] **Step 2: 验证生命周期和纠错字段**

```powershell
$path = '项目规范/版本管理与纠错.md'
$text = Get-Content -Raw -LiteralPath $path
$terms = @('当前','部分兼容','待复核','历史','原地更新','新版本档案','当前赛季可获取性','错误说法','正确结论','错误原因','影响范围','防止复发','全项目','未提交内容')
$missing = $terms | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "版本纠错规范缺少: $($missing -join ', ')" }
```

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/版本管理与纠错.md'
git add -- '项目规范/版本管理与纠错.md'
git commit -m "docs: add PoE version and correction lifecycle"
```

---

### Task 8: 建立统一交付检查表与失败处理

**Files:**
- Create: `项目规范/交付前检查表.md`

**Interfaces:**
- Consumes: 六份专项规范的验收字段。
- Produces: 所有正式交付共用的最终人工验收清单。

- [ ] **Step 1: 创建可勾选的固定章节**

```markdown
# 交付前检查表

## 使用方法
## 通用检查
## BD与PoB
## 策略与收益
## 装备、交易与做装
## 剧情、宝石与工作簿
## 版本迁移与纠错
## 验证失败处理
```

所有检查项使用 `- [ ]`。通用检查至少覆盖游戏、版本、赛季、服务器、日期、术语、证据状态、历史数据、具体来源、冲突、高成本止损、适用水平、三层方案、链接和占位符。

专项检查完整映射规格第10节。失败处理明确：失败时不得声称完成；列出失败项和影响；可修复则修复重验；外部资料缺失时只交付确认部分；高风险核心缺失时停止相关建议；不得因时间或篇幅跳过检查。

- [ ] **Step 2: 验证所有专项检查存在且采用复选框**

```powershell
$path = '项目规范/交付前检查表.md'
$text = Get-Content -Raw -LiteralPath $path
$sections = @('通用检查','BD与PoB','策略与收益','装备、交易与做装','剧情、宝石与工作簿','版本迁移与纠错','验证失败处理')
$missing = $sections | Where-Object { -not $text.Contains($_) }
if ($missing) { throw "检查表缺少: $($missing -join ', ')" }
$checks = ([regex]::Matches($text, '(?m)^- \[ \] ')).Count
if ($checks -lt 45) { throw "检查项不足: $checks，最低45项" }
```

预期：退出码0，至少45个可勾选检查项。

- [ ] **Step 3: 检查并提交**

```powershell
git diff --check -- '项目规范/交付前检查表.md'
git add -- '项目规范/交付前检查表.md'
git commit -m "docs: add PoE delivery validation checklist"
```

---

### Task 9: 执行集成验证和规格覆盖审计

**Files:**
- Verify: `AGENTS.md`
- Verify: `项目规范/*.md`
- Verify: `策略档案/README.md`
- Reference: `docs/superpowers/specs/2026-08-16-poe-agents-rules-redesign.md`

**Interfaces:**
- Consumes: Tasks 1–8全部文件。
- Produces: 经交叉链接、结构、内容、占位符和Git范围检查的完整规则体系。

- [ ] **Step 1: 验证所有规划文件存在**

```powershell
$requiredFiles = @(
  'AGENTS.md',
  '项目规范/证据来源与术语.md',
  '项目规范/BD分析与归档.md',
  '项目规范/策略攻略与收益.md',
  '项目规范/装备交易与制作.md',
  '项目规范/剧情宝石与工作簿.md',
  '项目规范/版本管理与纠错.md',
  '项目规范/交付前检查表.md',
  '策略档案/README.md'
)
$missing = $requiredFiles | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missing) { throw "缺少文件: $($missing -join ', ')" }
```

- [ ] **Step 2: 验证根入口链接全部可解析**

```powershell
$root = Get-Content -Raw -LiteralPath AGENTS.md
$links = [regex]::Matches($root, '\]\(([^)]+\.md)\)') | ForEach-Object { $_.Groups[1].Value }
$missingLinks = $links | Where-Object { -not (Test-Path -LiteralPath $_) }
if ($missingLinks) { throw "失效链接: $($missingLinks -join ', ')" }
```

- [ ] **Step 3: 扫描占位符、PoE 2混入和旧机械双源规则**

运行：

```powershell
$files = @('AGENTS.md') + (Get-ChildItem -LiteralPath '项目规范' -Filter '*.md' | ForEach-Object FullName) + @((Resolve-Path '策略档案/README.md').Path)
$bad = Select-String -Path $files -Pattern 'TBD|TODO|FIXME|待补充|之后填写|所有.*事实必须.*同时.*PoE Wiki.*PoEDB|流放之路2|Path of Exile 2'
$allowed = $bad | Where-Object { $_.Line -notmatch '禁止混入|不处理|扫描|占位符' }
if ($allowed) { $allowed | Format-Table -AutoSize; throw '发现占位符、PoE 2事实或旧机械双源规则' }
```

预期：退出码0。允许规则中出现“禁止混入《流放之路2》”以及检查表中的占位符检查字样，不允许出现PoE 2游戏事实。

- [ ] **Step 4: 审计规格关键要求是否均有落点**

```powershell
$all = (@('AGENTS.md') + (Get-ChildItem -LiteralPath '项目规范' -Filter '*.md' | ForEach-Object FullName) + @((Resolve-Path '策略档案/README.md').Path) | ForEach-Object { Get-Content -Raw -LiteralPath $_ }) -join "`n"
$requirements = @(
  '仅处理《流放之路1》',
  '最低可执行方案',
  '稳定方案',
  '高投入方案',
  '用户当前角色快照',
  '目标成型PoB',
  '作者声明',
  '实测观察',
  '国服',
  '国际服',
  '纯市场套利',
  '样本地图',
  '止损',
  '萨欧赛',
  '莉莉·罗思',
  '知识晋升',
  '验证失败'
)
$missing = $requirements | Where-Object { -not $all.Contains($_) }
if ($missing) { throw "规格覆盖缺口: $($missing -join ', ')" }
```

预期：退出码0，没有规格覆盖缺口。

- [ ] **Step 5: 验证Markdown差异和工作区保护**

```powershell
git diff --check
git status --short
git log --oneline -10
```

预期：`git diff --check` 无错误；最近提交与Tasks 1–8的文档提交对应；用户原有其他修改和未跟踪文件仍存在且未被纳入这些提交。

- [ ] **Step 6: 如集成验证要求修正文档，单独提交修复**

仅当Steps 1–5发现问题时，用 `apply_patch` 修复对应文档，重新完整运行Steps 1–5，然后执行：

```powershell
git add -- AGENTS.md '项目规范/*.md' '策略档案/README.md'
git diff --cached --name-only
git commit -m "docs: align PoE agent rules with approved spec"
```

预期：只提交规则体系文件；如果无需修复，则跳过本步骤，不创建空提交。

---

## Final Verification

实施结束前重新运行Task 9的全部验证命令，并人工对照以下验收结论：

- 根入口可独立说明边界、风险、路由、停止条件、归档和交付门槛；
- 七份专项文件职责不重叠且没有关键规则空缺；
- 当前 `AGENTS.md` 的六组有效规则已经迁移；
- 双服、分层证据、PoB四类数据、策略收益、三层方案和止损成为强制规则；
- `策略档案/README.md` 提供可直接复制的正式档案结构；
- 未实现超出本规格的完整自动验证器；
- 用户的其他未提交文件没有被修改、暂存或提交。
