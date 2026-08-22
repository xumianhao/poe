import fs from "node:fs/promises";

const sourcePath = new URL("./source-data.json", import.meta.url);
const data = JSON.parse(await fs.readFile(sourcePath, "utf8"));

const skillFields = [
  "mainLinks",
  "auras",
  "bossTools",
  "defence",
  "movement",
  "activeDebuffs",
];

const records = new Map();
const addSkill = (displayName, stageId, field) => {
  const match = displayName.match(/（([A-Za-z][^（）]*)）(?:（.*）)?$/);
  if (!match) return;
  const english = match[1];
  if (!records.has(english)) {
    records.set(english, { displayName, english, uses: [] });
  }
  records.get(english).uses.push(`${stageId}:${field}`);
};

for (const stage of data.skillStages) {
  for (const field of skillFields) {
    for (const displayName of stage[field] ?? []) {
      addSkill(displayName, stage.stageId, field);
    }
  }
  for (const group of [
    ...(stage.disabledSkillGroups ?? []),
    ...(stage.conditionalSkills ?? []),
  ]) {
    for (const displayName of group.skills ?? []) {
      addSkill(displayName, stage.stageId, "conditional");
    }
  }
}

const slugOverrides = {
  "Sniper's Mark": "Snipers_Mark",
};

const slugFor = (english) =>
  slugOverrides[english] ??
  english
    .replace(/:/g, "")
    .replace(/[’']/g, "")
    .replace(/\s+/g, "_");

const cleanHtml = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const output = [];
for (const record of [...records.values()].sort((a, b) =>
  a.english.localeCompare(b.english),
)) {
  const slug = slugFor(record.english);
  const url = `https://poedb.tw/cn/${slug}`;
  const response = await fetch(url);
  const html = await response.text();
  const pageText = cleanHtml(html);
  const requiredLevel = Number(
    pageText.match(/需求\s*等级\s*\((\d+)/)?.[1] ?? 1,
  );
  const questIndex = html.indexOf("使命 /");
  const questEnd =
    questIndex >= 0
      ? Math.min(
          ...[
            html.indexOf("#####", questIndex + 10),
            html.indexOf("<h5", questIndex + 10),
            questIndex + 6000,
          ].filter((value) => value > questIndex),
        )
      : -1;
  const questText =
    questIndex >= 0
      ? cleanHtml(html.slice(questIndex, questEnd))
      : "NO_QUEST_SECTION";
  output.push({
    ...record,
    uses: [...new Set(record.uses)],
    slug,
    url,
    status: response.status,
    finalUrl: response.url,
    requiredLevel,
    questText,
  });
}

const outPath = new URL("./gem-acquisition-audit.json", import.meta.url);
await fs.writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify({
    count: output.length,
    missingQuestSection: output
      .filter((row) => row.questText === "NO_QUEST_SECTION")
      .map((row) => row.english),
    output: outPath.pathname,
  }),
);
