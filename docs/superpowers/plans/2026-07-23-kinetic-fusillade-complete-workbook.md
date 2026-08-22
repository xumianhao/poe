# 念动齐射弩炮圣宗完整版工作簿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有开荒工作簿扩展成包含正确采购、完整技能、1–111点天赋、装备升级、低成本做装和切换检查的 3.29 念动齐射弩炮圣宗执行手册，并同步更新 BD 档案和纠错记录。

**Architecture:** 以一个可审计的 JSON 数据文件作为所有工作表的单一事实来源；独立验证脚本先检查宝石可用性、阶段引用、天赋连续性、洗点平衡和冲突规则，再由现有 `@oai/artifact-tool` 构建器生成工作簿。PoB 只提供阶段节点集合，逐点顺序通过相邻阶段差异和天赋树连接关系推导，并在工作簿中明确标为推导顺序。

**Tech Stack:** PowerShell、bundled Node.js、`@oai/artifact-tool`、PoB XML、PoE 被动天赋树 JSON、Markdown。

## Global Constraints

- PoE 事实必须按当前版本结合 PoE Wiki 与 PoEDB 简体中文站核验。
- 专有名词首次出现使用 `中文（English）`，中文以 PoEDB 简体中文为准。
- PoB 阶段标签不得直接作为任务奖励或商店解锁依据。
- 每颗剧情宝石必须核对需求等级、章节、前置任务、NPC和圣堂武僧职业可用性。
- 工作簿只能使用 loader 提供的 bundled Node.js 和 `@oai/artifact-tool` 修改。
- 不使用 `openpyxl`、`xlsxwriter` 或 `pandas.ExcelWriter`。
- 输出保存到 `outputs/019f8f0e-9837-7441-be00-398949eecd4b/`，不覆盖 `C:/Users/ares/Desktop/poe2.xlsx`。
- 当前 Git 未配置 `user.name` 和 `user.email`；不得擅自设置身份，实施过程中不创建提交。

---

## File Structure

- `.tmp-kinetic-workbook/source-data.json`：统一保存阶段、宝石、天赋点、洗点、装备、做装、切换检查和来源。
- `.tmp-kinetic-workbook/validate-data.mjs`：对统一数据执行采购、天赋、阶段和冲突验证。
- `.tmp-kinetic-workbook/build-workbook.mjs`：读取统一数据并生成全部工作表。
- `.tmp-kinetic-workbook/verify-workbook.mjs`：导入最终工作簿，检查关键区域、公式错误并渲染所有工作表。
- `.tmp-kinetic-workbook/previews/`：保存验证用 PNG，不作为交付文件。
- `outputs/019f8f0e-9837-7441-be00-398949eecd4b/念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`：最终工作簿。
- `BD档案/3.29-念动齐射弩炮图腾-圣宗-Palsteron.md`：更新后的独立 BD 档案。
- `BD档案/3.28-念动齐射弩炮图腾-圣宗-Palsteron.md`：迁移后删除，避免同一 BD 存在矛盾版本文件。
- `纠错记录.md`：补充修复位置和最终防错规则。

---

### Task 1: 建立可失败的数据验证与采购纠错

**Files:**
- Create: `.tmp-kinetic-workbook/source-data.json`
- Create: `.tmp-kinetic-workbook/validate-data.mjs`
- Modify: `.tmp-kinetic-workbook/build-workbook.mjs`

**Interfaces:**
- Consumes: PoB 阶段名称、现有 `build-data.json`、PoEDB 宝石任务页面。
- Produces: `source-data.json`；`validate-data.mjs` 退出码 0 表示所有结构规则通过。

- [ ] **Step 1: 创建最小数据骨架并故意保留第18行错误**

`source-data.json` 顶层结构固定为：

```json
{
  "version": "3.29",
  "build": {
    "name": "念动齐射弩炮圣宗",
    "pob": "https://pobb.in/VYkCtsG0KTaF"
  },
  "stages": [],
  "routeRows": [],
  "gems": [],
  "passiveOrder": [],
  "respecs": [],
  "ascendancy": [],
  "skillStages": [],
  "gearStages": [],
  "craftingRoutes": [],
  "switchChecks": [],
  "purchases": [],
  "sources": []
}
```

为采购宝石使用以下字段：

```json
{
  "id": "herald-of-ash",
  "cn": "灰烬之捷",
  "en": "Herald of Ash",
  "requiredLevel": 16,
  "act": 2,
  "quest": "黑色入侵者",
  "npc": "任务奖励",
  "classes": ["全职业"],
  "source": "https://poedb.tw/cn/Herald_of_Ash"
}
```

- [ ] **Step 2: 编写会抓住第18行错误的验证器**

`validate-data.mjs` 必须实现并导出：

```js
export function validateGemAvailability(data) {
  const errors = [];
  const gems = new Map(data.gems.map((gem) => [gem.id, gem]));
  for (const row of data.routeRows) {
    for (const gemId of row.gemIds ?? []) {
      const gem = gems.get(gemId);
      if (!gem) {
        errors.push(`route ${row.index}: unknown gem ${gemId}`);
        continue;
      }
      if (gem.act > row.actNumber) {
        errors.push(`route ${row.index}: ${gem.cn} requires Act ${gem.act}`);
      }
      const templarAllowed =
        gem.classes.includes("全职业") || gem.classes.includes("圣堂武僧");
      if (!templarAllowed) {
        errors.push(`route ${row.index}: ${gem.cn} unavailable to Templar`);
      }
    }
  }
  return errors;
}
```

脚本末尾汇总错误并使用非零退出码：

```js
const errors = [
  ...validateGemAvailability(data),
  ...validateStageReferences(data),
  ...validatePassiveOrder(data),
  ...validateRespecs(data),
  ...validateConflicts(data)
];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("VALIDATION_OK");
}
```

- [ ] **Step 3: 运行验证并确认错误可重现**

Run:

```powershell
& 'C:\Users\ares\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.tmp-kinetic-workbook\validate-data.mjs'
```

Expected: 非零退出码，并至少包含：

```text
route 18: 灰烬之捷 requires Act 2
route 18: 闪电之捷 requires Act 2
route 18: 快速施法（辅） requires Act 2
route 18: 定罪波 requires Act 2
```

- [ ] **Step 4: 修正采购数据**

第18行只保留：

```json
["combustion-support", "clarity"]
```

第二章对应路线节点分别加入：

```json
{
  "event": "黑色入侵者",
  "gemIds": ["herald-of-ash", "herald-of-thunder", "wave-of-conviction"]
}
```

```json
{
  "event": "清理蜘蛛",
  "gemIds": ["faster-casting-support"]
}
```

- [ ] **Step 5: 再次验证采购**

Run: 与 Step 3 相同。

Expected: 不再出现 `requires Act 2` 或 `unavailable to Templar`。

---

### Task 2: 解析并验证第1点到第111点天赋路线

**Files:**
- Modify: `.tmp-kinetic-workbook/source-data.json`
- Modify: `.tmp-kinetic-workbook/validate-data.mjs`
- Create: `.tmp-kinetic-workbook/passive-tree-source.json`

**Interfaces:**
- Consumes: PoB 中 15 个 `<Spec>` 节点集合、当前版本被动树的节点名称和连接关系。
- Produces: `passiveOrder[111]`、三组 `respecs`、独立 `ascendancy` 表。

- [ ] **Step 1: 保存天赋树来源快照**

`passive-tree-source.json` 只保留本 BD 使用的节点，格式为：

```json
{
  "treeVersion": "3.29",
  "nodes": {
    "12345": {
      "cn": "天赋中文名",
      "en": "Passive English Name",
      "type": "notable",
      "connections": ["23456", "34567"],
      "source": "PoB tree data"
    }
  },
  "specs": {
    "A1": ["节点ID"],
    "A2": ["节点ID"],
    "A3": ["节点ID"],
    "A3 (after Respec)": ["节点ID"],
    "A4": ["节点ID"],
    "A5": ["节点ID"],
    "A6": ["节点ID"],
    "A7": ["节点ID"],
    "A8": ["节点ID"],
    "A9": ["节点ID"],
    "A10": ["节点ID"],
    "A10 (Crit Respec)": ["节点ID"],
    "EarlyMaps": ["节点ID"],
    "BeforeAegis": ["节点ID"],
    "AegisRespec": ["节点ID"]
  }
}
```

小点若没有独立专名，使用其实际属性作为中文名，例如“法术伤害提高 10%（10% increased Spell Damage）”，不得虚构大点名称。

- [ ] **Step 2: 生成有效的推导顺序**

对相邻阶段执行集合差分。每个阶段新增节点必须满足以下顺序规则：

1. 已与上一阶段树连接的路径节点优先。
2. 同一分支从入口向大点排序。
3. 专精紧跟在解锁该专精的天赋圈之后。
4. 珠宝孔在工作簿规定的珠宝实际可用阶段才投入。
5. 多条同样有效的路径按 PoB 页面显示的阶段重点排序，并标注“推导顺序”。

写入记录格式：

```json
{
  "point": 1,
  "suggestedLevel": 2,
  "act": "第1章",
  "nodeId": "12345",
  "cn": "天赋中文名",
  "en": "Passive English Name",
  "type": "小点",
  "cluster": "圣堂武僧起点",
  "prerequisite": "起点",
  "purpose": "提高剧情法术伤害",
  "category": "伤害",
  "pobStage": "A1",
  "temporary": false,
  "source": "https://pobb.in/VYkCtsG0KTaF"
}
```

- [ ] **Step 3: 编写连续性、唯一性和连接验证**

`validatePassiveOrder` 必须检查：

```js
export function validatePassiveOrder(data, tree) {
  const errors = [];
  const points = data.passiveOrder.map((row) => row.point);
  const expected = Array.from({ length: 111 }, (_, index) => index + 1);
  if (JSON.stringify(points) !== JSON.stringify(expected)) {
    errors.push("passive points must be exactly 1..111");
  }
  const nodeIds = data.passiveOrder.map((row) => row.nodeId);
  if (new Set(nodeIds).size !== nodeIds.length) {
    errors.push("passive order contains duplicate final nodes");
  }
  const allocated = new Set();
  for (const row of data.passiveOrder) {
    const node = tree.nodes[row.nodeId];
    if (!node) {
      errors.push(`point ${row.point}: unknown node ${row.nodeId}`);
      continue;
    }
    if (
      allocated.size > 0 &&
      !node.connections.some((connection) => allocated.has(connection)) &&
      row.prerequisite !== "起点"
    ) {
      errors.push(`point ${row.point}: node ${row.nodeId} is disconnected`);
    }
    allocated.add(row.nodeId);
  }
  return errors;
}
```

- [ ] **Step 4: 建立三组洗点记录**

每组记录使用：

```json
{
  "name": "A10 元素超载转暴击",
  "stage": "A10 (Crit Respec)",
  "remove": ["节点ID"],
  "add": ["节点ID"],
  "refundPointsRequired": 0,
  "requirements": ["命中合格", "基础暴击与暴击球体系完成"],
  "reason": "进入暴击体系后元素超载不再适用"
}
```

`refundPointsRequired` 必须等于 `remove.length`；新增节点来自同阶段可用普通点或被移除点，不能制造额外点数。

- [ ] **Step 5: 验证天赋数据**

Run:

```powershell
& 'C:\Users\ares\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.tmp-kinetic-workbook\validate-data.mjs'
```

Expected:

```text
PASSIVE_ORDER_111_OK
RESPECS_BALANCED
```

---

### Task 3: 完成阶段技能、装备、做装和切换规则

**Files:**
- Modify: `.tmp-kinetic-workbook/source-data.json`
- Modify: `.tmp-kinetic-workbook/validate-data.mjs`

**Interfaces:**
- Consumes: PoB 的 6 套技能、7 套装备和统一 16 阶段。
- Produces: `skillStages`、`gearStages`、`craftingRoutes`、`switchChecks`。

- [ ] **Step 1: 填入完整技能阶段**

每阶段使用：

```json
{
  "stageId": "aegis-respec",
  "mainLinks": [
    "念动齐射（Kinetic Fusillade）",
    "弩炮图腾（辅）（Ballista Totem Support）",
    "持续时间缩短（辅）（Less Duration Support）",
    "高阶齐射（辅）（Greater Volley Support）",
    "增加暴击伤害（辅）（Increased Critical Damage Support）",
    "逆转规则（辅）（Invert the Rules Support）"
  ],
  "auras": ["愤怒（Anger）", "坚定（Determination）", "暴风之盾（Tempest Shield）"],
  "bossTools": ["奥术烙印（Arcanist Brand）", "烈焰之墙（Flame Wall）", "狙击之印（Sniper's Mark）", "龙卷风（Tornado）"],
  "defence": ["熔岩护盾（Molten Shell）", "受伤时施放（辅）（Cast when Damage Taken Support）"],
  "conflicts": ["元素要害", "元素曝露", "其它降低元素抗性的来源"]
}
```

- [ ] **Step 2: 填入逐部位装备升级**

装备阶段至少覆盖：

```text
A1 火焰法术法杖与盾
A3 攻击元素点伤法杖
德瑞的精神手套
幻彩菱织
早期地图生命抗性装
威尔玛的报偿
高元素点伤法杖
苦难羁绊
幻芒圣盾
护甲版意义的光辉
碎镞雨
致命的骄傲
追求级护甲／能量护盾稀有装
```

每条装备记录包含 `current`、`next`、`requiredMods`、`optionalMods`、`avoidMods`、`replacementRequirements` 和 `source`。

- [ ] **Step 3: 填入低成本做装路线**

法杖路线必须包含：

```json
{
  "slot": "法杖",
  "stageId": "early-maps",
  "base": "适用等级的法杖底材",
  "minimum": ["两条有效攻击附加元素伤害或一条高阶点伤＋法术伤害"],
  "ideal": ["高冰冷点伤", "高闪电点伤", "暴击率", "可用工艺后缀"],
  "steps": [
    "先比较同类成品市价",
    "用当前预算可承受的元素伤害精髓锁定一条点伤",
    "出现第二条有效伤害词缀时保留",
    "用工艺台补暴击率、元素穿透或当前缺失词缀"
  ],
  "stopLoss": "连续投入超过同类可用成品价格时停止自制",
  "avoid": ["会破坏念动齐射释放节奏的无计划攻速"]
}
```

胸甲、手套、鞋、戒指、腰带和珠宝使用相同结构，必须写明失败品用途与购买替代。

- [ ] **Step 4: 建立五个切换检查**

每个检查项使用布尔条件描述：

```json
{
  "name": "幻芒圣盾切换",
  "required": [
    "已拥有幻芒圣盾",
    "已拥有护甲版意义的光辉",
    "防具已换成可用的护甲／能量护盾底材",
    "未开启花岗岩药剂时护甲接近当前PoB阶段目标",
    "格挡、抗性、属性和能量护盾没有因换装断档"
  ],
  "doNotSwitchIf": [
    "总护甲仍约一万",
    "只有幻芒圣盾但没有其它护甲来源",
    "开启斗转星移后没有格挡回复"
  ]
}
```

- [ ] **Step 5: 增加跨阶段冲突验证**

`validateConflicts` 必须拒绝：

```js
if (
  stage.mainLinks?.some((name) => name.includes("逆转规则")) &&
  stage.activeDebuffs?.some((name) => /元素要害|曝露|降低.*抗性/.test(name))
) {
  errors.push(`${stage.stageId}: Invert the Rules conflicts with resistance reduction`);
}
```

同时检查元素超载与暴击阶段、斗转星移与格挡回复装备的组合。

---

### Task 4: 重建工作簿并保持现有视觉体系

**Files:**
- Modify: `.tmp-kinetic-workbook/build-workbook.mjs`
- Modify: `.tmp-kinetic-workbook/build-data.json`
- Create: `.tmp-kinetic-workbook/previews/*.png`
- Modify: `outputs/019f8f0e-9837-7441-be00-398949eecd4b/念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`

**Interfaces:**
- Consumes: 验证通过的 `source-data.json`。
- Produces: 9 张工作表的最终 `.xlsx`。

- [ ] **Step 1: 在修改前渲染当前工作簿**

使用 `SpreadsheetFile.importXlsx` 导入现有工作簿，渲染现有五张表的使用区域并检查标题、表头、颜色、列宽和长文本换行。不得使用 Excel 自动套用全表格式。

- [ ] **Step 2: 将构建器改为只读取统一数据**

构建器入口固定为：

```js
const data = JSON.parse(
  await fs.readFile(path.join(workDir, "source-data.json"), "utf8")
);
```

移除重复硬编码的 `upgrades`、`skillStages`、`purchases` 和 `gearStages`，避免数据源分叉。

- [ ] **Step 3: 生成九张工作表**

顺序固定为：

```js
[
  "阶段总览",
  "逐图路线",
  "技能阶段",
  "天赋路线",
  "装备升级",
  "做装路线",
  "切换检查",
  "采购清单",
  "来源与说明"
]
```

沿用现有深蓝标题、蓝色表头及路线类型配色。每张表设置冻结窗格、筛选表格、合理列宽、自动换行和行高上限。

- [ ] **Step 4: 写入天赋主表、升华表和洗点表**

`天赋路线`布局：

```text
A1:N1  标题
A3:N114 第1点到第111点主表
A117:H122 升华顺序
A125:J... 洗点操作
```

主表必须通过公式或写入检查显示 111 行；不得用合并单元格破坏筛选。

- [ ] **Step 5: 导出工作簿**

Run:

```powershell
& 'C:\Users\ares\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.tmp-kinetic-workbook\build-workbook.mjs'
```

Expected: 退出码 0，并报告 9 张工作表和输出路径。

---

### Task 5: 更新 BD 档案与纠错闭环

**Files:**
- Create: `BD档案/3.29-念动齐射弩炮图腾-圣宗-Palsteron.md`
- Delete: `BD档案/3.28-念动齐射弩炮图腾-圣宗-Palsteron.md`
- Modify: `纠错记录.md`

**Interfaces:**
- Consumes: 与工作簿相同的统一阶段和已核验来源。
- Produces: 唯一、无冲突的 3.29 BD 档案。

- [ ] **Step 1: 迁移并重写 BD 档案**

新档案固定包含：

```text
基本信息
核心机制
技能阶段
第1点到第111点天赋路线说明
三次洗点
升华顺序
装备阶段
低成本做装
五次关键切换
伤害闭环
防御闭环
剧情到终局
常见错误
来源
```

删除与当前 PoB 不一致的终局六连、狂怒触发和旧版本数字。

- [ ] **Step 2: 更新纠错记录**

在 2026-07-23 条目中补充：

```text
修复状态：已修复工作簿逐图路线、采购清单和技能阶段表。
新增验证：采购宝石逐颗验证；统一数据验证通过后才能导出。
```

- [ ] **Step 3: 检查旧文件不存在**

Run:

```powershell
Test-Path -LiteralPath 'BD档案\3.28-念动齐射弩炮图腾-圣宗-Palsteron.md'
Test-Path -LiteralPath 'BD档案\3.29-念动齐射弩炮图腾-圣宗-Palsteron.md'
```

Expected:

```text
False
True
```

---

### Task 6: 最终数据、公式和视觉验证

**Files:**
- Modify: `.tmp-kinetic-workbook/verify-workbook.mjs`
- Inspect: `outputs/019f8f0e-9837-7441-be00-398949eecd4b/念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`

**Interfaces:**
- Consumes: 最终 `.xlsx`、`source-data.json`。
- Produces: 可交付验证结果和全部工作表预览。

- [ ] **Step 1: 运行数据验证**

Run:

```powershell
& 'C:\Users\ares\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.tmp-kinetic-workbook\validate-data.mjs'
```

Expected:

```text
VALIDATION_OK
PASSIVE_ORDER_111_OK
RESPECS_BALANCED
```

- [ ] **Step 2: 检查关键工作簿范围**

`verify-workbook.mjs` 使用：

```js
await workbook.inspect({
  kind: "table",
  range: "天赋路线!A3:N114",
  include: "values,formulas",
  tableMaxRows: 112,
  tableMaxCols: 14
});
```

并确认：

```text
首个点数 = 1
末个点数 = 111
数据行数 = 111
第18行不包含灰烬之捷、闪电之捷、快速施法或定罪波
```

- [ ] **Step 3: 扫描公式错误**

```js
await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan"
});
```

Expected: 0 个匹配。

- [ ] **Step 4: 渲染九张工作表**

对每张工作表渲染使用区域；长表至少分别渲染顶部、中部和底部。逐张检查：

```text
标题未截断
表头可读
长文本已换行
列宽不过度膨胀
颜色与现有样式一致
没有空白默认工作表
```

- [ ] **Step 5: 仅修复验证发现的问题并重新运行完整验证**

不得在最终验证阶段增加新功能。每次修复后重新运行 Task 6 的 Step 1–4，直到全部通过。

