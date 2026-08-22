import fs from "node:fs/promises";

const sourcePath =
  "C:/Users/ares/Documents/流放之路/.tmp-kinetic-workbook/youtube-transcript-snapshot.txt";
const outputPath =
  "C:/Users/ares/Documents/流放之路/.tmp-kinetic-workbook/youtube-transcript.json";

const snapshot = await fs.readFile(sourcePath, "utf8");
const panelStart = snapshot.lastIndexOf('tab "转写文稿" [selected]');
const panel = panelStart >= 0 ? snapshot.slice(panelStart) : snapshot;
const lines = panel.split(/\r?\n/);
const segments = [];

for (let index = 0; index < lines.length; index += 1) {
  const timeMatch = lines[index].match(/^\s+- generic: (\d{1,2}:\d{2})$/);
  if (!timeMatch) continue;

  const nearby = lines.slice(index + 1, index + 5);
  const textLine = nearby.find((line) => /^\s+- text: /.test(line));
  if (!textLine) continue;

  const text = textLine.replace(/^\s+- text: /, "").trim();
  if (!text || segments.some((segment) => segment.time === timeMatch[1])) continue;
  segments.push({ time: timeMatch[1], text });
}

await fs.writeFile(outputPath, JSON.stringify(segments, null, 2), "utf8");
console.log(JSON.stringify({ outputPath, segmentCount: segments.length }));
