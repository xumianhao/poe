import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/ares/Desktop/poe2.xlsx";
const outputPath =
  "C:/Users/ares/Documents/流放之路/.tmp-kinetic-workbook/reference-route.json";

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const sheet = workbook.worksheets.getItemAt(0);
const values = sheet.getRange("B1:Z369").values;

const rows = values.map((row, index) => ({
  sourceRow: index + 1,
  area: row[0] ?? "",
  action: row[1] ?? "",
  details: row.slice(2).filter((value) => value !== null && value !== ""),
}));

const payload = {
  source: sourcePath,
  sheet: sheet.name,
  range: "B1:Z369",
  rows,
};

await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
console.log(
  JSON.stringify({
    outputPath,
    rows: rows.length,
    nonEmptyAreaRows: rows.filter((row) => row.area).length,
    nonEmptyActionRows: rows.filter((row) => row.action).length,
  }),
);
