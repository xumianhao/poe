# 念动齐射弩炮圣宗开荒工作簿实施计划

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 参考 `poe2.xlsx` 第一张工作表的逐图开荒样式，生成一份独立的 3.29 念动齐射（Kinetic Fusillade）弩炮图腾（Ballista Totem）圣宗（Hierophant）中文开荒工作簿。

**Architecture:** 从原工作簿只读提取章节与区域顺序，结合 3.29 配套视频、PoB、PoE Wiki 与 PoEDB 中文资料，重组为“逐图路线、技能阶段、采购清单、装备升级、来源与说明”五张表。所有专有名词首次出现采用“中文（English）”，购买、领取、技能切换和装备检查使用一致的颜色编码。

**Tech Stack:** Node.js、`@oai/artifact-tool`、Excel `.xlsx`

---

### Task 1: 提取参考表结构与逐图路线

**Files:**
- Read: `C:\Users\ares\Desktop\poe2.xlsx`
- Create: `C:\Users\ares\Documents\流放之路\.tmp-kinetic-workbook\extract-reference.mjs`

**Step 1: 导入参考工作簿**

使用 `SpreadsheetArtifact.load` 加载原文件，读取第一张表名称、使用范围、合并单元格、列宽和 B:C 主数据。

**Step 2: 导出路线数据**

把非空区域名称和动作说明整理为 JSON，保留章节、城镇、地图、任务、传送点、首领与试炼顺序。

**Step 3: 检查提取结果**

抽查第一章、中段章节和第十章，确认没有因合并单元格或空行丢失路线节点。

### Task 2: 核验 3.29 BD 进度数据

**Files:**
- Create: `C:\Users\ares\Documents\流放之路\.tmp-kinetic-workbook\build-data.json`

**Step 1: 整理视频和 PoB 的阶段策略**

记录剧情技能、切换念动齐射弩炮的条件、升华顺序、防御层、地图阶段和幻芒圣盾（Aegis Aurora）切换条件。

**Step 2: 核验专有名词**

技能、辅助技能、天赋、装备、传奇与词缀中文名以 PoEDB 中文页为准，并保留英文原名。

**Step 3: 推导逐图操作**

把通用剧情路线和本 BD 的购买、领取、技能切换、插槽检查、抗性与装备检查合并；不能确定的版本差异明确标记为“版本核对项”。

### Task 3: 生成独立工作簿

**Files:**
- Create: `C:\Users\ares\Documents\流放之路\.tmp-kinetic-workbook\build-workbook.mjs`
- Create: `C:\Users\ares\Documents\流放之路\outputs\019f8f0e-9837-7441-be00-398949eecd4b\念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`

**Step 1: 创建五张工作表**

建立“逐图路线、技能阶段、采购清单、装备升级、来源与说明”。

**Step 2: 写入逐图路线**

列包含序号、章节、地图/城镇、类型、要做的事、出口/下一步、购买/领取、NPC/来源、花费/条件、技能或装备调整、完成、重要提醒、核验来源。

**Step 3: 应用视觉规则**

冻结标题行、开启筛选、设置合理列宽与自动换行。路线/传送点用蓝色，购买/奖励用绿色，首领用红色，技能调整用紫色，装备检查用黄色。

**Step 4: 写入辅助工作表**

技能阶段显示连接、光环、工具技能、孔色与切换条件；采购清单按城镇批量购买；装备升级按剧情、白图、黄图、红图和终局给出低成本优先级；来源页记录版本、推导规则和核验链接。

### Task 4: 验证工作簿

**Files:**
- Inspect: `C:\Users\ares\Documents\流放之路\outputs\019f8f0e-9837-7441-be00-398949eecd4b\念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`

**Step 1: 重新加载并检查范围**

确认五张表存在、主表行数合理、关键列非空，且没有 `#REF!`、`#DIV/0!`、`#VALUE!`、`#NAME?` 或 `#N/A`。

**Step 2: 渲染视觉预览**

渲染“逐图路线”顶部、剧情中段和“技能阶段”区域，检查截断、重叠、颜色和可读性。

**Step 3: 修正并再次验证**

根据预览调整列宽、行高、冻结窗格和文本，重新导出最终文件。
