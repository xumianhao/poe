import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath =
  "C:/Users/ares/Documents/流放之路/outputs/019f8f0e-9837-7441-be00-398949eecd4b/念动齐射弩炮圣宗-3.29-逐图开荒.xlsx";
const sourcePath =
  "C:/Users/ares/Documents/流放之路/.tmp-kinetic-workbook/source-data.json";
const expectedSheets = [
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

const assert = (condition, message) => {
  if (!condition) throw new Error(`VERIFY FAILED: ${message}`);
};

const parseNdjson = (ndjson) =>
  ndjson
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const findValues = (value) => {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value.values)) return value.values;
  if (Array.isArray(value.preview)) return value.preview;
  for (const child of Object.values(value)) {
    const result = findValues(child);
    if (result) return result;
  }
  return undefined;
};

const flattenObjects = (value, result = []) => {
  if (!value || typeof value !== "object") return result;
  result.push(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) flattenObjects(item, result);
    } else {
      flattenObjects(child, result);
    }
  }
  return result;
};

const inspectValues = async (sheetId, range, maxChars = 50000) => {
  const inspection = await workbook.inspect({
    kind: "region",
    sheetId,
    range,
    maxChars,
    tableMaxRows: 500,
    tableMaxCols: 20,
    tableMaxCellChars: 500,
  });
  const records = parseNdjson(inspection.ndjson);
  for (const record of records) {
    const values = findValues(record);
    if (values) return values;
  }
  throw new Error(
    `VERIFY FAILED: ${sheetId}!${range} inspection returned no values: ${inspection.ndjson.slice(0, 1200)}`,
  );
};

const inspectMatchText = async (searchTerm, maxResults = 100) => {
  const inspection = await workbook.inspect({
    kind: "match",
    searchTerm,
    options: { useRegex: false, maxResults },
    maxChars: 30000,
  });
  return inspection.ndjson;
};

const firstColumn = (matrix) => matrix.map((row) => Number(row[0]));
const textOf = (matrix) => matrix.flat(Infinity).join("\n");
const assertSequence = (actual, start, end, label) => {
  const expected = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} expected ${start}..${end}, got ${JSON.stringify(actual)}`,
  );
};

const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));

const sheetInspection = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 8000,
});
const sheetObjects = parseNdjson(sheetInspection.ndjson).flatMap((record) =>
  flattenObjects(record),
);
const sheetNames = sheetObjects
  .map((object) => object.name)
  .filter((name) => typeof name === "string" && expectedSheets.includes(name));
const orderedUniqueSheetNames = [...new Set(sheetNames)];
assert(
  JSON.stringify(orderedUniqueSheetNames) === JSON.stringify(expectedSheets),
  `sheet order mismatch: ${JSON.stringify(orderedUniqueSheetNames)}`,
);

const routeNumbers = firstColumn(await inspectValues("逐图路线", "A5:A144", 30000));
assertSequence(routeNumbers, 1, 140, "逐图路线");

const row18Text = textOf(await inspectValues("逐图路线", "A22:M22", 10000));
assert(row18Text.includes("几率点燃（辅）（Combustion Support）"), "row 18 missing Combustion");
assert(row18Text.includes("清晰（Clarity）"), "row 18 missing Clarity");
for (const forbidden of [
  "灰烬之捷（Herald of Ash）",
  "闪电之捷（Herald of Thunder）",
  "快速施法（辅）（Faster Casting Support）",
  "定罪波（Wave of Conviction）",
]) {
  assert(!row18Text.includes(forbidden), `row 18 incorrectly contains ${forbidden}`);
}

const mainPassive = firstColumn(await inspectValues("天赋路线", "A5:A115", 30000));
const extraPassive = firstColumn(await inspectValues("天赋路线", "A119:A125", 10000));
assertSequence(mainPassive, 1, 111, "天赋主表");
assertSequence(extraPassive, 112, 118, "PoB追加点");

const finalSnapshotText = `${await inspectMatchText(
  "最终118点快照核对",
)}\n${await inspectMatchText("最终快照节点数：118")}`;
assert(
  finalSnapshotText.includes("最终118点快照核对"),
  `missing final snapshot section; inspected=${finalSnapshotText.slice(0, 1200)}`,
);
assert(finalSnapshotText.includes("最终快照节点数：118"), "final snapshot count is not 118");

const ascendancyText = textOf(
  await inspectValues("天赋路线", "A132:I142", 30000),
);
for (const entry of source.ascendancy) {
  assert(
    ascendancyText.includes(entry.displayName),
    `ascendancy table missing ${entry.displayName}`,
  );
}

const respecText = textOf(await inspectValues("天赋路线", "A143:M400", 100000));
for (const respec of source.respecs) {
  assert(respecText.includes(respec.name), `respec table missing ${respec.name}`);
  for (const operation of respec.operations) {
    assert(
      respecText.includes(String(operation.nodeId)),
      `${respec.name} missing operation node ${operation.nodeId}`,
    );
  }
}

const skillText = textOf(await inspectValues("技能阶段", "A4:M20", 80000));
assert(skillText.includes("禁用技能"), "skill table missing disabled-skills column");
for (const stage of source.skillStages) {
  for (const group of stage.disabledSkillGroups ?? []) {
    assert(
      skillText.includes(group.displayName),
      `disabled skill group missing from workbook: ${group.displayName}`,
    );
  }
}

const switchText = textOf(await inspectValues("切换检查", "A4:L80", 100000));
for (const check of source.switchChecks) {
  assert(switchText.includes(check.name), `switch table missing ${check.name}`);
  for (const item of check.checks) {
    assert(switchText.includes(item.id), `${check.name} missing check ${item.id}`);
  }
}
for (const requiredText of ["43000", "2000", "格挡回复"]) {
  assert(switchText.includes(requiredText), `switch table missing ${requiredText}`);
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  maxChars: 20000,
});
const formulaErrorObjects = parseNdjson(formulaErrors.ndjson).flatMap((record) =>
  flattenObjects(record),
);
const formulaErrorCount = formulaErrorObjects.filter(
  (object) =>
    typeof object.text === "string" &&
    /#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/.test(object.text),
).length;
assert(formulaErrorCount === 0, `formula error scan found ${formulaErrorCount} matches`);

const previewDir =
  "C:/Users/ares/Documents/流放之路/.tmp-kinetic-workbook/previews";
const previewSpecs = [
  ["阶段总览", "A1:G20", "final-01-stage-overview.png"],
  ["逐图路线", "A1:M30", "final-02-route-top.png"],
  ["逐图路线", "A55:M85", "final-02-route-middle.png"],
  ["逐图路线", "A115:M144", "final-02-route-bottom.png"],
  ["技能阶段", "A1:M20", "final-03-skills.png"],
  ["天赋路线", "A1:M26", "final-04-passive-top.png"],
  ["天赋路线", "A106:M151", "final-04-passive-middle.png"],
  ["天赋路线", "A254:M284", "final-04-passive-bottom.png"],
  ["装备升级", "A1:K20", "final-05-gear.png"],
  ["做装路线", "A1:K11", "final-06-crafting.png"],
  ["切换检查", "A1:L22", "final-07-switch-checks.png"],
  ["采购清单", "A1:J47", "final-08-purchases.png"],
  ["来源与说明", "A1:F17", "final-09-sources.png"],
];
await fs.mkdir(previewDir, { recursive: true });
const previewPaths = [];
for (const [sheetName, range, filename] of previewSpecs) {
  const image = await workbook.render({
    sheetName,
    range,
    scale: 1.2,
    format: "png",
  });
  const previewPath = `${previewDir}/${filename}`;
  await fs.writeFile(previewPath, new Uint8Array(await image.arrayBuffer()));
  previewPaths.push(previewPath);
}

console.log(
  JSON.stringify(
    {
      workbookPath,
      sheetOrder: orderedUniqueSheetNames,
      routeRows: routeNumbers.length,
      row18: "correct",
      passiveMain: `${mainPassive[0]}..${mainPassive.at(-1)} (${mainPassive.length})`,
      passiveAdditional: `${extraPassive[0]}..${extraPassive.at(-1)} (${extraPassive.length})`,
      finalSnapshot: 118,
      ascendancyRows: source.ascendancy.length,
      respecs: source.respecs.length,
      disabledSkills: "checked",
      switchChecks: source.switchChecks.length,
      formulaErrors: formulaErrorCount,
      previews: previewPaths,
    },
    null,
    2,
  ),
);
