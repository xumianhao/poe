import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/ares/Desktop/poe2.xlsx";
const outputDir = "C:/Users/ares/Documents/流放之路/.tmp-poe2-analysis";

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetSummary = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 4000,
});
console.log("---SHEETS---");
console.log(sheetSummary.ndjson);

const firstSheet = workbook.worksheets.getItemAt(0);
const used = firstSheet.getUsedRange();
console.log("---FIRST_SHEET---");
console.log(JSON.stringify({
  name: firstSheet.name,
  usedAddress: used?.address ?? null,
  rowCount: used?.rowCount ?? null,
  columnCount: used?.columnCount ?? null,
}, null, 2));

const overview = await workbook.inspect({
  kind: "region,formula,drawing",
  sheetId: firstSheet.name,
  range: used?.address ?? "A1:Z100",
  maxChars: 18000,
  tableMaxRows: 80,
  tableMaxCols: 30,
  tableMaxCellChars: 160,
  options: { maxResults: 200 },
});
console.log("---OVERVIEW---");
console.log(overview.ndjson);

const styles = await workbook.inspect({
  kind: "computedStyle",
  sheetId: firstSheet.name,
  range: used?.address ?? "A1:Z100",
  maxChars: 10000,
});
console.log("---STYLES---");
console.log(styles.ndjson);

const preview = await workbook.render({
  sheetName: firstSheet.name,
  autoCrop: "all",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(
  `${outputDir}/first-sheet.png`,
  new Uint8Array(await preview.arrayBuffer()),
);
console.log(`---PREVIEW---\n${outputDir}/first-sheet.png`);
