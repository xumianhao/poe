import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "C:/Users/ares/Documents/流放之路";
const tempDir = `${root}/.tmp-kinetic-workbook`;
const outputDir = `${root}/outputs/019f8f0e-9837-7441-be00-398949eecd4b`;
const outputPath = `${outputDir}/念动齐射弩炮圣宗-3.29-逐图开荒.xlsx`;
const previewDir = `${tempDir}/previews`;
const data = JSON.parse(await fs.readFile(`${tempDir}/source-data.json`, "utf8"));

const palette = {
  navy: "#1F4E78",
  header: "#5B9BD5",
  lightBlue: "#D9EAF7",
  red: "#F4CCCC",
  green: "#D9EAD3",
  purple: "#EADCF8",
  yellow: "#FFF2CC",
  gray: "#E7E6E6",
  white: "#FFFFFF",
  border: "#B7C9D6",
  dark: "#203040",
};
const titleStyle = {
  fill: palette.navy,
  font: { bold: true, color: palette.white, size: 16 },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
const headerStyle = {
  fill: palette.header,
  font: { bold: true, color: palette.white },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: palette.border },
};
const bodyStyle = {
  verticalAlignment: "top",
  wrapText: true,
  borders: {
    insideHorizontal: { style: "thin", color: "#D8E2E8" },
    bottom: { style: "thin", color: "#D8E2E8" },
  },
};
const sectionStyle = {
  fill: palette.lightBlue,
  font: { bold: true, color: palette.dark },
  verticalAlignment: "center",
};
const join = (items) => (items?.length ? items.join("；") : "—");
const skillGroups = (groups, label) =>
  groups?.length
    ? groups
        .map(
          (group) =>
            `${label}｜${group.displayName}｜${join(group.skills)}｜${group.reason}`,
        )
        .join("\n")
    : "—";
const qname = (gem) => `${gem.cn}（${gem.en}）`;
const byGemId = new Map(data.gems.map((gem) => [gem.id, gem]));
const stageById = new Map(data.stages.map((stage) => [stage.stageId, stage]));
const colLetter = (n) => {
  let s = "";
  for (let v = n; v > 0; v = Math.floor((v - 1) / 26)) {
    s = String.fromCharCode(65 + ((v - 1) % 26)) + s;
  }
  return s;
};

const wb = Workbook.create();
const sheetNames = [
  "阶段总览",
  "逐图路线",
  "技能阶段",
  "天赋路线",
  "装备升级",
  "做装路线",
  "切换检查",
  "采购清单",
  "来源与说明",
];
const sheets = Object.fromEntries(
  sheetNames.map((name) => [name, wb.worksheets.add(name)]),
);

function title(sheet, text, cols, subtitle = "") {
  const end = colLetter(cols);
  sheet.getRange(`A1:${end}1`).merge();
  sheet.getRange("A1").values = [[text]];
  sheet.getRange(`A1:${end}1`).format = titleStyle;
  sheet.getRange(`A1:${end}1`).format.rowHeight = 30;
  if (subtitle) {
    sheet.getRange(`A2:${end}2`).merge();
    sheet.getRange("A2").values = [[subtitle]];
    sheet.getRange(`A2:${end}2`).format = {
      fill: "#DDEBF7",
      font: { color: palette.dark, italic: true },
      verticalAlignment: "center",
      wrapText: true,
    };
    sheet.getRange(`A2:${end}2`).format.rowHeight = 28;
  }
  sheet.showGridLines = false;
}

function writeTable(sheet, startRow, headers, rows, widths, tableName, fill) {
  const endCol = colLetter(headers.length);
  const endRow = startRow + rows.length;
  sheet.getRange(`A${startRow}:${endCol}${startRow}`).values = [headers];
  sheet.getRange(`A${startRow}:${endCol}${startRow}`).format = headerStyle;
  if (rows.length) {
    sheet.getRange(`A${startRow + 1}:${endCol}${endRow}`).values = rows;
    sheet.getRange(`A${startRow + 1}:${endCol}${endRow}`).format = bodyStyle;
    if (fill) {
      sheet.getRange(`A${startRow + 1}:${endCol}${endRow}`).format.fill = fill;
    }
    sheet.tables.add(`A${startRow}:${endCol}${endRow}`, true, tableName);
  }
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, Math.max(endRow, 1), 1).format.columnWidth =
      width;
  });
  sheet.getRange(`A${startRow}:${endCol}${Math.max(endRow, startRow)}`).format.autofitRows();
  return endRow;
}

const overview = sheets["阶段总览"];
title(
  overview,
  `${data.version} ${data.build.name}：阶段总览`,
  7,
  "每阶段的进入与退出条件来自统一 source-data；具体技能、装备、做装与切换门槛见对应工作表。",
);
writeTable(
  overview,
  4,
  ["顺序", "阶段", "等级", "PoB阶段", "进入条件", "退出条件", "阶段ID"],
  data.stages.map((s) => [
    s.order,
    s.name,
    s.level,
    s.pobStage,
    s.entry,
    s.exit,
    s.stageId,
  ]),
  [8, 26, 12, 24, 48, 48, 22],
  "StageOverviewTable",
  "#F4F8FB",
);
overview.freezePanes.freezeRows(4);
overview.freezePanes.freezeColumns(2);

const route = sheets["逐图路线"];
title(
  route,
  `${data.version} ${data.build.name}：逐图路线`,
  13,
  "颜色：蓝=路线／传送点　红=首领　绿=采购／奖励　紫=技能切换　黄=装备检查；第18行严格限制为第一章可取得宝石。",
);
const routeRows = data.routeRows.map((row) => [
  row.index,
  row.act,
  row.area,
  row.type,
  row.action,
  row.next,
  row.buy,
  row.npc,
  row.cost,
  row.adjust,
  row.status,
  row.note,
  row.source,
]);
const routeEnd = writeTable(
  route,
  4,
  ["序号", "章节", "地图／城镇", "类型", "要做的事", "下一步／出口", "购买／领取", "NPC／来源", "花费／条件", "技能或装备调整", "完成", "重要提醒", "核验来源"],
  routeRows,
  [7, 9, 20, 12, 32, 20, 42, 22, 22, 48, 10, 52, 34],
  "VerifiedRouteTable",
);
route.freezePanes.freezeRows(4);
route.freezePanes.freezeColumns(3);
route.getRange(`A5:D${routeEnd}`).format.horizontalAlignment = "center";
route.getRange(`K5:K${routeEnd}`).format.horizontalAlignment = "center";
route.getRange(`K5:K${routeEnd}`).dataValidation = {
  rule: { type: "list", values: ["未做", "完成", "跳过"] },
};
const typeFill = {
  路线: palette.lightBlue,
  传送点: palette.lightBlue,
  首领: palette.red,
  "采购/奖励": palette.green,
  "试炼/升华": palette.purple,
  "支线/任务": "#E2F0D9",
  城镇整理: palette.gray,
  装备检查: palette.yellow,
};
data.routeRows.forEach((row, index) => {
  const excelRow = index + 5;
  route.getRange(`A${excelRow}:M${excelRow}`).format.fill =
    typeFill[row.type] ?? palette.white;
  if (row.adjust) route.getRange(`J${excelRow}`).format.fill = palette.purple;
  if (row.buy) route.getRange(`G${excelRow}:I${excelRow}`).format.fill = palette.green;
});

const skills = sheets["技能阶段"];
title(
  skills,
  `${data.version} ${data.build.name}：技能阶段`,
  13,
  "禁用或条件技能单独显示；“—”表示该阶段不启用，不能按PoB插槽存在就视为常驻。",
);
const skillRows = data.skillStages.map((s) => {
  const stage = stageById.get(s.stageId);
  return [
    stage?.order ?? "",
    stage?.name ?? s.stageId,
    stage?.level ?? "",
    s.pobStage,
    join(s.mainLinks),
    join(s.bossTools),
    join(s.auras),
    join(s.defence),
    join(s.movement),
    join(s.activeDebuffs),
    skillGroups(s.disabledSkillGroups, "禁用"),
    skillGroups(s.conditionalSkills, "条件触发"),
    `${join(s.conflicts)}${s.noneReasons ? `；未启用说明：${Object.values(s.noneReasons).join("；")}` : ""}`,
  ];
});
writeTable(
  skills,
  4,
  ["顺序", "阶段", "等级", "PoB阶段", "主技能连接", "首领／工具", "光环", "防卫", "位移", "减益", "禁用技能", "条件技能", "冲突与说明"],
  skillRows,
  [8, 24, 11, 22, 56, 48, 40, 34, 38, 38, 34, 38, 56],
  "SkillStagesTable",
  "#F8F5FC",
);
skills.freezePanes.freezeRows(4);
skills.freezePanes.freezeColumns(2);

const passive = sheets["天赋路线"];
title(
  passive,
  `${data.version} ${data.build.name}：天赋路线`,
  13,
  data.passiveTree.methodology,
);
let passiveRow = 4;
const passiveHeaders = ["点数", "建议等级", "章节／阶段", "天赋", "节点ID", "类型", "集群", "前置", "目的", "分类", "PoB阶段", "临时点", "顺序依据"];
passiveRow = writeTable(
  passive,
  passiveRow,
  passiveHeaders,
  data.passiveOrder.map((p) => [
    p.point,
    p.suggestedLevel,
    p.act,
    p.displayName,
    p.nodeId,
    p.type,
    p.cluster,
    p.prerequisite,
    p.purpose,
    p.category,
    p.pobStage,
    p.temporary ? "是" : "否",
    p.orderBasis,
  ]),
  [8, 10, 18, 34, 13, 12, 20, 32, 44, 18, 24, 10, 42],
  "Passive111Table",
  "#F4F8FB",
);
passiveRow += 2;
passive.getRange(`A${passiveRow}:M${passiveRow}`).merge();
passive.getRange(`A${passiveRow}`).values = [["112–118 PoB追加点（不是可选点）"]];
passive.getRange(`A${passiveRow}:M${passiveRow}`).format = sectionStyle;
passiveRow = writeTable(
  passive,
  passiveRow + 1,
  passiveHeaders,
  data.pobAdditionalPoints.map((p) => [
    p.point,
    p.suggestedLevel,
    p.act,
    p.displayName,
    p.nodeId,
    p.type,
    p.cluster,
    p.prerequisite,
    p.purpose,
    p.category,
    p.pobStage,
    p.temporary ? "是" : "否",
    p.orderBasis,
  ]),
  Array(13).fill(18),
  "PassiveAdditionalTable",
  palette.yellow,
);
passiveRow += 2;
passive.getRange(`A${passiveRow}:M${passiveRow}`).merge();
passive.getRange(`A${passiveRow}`).values = [["最终118点快照核对"]];
passive.getRange(`A${passiveRow}:M${passiveRow}`).format = sectionStyle;
passive.getRange(`A${passiveRow + 1}:M${passiveRow + 1}`).merge();
passive.getRange(`A${passiveRow + 1}`).values = [[
  `最终快照节点数：${data.finalPassiveSnapshot.length}；PoB普通已分配：${data.passiveTree.xmlFinalOrdinaryAllocated}；PoB标签：${data.passiveTree.pobbinLabel}；树版本：${data.passiveTree.treeVersion}（PoB记录 ${data.passiveTree.pobTreeVersion}）。`,
]];
passive.getRange(`A${passiveRow + 1}:M${passiveRow + 1}`).format = bodyStyle;
passiveRow += 3;
passive.getRange(`A${passiveRow}:M${passiveRow}`).merge();
passive.getRange(`A${passiveRow}`).values = [["升华／血脉顺序"]];
passive.getRange(`A${passiveRow}:M${passiveRow}`).format = sectionStyle;
passiveRow = writeTable(
  passive,
  passiveRow + 1,
  ["顺序", "系统", "阶段", "天赋", "节点ID", "前置", "目的", "分类", "来源"],
  data.ascendancy.map((a) => [
    a.order,
    a.system,
    a.stage,
    a.displayName,
    a.nodeId,
    a.prerequisite,
    a.purpose,
    a.category,
    a.source,
  ]),
  [8, 18, 20, 38, 13, 38, 48, 20, 44],
  "AscendancyOrderTable",
  palette.purple,
);
passiveRow += 2;
passive.getRange(`A${passiveRow}:M${passiveRow}`).merge();
passive.getRange(`A${passiveRow}`).values = [["三次主洗点与阶段微调 operations"]];
passive.getRange(`A${passiveRow}:M${passiveRow}`).format = sectionStyle;
const respecRows = data.respecs.flatMap((r) =>
  r.operations.map((op) => [
    op.step,
    op.action === "remove" ? "移除" : "加入",
    r.name,
    op.displayName,
    op.nodeId,
    op.adjacentTo ?? "",
    op.category,
    op.purpose,
    r.previousStage,
    r.stage,
    r.refundPointsRequired,
    r.availablePointDelta,
    r.source ?? data.build.pob,
  ]),
);
writeTable(
  passive,
  passiveRow + 1,
  ["步骤", "操作", "洗点", "天赋", "节点ID", "相邻节点", "分类", "目的", "前阶段", "后阶段", "所需退还点", "可用点变化", "来源"],
  respecRows,
  [8, 10, 24, 36, 14, 16, 18, 36, 22, 22, 12, 12, 46],
  "RespecOperationsTable",
  "#FCE8E6",
);
[
  8, 10, 24, 36, 14, 16, 20, 36, 22, 22, 12, 12, 46,
].forEach((width, index) => {
  passive
    .getRangeByIndexes(0, index, passiveRow + respecRows.length + 2, 1)
    .format.columnWidth = width;
});
passive.freezePanes.freezeRows(4);
passive.freezePanes.freezeColumns(4);

const gear = sheets["装备升级"];
title(gear, `${data.version} ${data.build.name}：装备升级`, 11);
writeTable(
  gear,
  4,
  ["阶段", "部位", "当前装备", "下一目标", "必需词缀", "可选词缀", "避开词缀", "替换条件", "武器模式", "标签", "来源"],
  data.gearStages.map((g) => [
    stageById.get(g.stageId)?.name ?? g.stageId,
    g.slot,
    g.current,
    g.next,
    join(g.requiredMods),
    join(g.optionalMods),
    join(g.avoidMods),
    join(g.replacementRequirements),
    g.weaponMode ?? "—",
    join(g.modTags),
    g.source,
  ]),
  [24, 22, 42, 46, 58, 48, 48, 48, 18, 24, 46],
  "GearProgressionTable",
  palette.yellow,
);
gear.freezePanes.freezeRows(4);
gear.freezePanes.freezeColumns(2);

const craft = sheets["做装路线"];
title(craft, `${data.version} ${data.build.name}：最低成本做装路线`, 11);
writeTable(
  craft,
  4,
  ["部位", "阶段", "底材", "最低目标", "理想目标", "制作步骤", "止损线", "失败品用途", "直接购买替代", "避坑", "来源"],
  data.craftingRoutes.map((c) => [
    c.slot,
    stageById.get(c.stageId)?.name ?? c.stageId,
    c.base,
    join(c.minimum),
    join(c.ideal),
    c.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    c.stopLoss,
    c.failureUse,
    c.purchaseAlternative,
    join(c.avoid),
    c.source,
  ]),
  [22, 22, 52, 48, 52, 60, 48, 48, 52, 44, 46],
  "CraftingRoutesTable",
  "#FFF7E0",
);
craft.freezePanes.freezeRows(4);
craft.freezePanes.freezeColumns(2);

const checks = sheets["切换检查"];
title(
  checks,
  `${data.version} ${data.build.name}：切换检查`,
  12,
  "全部必需条件与结构化检查同时通过后再切换；数值门槛按 source-data 显示。",
);
const checkRows = data.switchChecks.flatMap((s) =>
  s.checks.map((c, index) => [
    stageById.get(s.stageId)?.name ?? s.stageId,
    s.name,
    index + 1,
    c.id,
    c.operator.startsWith("=") ? `'${c.operator}` : c.operator,
    c.target,
    c.unit,
    c.source,
    join(s.required),
    join(s.doNotSwitchIf),
    s.passAction,
    s.allRequired ? "全部通过" : "按说明",
  ]),
);
writeTable(
  checks,
  4,
  ["阶段", "切换", "检查序号", "检查ID", "运算符", "目标", "单位／口径", "检查来源", "全部必需条件", "禁止切换条件", "通过后动作", "判定"],
  checkRows,
  [22, 38, 10, 28, 10, 18, 42, 50, 60, 56, 52, 12],
  "SwitchChecksTable",
  "#F4F8FB",
);
checks.freezePanes.freezeRows(4);
checks.freezePanes.freezeColumns(2);

const purchases = sheets["采购清单"];
title(
  purchases,
  `${data.version} ${data.build.name}：采购清单`,
  10,
  "覆盖阶段技能表使用的全部技能石；按路线行、任务解锁与圣堂武僧可购性执行，终局特殊掉落单列。",
);
const purchaseRows = data.gemAcquisitions.map((g) => [
  g.routeIndex ?? "终局",
  g.actNumber <= 10 ? `第${g.actNumber}章` : "终局",
  g.quest,
  g.displayName,
  g.requiredLevel,
  g.npc,
  g.acquisitionType,
  g.purpose,
  g.priority,
  `${g.source}；${g.poewikiSource}`,
]);
writeTable(
  purchases,
  4,
  ["路线行", "章节", "时点", "购买／领取", "需求等级", "NPC／来源", "取得方式", "用途", "优先级", "核验来源"],
  purchaseRows,
  [9, 10, 24, 38, 12, 28, 30, 46, 12, 52],
  "PurchasesTable",
  palette.green,
);
purchases.freezePanes.freezeRows(4);
purchases.freezePanes.freezeColumns(3);

const sources = sheets["来源与说明"];
title(sources, `${data.version} ${data.build.name}：来源与说明`, 6);
const sourceEnd = writeTable(
  sources,
  4,
  ["来源", "链接", "用途／说明"],
  data.sources.map((s) => [s.name, s.url, s.note]),
  [26, 66, 72],
  "SourcesTable",
  "#F4F8FB",
);
sources.getRange("E4:F4").values = [["工作簿检查", "值"]];
sources.getRange("E4:F4").format = headerStyle;
sources.getRange("E5:E9").values = [
  ["阶段数"],
  ["路线核验行"],
  ["主时间线点数"],
  ["PoB追加点数"],
  ["最终快照点数"],
];
sources.getRange("F5:F9").formulas = [
  ["=COUNTA('阶段总览'!A5:A200)"],
  ["=COUNTA('逐图路线'!A5:A300)"],
  ["=COUNTA('天赋路线'!A5:A115)"],
  ["=COUNTA('天赋路线'!A119:A125)"],
  ["=F7+F8"],
];
sources.getRange("E5:F9").format = { ...bodyStyle, fill: palette.green };
sources.getRange("E11:F11").merge();
sources.getRange("E11").values = [["版本与方法"]];
sources.getRange("E11:F11").format = sectionStyle;
sources.getRange("E12:F16").values = [
  ["PoB", data.build.pob],
  ["当前天赋树版本", data.passiveTree.treeVersion],
  ["PoB记录树版本", data.passiveTree.pobTreeVersion],
  ["PoB标签", data.passiveTree.pobbinLabel],
  ["顺序方法", data.passiveTree.methodology],
];
sources.getRange("E12:F16").format = bodyStyle;
sources.getRange("E1:F16").format.wrapText = true;
[26, 66, 72, 4, 24, 58].forEach((width, i) => {
  sources.getRangeByIndexes(0, i, Math.max(sourceEnd, 16), 1).format.columnWidth =
    width;
});
sources.freezePanes.freezeRows(4);

for (const name of sheetNames) {
  sheets[name].getUsedRange()?.format.autofitRows();
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(outputPath);

const imported = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const sheetInspection = await imported.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 5000,
});
const route18Inspection = await imported.inspect({
  kind: "region",
  sheetId: "逐图路线",
  range: "A22:M22",
  maxChars: 5000,
  tableMaxRows: 2,
  tableMaxCols: 13,
  tableMaxCellChars: 260,
});
const passiveInspection = await imported.inspect({
  kind: "region",
  sheetId: "天赋路线",
  range: "A4:M115",
  maxChars: 8000,
  tableMaxRows: 6,
  tableMaxCols: 13,
  tableMaxCellChars: 180,
});
const switchInspection = await imported.inspect({
  kind: "match",
  searchTerm: "43000|2000|格挡回复",
  options: { useRegex: true, maxResults: 30 },
  maxChars: 7000,
});
const formulaErrors = await imported.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
  maxChars: 7000,
});

await fs.mkdir(previewDir, { recursive: true });
const previews = [
  ["阶段总览", "A1:G20", "01-stage-overview.png"],
  ["逐图路线", "A1:M26", "02-route-top.png"],
  ["逐图路线", "A58:M84", "02-route-middle.png"],
  ["逐图路线", "A118:M144", "02-route-bottom.png"],
  ["技能阶段", "A1:M20", "03-skills.png"],
  ["天赋路线", "A1:M26", "04-passive-top.png"],
  ["天赋路线", "A106:M151", "04-passive-middle.png"],
  ["天赋路线", "A254:M284", "04-passive-bottom.png"],
  ["装备升级", "A1:K20", "05-gear.png"],
  ["做装路线", "A1:K11", "06-crafting.png"],
  ["切换检查", "A1:L22", "07-switch-checks.png"],
  ["采购清单", "A1:J47", "08-purchases.png"],
  ["来源与说明", "A1:F18", "09-sources.png"],
];
for (const [sheetName, range, filename] of previews) {
  const image = await imported.render({
    sheetName,
    range,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${previewDir}/${filename}`,
    new Uint8Array(await image.arrayBuffer()),
  );
}

console.log(JSON.stringify({
  outputPath,
  sheets: sheetNames,
  passiveMainRows: data.passiveOrder.length,
  passiveAdditionalRows: data.pobAdditionalPoints.length,
  finalSnapshotRows: data.finalPassiveSnapshot.length,
  routeRows: data.routeRows.length,
  previews: previews.map(([, , filename]) => `${previewDir}/${filename}`),
}));
console.log("---SHEET_ORDER---");
console.log(sheetInspection.ndjson);
console.log("---ROUTE_INDEX_18---");
console.log(route18Inspection.ndjson);
console.log("---PASSIVE_111_SAMPLE---");
console.log(passiveInspection.ndjson);
console.log("---SWITCH_THRESHOLDS---");
console.log(switchInspection.ndjson);
console.log("---FORMULA_ERRORS---");
console.log(formulaErrors.ndjson);
