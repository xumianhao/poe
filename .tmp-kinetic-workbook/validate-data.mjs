import fs from "node:fs/promises";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export function validateExclusiveQuestRewards(data) {
  const errors = [];
  for (const row of data.routeRows) {
    if (row.rewardType === "exclusive" && (row.gemIds?.length ?? 0) !== 1) {
      errors.push(
        `route ${row.index}: ${row.event} is an exclusive reward; select exactly one gem`,
      );
    }
  }
  return errors;
}

const correctedRouteGems = new Map([
  [18, ["combustion-support", "clarity"]],
  [35, ["wave-of-conviction"]],
  [39, ["faster-casting-support"]],
  [48, ["herald-of-ash", "herald-of-thunder"]],
]);

const actTwoGemIds = new Set([
  "herald-of-ash",
  "herald-of-thunder",
  "faster-casting-support",
  "wave-of-conviction",
]);

export function validateRouteMigration(data) {
  const errors = [];
  if (data.routeRows.length !== 140) {
    errors.push("routeRows must contain exactly 140 rows");
  }
  const expectedIndexes = Array.from({ length: 140 }, (_, index) => index + 1);
  if (
    JSON.stringify(data.routeRows.map((row) => row.index)) !==
    JSON.stringify(expectedIndexes)
  ) {
    errors.push("routeRows indexes must be exactly 1..140");
  }
  for (const [index, expectedGemIds] of correctedRouteGems) {
    const row = data.routeRows.find((candidate) => candidate.index === index);
    if (!row) continue;
    if (
      JSON.stringify(row.gemIds ?? []) !== JSON.stringify(expectedGemIds)
    ) {
      errors.push(
        `route ${index}: corrected gemIds must be ${expectedGemIds.join(", ")}`,
      );
    }
  }
  const route18 = data.routeRows.find((row) => row.index === 18);
  if (route18) {
    const route18Text = JSON.stringify(route18);
    const forbiddenTerms = [
      "灰烬之捷",
      "Herald of Ash",
      "闪电之捷",
      "Herald of Thunder",
      "快速施法",
      "Faster Casting",
      "定罪波",
      "Wave of Conviction",
      "信念浪涌",
    ];
    if (
      (route18.gemIds ?? []).some((gemId) => actTwoGemIds.has(gemId)) ||
      forbiddenTerms.some((term) => route18Text.includes(term))
    ) {
      errors.push("route 18 must not contain any Act 2 gem");
    }
  }
  const blackInvaders = data.routeRows.find((row) => row.index === 35);
  if (
    blackInvaders &&
    (blackInvaders.event !== "黑色入侵者" ||
      blackInvaders.rewardType !== "exclusive" ||
      JSON.stringify(blackInvaders.gemIds ?? []) !==
        JSON.stringify(["wave-of-conviction"]))
  ) {
    errors.push(
      "route 35: 黑色入侵者 must be exclusive and select only wave-of-conviction",
    );
  }
  return errors;
}

export function validatePurchases(data) {
  const errors = [];
  const gems = new Map(data.gems.map((gem) => [gem.id, gem]));
  const referencedGemIds = [];
  for (const [index, purchase] of (data.purchases ?? []).entries()) {
    const label = `purchase ${index + 1}`;
    if (
      !Number.isInteger(purchase.routeIndex) ||
      !Number.isInteger(purchase.actNumber) ||
      !purchase.event ||
      !purchase.npc ||
      !purchase.method ||
      !purchase.priority ||
      !purchase.source ||
      !Array.isArray(purchase.gemIds) ||
      purchase.gemIds.length === 0
    ) {
      errors.push(`${label}: structured purchase fields are incomplete`);
      continue;
    }
    const route = data.routeRows.find(
      (candidate) => candidate.index === purchase.routeIndex,
    );
    if (!route || route.actNumber !== purchase.actNumber) {
      errors.push(`${label}: routeIndex/actNumber does not match routeRows`);
    }
    for (const gemId of purchase.gemIds) {
      referencedGemIds.push(gemId);
      const gem = gems.get(gemId);
      if (!gem) {
        errors.push(`${label}: unknown gem ${gemId}`);
        continue;
      }
      if (purchase.actNumber < gem.act) {
        errors.push(
          `${label}: ${gem.cn} requires Act ${gem.act}, not Act ${purchase.actNumber}`,
        );
      }
      if (
        !gem.classes.includes("全职业") &&
        !gem.classes.includes("圣堂武僧")
      ) {
        errors.push(`${label}: ${gem.cn} unavailable to Templar`);
      }
      if (purchase.actNumber === 1 && actTwoGemIds.has(gemId)) {
        errors.push(`${label}: Act 2 gem ${gemId} cannot be listed in Act 1`);
      }
    }
  }
  const expectedGemIds = [...correctedRouteGems.values()].flat();
  if (
    JSON.stringify(referencedGemIds) !== JSON.stringify(expectedGemIds)
  ) {
    errors.push(
      "purchases must cover the six verified gems in corrected route order",
    );
  }
  return errors;
}

const skillArrayFields = [
  "mainLinks",
  "auras",
  "bossTools",
  "defence",
  "movement",
  "activeDebuffs",
];

function extractEnglishGemName(displayName) {
  const matches = [...String(displayName).matchAll(/（([^（）]+)）/g)].map(
    (match) => match[1],
  );
  return matches.find((value) => /[A-Za-z]/.test(value)) ?? null;
}

function collectUsedGemNames(data) {
  const names = new Set();
  for (const stage of data.skillStages ?? []) {
    for (const field of skillArrayFields) {
      for (const displayName of stage[field] ?? []) {
        const englishName = extractEnglishGemName(displayName);
        if (englishName) names.add(englishName);
      }
    }
    for (const groupField of ["disabledSkillGroups", "conditionalSkills"]) {
      for (const group of stage[groupField] ?? []) {
        for (const displayName of group.skills ?? []) {
          const englishName = extractEnglishGemName(displayName);
          if (englishName) names.add(englishName);
        }
      }
    }
  }
  return names;
}

export function validateSkillGemAcquisitions(data) {
  const errors = [];
  const acquisitions = data.gemAcquisitions ?? [];
  const byEnglishName = new Map(
    acquisitions.map((record) => [record.en, record]),
  );
  const stageOrder = new Map(
    (data.stages ?? []).map((stage) => [stage.stageId, stage.order]),
  );
  for (const englishName of collectUsedGemNames(data)) {
    if (!byEnglishName.has(englishName)) {
      errors.push(`missing acquisition record: ${englishName}`);
    }
  }
  for (const stage of data.skillStages ?? []) {
    const stageGemNames = new Set();
    for (const field of skillArrayFields) {
      for (const displayName of stage[field] ?? []) {
        const englishName = extractEnglishGemName(displayName);
        if (englishName) stageGemNames.add(englishName);
      }
    }
    for (const groupField of ["disabledSkillGroups", "conditionalSkills"]) {
      for (const group of stage[groupField] ?? []) {
        for (const displayName of group.skills ?? []) {
          const englishName = extractEnglishGemName(displayName);
          if (englishName) stageGemNames.add(englishName);
        }
      }
    }
    for (const englishName of stageGemNames) {
      const acquisition = byEnglishName.get(englishName);
      if (
        acquisition &&
        stageOrder.get(stage.stageId) <
          stageOrder.get(acquisition.availableStageId)
      ) {
        errors.push(
          `${stage.stageId}: ${englishName} is used before ${acquisition.availableStageId} acquisition`,
        );
      }
    }
  }
  for (const record of acquisitions) {
    if (
      !record.cn ||
      !record.en ||
      !record.displayName ||
      !record.acquisitionType ||
      !record.availableStageId ||
      !record.source ||
      !record.poewikiSource
    ) {
      errors.push(`incomplete acquisition record: ${record.en ?? "unknown"}`);
    }
  }
  const elementalProliferation = byEnglishName.get(
    "Elemental Proliferation Support",
  );
  if (
    !elementalProliferation ||
    elementalProliferation.routeIndex !== 2 ||
    elementalProliferation.quest !== "大门口的敌人（Enemy at the Gate）" ||
    elementalProliferation.npc !== "奈莎（Nessa）"
  ) {
    errors.push(
      "Elemental Proliferation Support must unlock for Templar at route 2 after Enemy at the Gate",
    );
  }
  const arcaneSurge = byEnglishName.get("Arcane Surge Support");
  if (
    !arcaneSurge ||
    arcaneSurge.routeIndex !== 5 ||
    arcaneSurge.quest !== "医者之心（Mercy Mission）" ||
    arcaneSurge.npc !== "奈莎（Nessa）"
  ) {
    errors.push(
      "Arcane Surge Support must unlock for Templar at route 5 after Mercy Mission",
    );
  }
  return errors;
}

export function validateStageReferences(data) {
  const errors = [];
  const canonicalStageIds = [
    "a1-spell",
    "a2-spell",
    "a3-firestorm",
    "a3-ballista",
    "a4",
    "a5",
    "a6",
    "a7",
    "a8",
    "a9",
    "a10",
    "a10-crit-respec",
    "early-maps",
    "before-aegis",
    "aegis-respec",
    "aspirational",
  ];
  if (
    JSON.stringify(data.stages.map((stage) => stage.stageId)) !==
    JSON.stringify(canonicalStageIds)
  ) {
    errors.push("stages must exactly match the 16-stage canonical sequence");
  }
  const stageIds = new Set(data.stages.map((stage) => stage.stageId));
  if (stageIds.size !== data.stages.length) {
    errors.push("stages contain duplicate stageId values");
  }
  for (const collection of [
    data.skillStages,
    data.gearStages,
    data.craftingRoutes,
    data.switchChecks,
  ]) {
    for (const row of collection) {
      if (row.stageId && !stageIds.has(row.stageId)) {
        errors.push(`${row.stageId}: unknown stage reference`);
      }
    }
  }
  const skillStageIds = data.skillStages.map((row) => row.stageId);
  if (
    skillStageIds.length !== canonicalStageIds.length ||
    canonicalStageIds.some(
      (stageId) =>
        skillStageIds.filter((candidate) => candidate === stageId).length !== 1,
    )
  ) {
    errors.push("skillStages must contain exactly one row for every stage");
  }
  const requiredSkillFields = [
    "mainLinks",
    "auras",
    "bossTools",
    "defence",
    "movement",
    "activeDebuffs",
    "conflicts",
  ];
  for (const row of data.skillStages) {
    for (const field of requiredSkillFields) {
      if (!Array.isArray(row[field])) {
        errors.push(`${row.stageId}: skillStages.${field} must be an array`);
      }
    }
    if (!row.pobStage || !row.source) {
      errors.push(`${row.stageId}: skill stage requires PoB stage and source`);
    }
    for (const field of ["defence", "activeDebuffs"]) {
      if (
        Array.isArray(row[field]) &&
        row[field].length === 0 &&
        !row.noneReasons?.[field] &&
        !(row.disabledSkillGroups?.length > 0) &&
        !(row.conditionalSkills?.length > 0)
      ) {
        errors.push(
          `${row.stageId}: empty ${field} requires noneReason or disabled/conditional skill data`,
        );
      }
    }
    for (const group of [
      ...(row.disabledSkillGroups ?? []),
      ...(row.conditionalSkills ?? []),
    ]) {
      if (
        !group.displayName ||
        group.enabled !== false ||
        !group.reason ||
        !group.source ||
        !Array.isArray(group.skills) ||
        group.skills.length === 0
      ) {
        errors.push(
          `${row.stageId}: disabled/conditional skill group requires displayName, enabled:false, skills, reason and source`,
        );
      }
    }
  }
  const pinnedDisabledSkillGroups = {
    EarlyMaps: "钢铁之肤触发组（Steelskin Trigger Group）",
    BeforeAegis: "钢铁之肤触发组（Steelskin Trigger Group）",
    AegisRespec: "熔岩护盾触发组（Molten Shell Trigger Group）",
  };
  for (const row of data.skillStages) {
    const expectedGroup = pinnedDisabledSkillGroups[row.pobStage];
    if (!expectedGroup) continue;
    const recordedGroups = [
      ...(row.disabledSkillGroups ?? []),
      ...(row.conditionalSkills ?? []),
    ];
    if (
      row.defence.length !== 0 ||
      !recordedGroups.some(
        (group) =>
          group.displayName === expectedGroup && group.enabled === false,
      )
    ) {
      errors.push(
        `${row.stageId}: PoB-disabled guard group state does not match ${row.pobStage}`,
      );
    }
  }
  const requiredGearFields = [
    "current",
    "next",
    "requiredMods",
    "optionalMods",
    "avoidMods",
    "replacementRequirements",
    "source",
  ];
  for (const row of data.gearStages) {
    for (const field of requiredGearFields) {
      if (
        row[field] == null ||
        (Array.isArray(row[field]) && row[field].length === 0)
      ) {
        errors.push(`${row.stageId}: gear stage requires ${field}`);
      }
    }
  }
  const invertSkillStageIds = new Set(
    data.skillStages
      .filter((row) =>
        row.mainLinks?.some((name) => name.includes("逆转规则")),
      )
      .map((row) => row.stageId),
  );
  for (const row of data.gearStages) {
    if (
      invertSkillStageIds.has(row.stageId) &&
      (!Array.isArray(row.modTags) ||
        !Array.isArray(row.activeDebuffSources))
    ) {
      errors.push(
        `${row.stageId}: Invert gear stage requires modTags and activeDebuffSources arrays`,
      );
    }
  }
  const requiredSwitchKeys = new Set([
    "a3-ballista",
    "a10-crit",
    "wilmas",
    "invert-rules",
    "aegis-glancing-blows",
  ]);
  const switchKeys = new Set(data.switchChecks.map((row) => row.key));
  if (
    switchKeys.size < requiredSwitchKeys.size ||
    [...requiredSwitchKeys].some((key) => !switchKeys.has(key))
  ) {
    errors.push("switchChecks must cover the 5 required switch groups");
  }
  const requiredCheckIds = {
    "a3-ballista": [
      "a3-respec-complete",
      "a3-hit-chance",
      "a3-linked-sockets",
      "a3-full-release-test",
    ],
    "a10-crit": [
      "a10-hit-chance",
      "a10-effective-crit-chance",
      "a10-elemental-overload-removed",
      "a10-crit-support-active",
    ],
    wilmas: [
      "wilma-attack-time-vs-duration",
      "wilma-full-release-test",
      "wilma-elemental-resistances",
    ],
    "invert-rules": [
      "invert-support-equipped",
      "invert-resistance-reduction-count",
      "invert-mark-swap",
    ],
    "aegis-glancing-blows": [
      "aegis-armour",
      "aegis-energy-shield",
      "aegis-block-recovery-sources",
      "aegis-required-core-items",
    ],
  };
  for (const row of data.switchChecks) {
    if (
      row.allRequired !== true ||
      !Array.isArray(row.required) ||
      row.required.length === 0 ||
      !Array.isArray(row.doNotSwitchIf) ||
      row.doNotSwitchIf.length === 0
    ) {
      errors.push(
        `${row.key}: switch check requires allRequired:true plus non-empty required and doNotSwitchIf`,
      );
    }
    const checks = row.checks ?? [];
    const ids = new Set(checks.map((check) => check.id));
    if (
      !Array.isArray(row.checks) ||
      row.checks.length === 0 ||
      (requiredCheckIds[row.key] ?? []).some((id) => !ids.has(id))
    ) {
      errors.push(`${row.key}: switch check missing required structured checks`);
    }
    for (const check of checks) {
      if (
        !check.id ||
        !check.operator ||
        !Object.hasOwn(check, "target") ||
        !check.unit ||
        !check.source
      ) {
        errors.push(
          `${row.key}: each structured check requires id, operator, target, unit and source`,
        );
      }
    }
  }
  const requiredCraftSlots = new Set([
    "wand",
    "body-armour",
    "gloves",
    "boots",
    "rings",
    "belt",
    "jewels",
  ]);
  const craftSlots = new Set(data.craftingRoutes.map((row) => row.slotId));
  if (
    craftSlots.size < requiredCraftSlots.size ||
    [...requiredCraftSlots].some((slot) => !craftSlots.has(slot))
  ) {
    errors.push(
      "craftingRoutes must cover wand, body armour, gloves, boots, rings, belt and jewels",
    );
  }
  const requiredCraftFields = [
    "base",
    "minimum",
    "ideal",
    "steps",
    "stopLoss",
    "failureUse",
    "purchaseAlternative",
    "source",
  ];
  for (const row of data.craftingRoutes) {
    for (const field of requiredCraftFields) {
      if (
        row[field] == null ||
        (Array.isArray(row[field]) && row[field].length === 0)
      ) {
        errors.push(`${row.slotId}: crafting route requires ${field}`);
      }
    }
  }
  const pinnedItems = [
    "火焰法术法杖（Fire Spell Wand）",
    "元素攻击法杖（Elemental Attack Wand）",
    "德瑞的精神手套（Doedre's Tenure）",
    "幻彩菱织（Prismweave）",
    "威尔玛的报偿（Wilma's Requital）",
    "苦难羁绊（Yoke of Suffering）",
    "幻芒圣盾（Aegis Aurora）",
    "意义的光辉（The Light of Meaning）",
    "碎镞雨（Rain of Splinters）",
    "致命的骄傲（Lethal Pride）",
    "护甲／能量护盾稀有装（Armour / Energy Shield Rare Gear）",
  ];
  const gearText = JSON.stringify(data.gearStages);
  if (pinnedItems.some((item) => !gearText.includes(item))) {
    errors.push("gearStages must cover all pinned progression items");
  }
  return errors;
}

export function validatePassiveOrder(data, tree = { nodes: {} }) {
  const errors = [];
  const points = data.passiveOrder.map((row) => row.point);
  const expected = Array.from({ length: 111 }, (_, index) => index + 1);
  if (JSON.stringify(points) !== JSON.stringify(expected)) {
    errors.push("passive points must be exactly 1..111");
  }
  const stages = Object.keys(tree.specs ?? {});
  const stageIndex = new Map(stages.map((stage, index) => [stage, index]));
  let previous = -1;
  for (const row of data.passiveOrder) {
    const current = stageIndex.get(row.pobStage);
    if (current === undefined || current < previous) {
      errors.push(`point ${row.point}: PoB stages must be monotonic`);
    }
    previous = current ?? previous;
  }
  const first = data.passiveOrder[0];
  if (
    first &&
    !tree.nodes[first.nodeId]?.connections.includes("61525")
  ) {
    errors.push("point 1 must be adjacent to the Templar start node 61525");
  }
  return errors;
}

export function validateRespecs(data) {
  const errors = [];
  for (const respec of data.respecs) {
    if (respec.refundPointsRequired !== respec.remove.length) {
      errors.push(`${respec.name}: refund points do not match removed nodes`);
    }
  }
  return errors;
}

const ordinaryTypes = new Set([
  "small",
  "notable",
  "mastery",
  "jewelSocket",
  "keystone",
  "clusterSmall",
  "clusterNotable",
]);

function ordinarySpec(tree, stage) {
  return new Set(
    tree.specs[stage].filter((id) => ordinaryTypes.has(tree.nodes[id].type)),
  );
}

export function validatePassiveCoverage(data, tree) {
  const errors = [];
  const additional = data.pobAdditionalPoints ?? [];
  const expectedAdditional = Array.from({ length: 7 }, (_, index) => index + 112);
  if (
    JSON.stringify(additional.map((row) => row.point)) !==
    JSON.stringify(expectedAdditional)
  ) {
    errors.push("additional passive points must be exactly 112..118");
  }
  const combined = [...data.passiveOrder, ...additional];
  if (combined.length !== 118) errors.push("earned passive points must total 118");
  return errors;
}

export function validateFinalPassiveSnapshot(data, tree) {
  const errors = [];
  const snapshot = data.finalPassiveSnapshot ?? [];
  const expectedPoints = Array.from({ length: 118 }, (_, index) => index + 1);
  if (
    JSON.stringify(snapshot.map((row) => row.point)) !==
    JSON.stringify(expectedPoints)
  ) {
    errors.push("final passive snapshot points must be exactly 1..118");
  }
  const ids = snapshot.map((row) => row.nodeId);
  if (new Set(ids).size !== ids.length) {
    errors.push("final passive snapshot must not contain duplicate nodes");
  }
  const expected = ordinarySpec(tree, "AegisRespec");
  if (
    ids.length !== expected.size ||
    ids.some((id) => !expected.has(id))
  ) {
    errors.push(
      "final passive snapshot must exactly cover the AegisRespec ordinary nodes",
    );
  }
  for (const row of snapshot) {
    const node = tree.nodes[row.nodeId];
    if (!node) {
      errors.push(`final snapshot point ${row.point}: unknown node ${row.nodeId}`);
      continue;
    }
    if (
      row.displayName !== node.displayName ||
      row.category !== node.category ||
      row.purpose !== node.purpose
    ) {
      errors.push(
        `final snapshot point ${row.point}: node metadata does not match source`,
      );
    }
  }
  return errors;
}

function isConnectedToStart(state, tree) {
  if (!state.size) return true;
  const seen = new Set(["61525"]);
  const queue = ["61525"];
  while (queue.length) {
    const id = queue.shift();
    for (const next of tree.nodes[id].connections) {
      if ((state.has(next) || next === "61525") && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...state].every((id) => seen.has(id));
}

export function validatePassiveTimeline(data, tree) {
  const errors = [];
  const rows = [...data.passiveOrder, ...(data.pobAdditionalPoints ?? [])];
  const rowsByPoint = new Map(rows.map((row) => [row.point, row]));
  const rowsByStage = new Map();
  for (const row of rows) {
    if (!rowsByStage.has(row.pobStage)) rowsByStage.set(row.pobStage, []);
    rowsByStage.get(row.pobStage).push(row);
  }
  const transitionRows = [
    ...(data.respecs ?? []),
    ...(data.passiveTree.stageAdjustments ?? []),
  ];
  const transitionByStage = new Map(
    transitionRows.map((row) => [row.stage, row]),
  );
  const state = new Set();
  for (const stage of Object.keys(tree.specs)) {
    const expected = ordinarySpec(tree, stage);
    const transition = transitionByStage.get(stage);
    const availablePointDelta = expected.size - state.size;
    if (
      transition &&
      transition.availablePointDelta !== availablePointDelta
    ) {
      errors.push(
        `${stage}: availablePointDelta must equal the PoB Spec point increase`,
      );
    }
    let earnedPointBudget = availablePointDelta;
    let refundBalance = 0;
    const operationPoints = new Set();
    const operations = transition?.operations ?? [];
    for (const [index, operation] of operations.entries()) {
      if (operation.step !== index + 1) {
        errors.push(`${stage}: operation steps must be exactly 1..N`);
      }
      if (operation.action === "remove") {
        if (!state.has(operation.nodeId)) {
          errors.push(`${stage} step ${operation.step}: remove unallocated node`);
        } else {
          state.delete(operation.nodeId);
          refundBalance += 1;
          if (!isConnectedToStart(state, tree)) {
            errors.push(
              `${stage} step ${operation.step}: operation disconnects tree`,
            );
          }
        }
      } else if (operation.action === "add") {
        if (state.has(operation.nodeId)) {
          errors.push(`${stage} step ${operation.step}: add allocated node`);
        }
        const node = tree.nodes[operation.nodeId];
        if (!node) {
          errors.push(
            `${stage} step ${operation.step}: add unknown node ${operation.nodeId}`,
          );
          continue;
        }
        if (operation.point != null) {
          const timelineRow = rowsByPoint.get(operation.point);
          if (
            !timelineRow ||
            timelineRow.nodeId !== operation.nodeId ||
            timelineRow.displayName !== operation.displayName ||
            timelineRow.cn !== operation.cn ||
            timelineRow.en !== operation.en
          ) {
            errors.push(
              `${stage} step ${operation.step}: operation point does not match timeline row`,
            );
          }
          if (timelineRow?.pobStage !== stage) {
            errors.push(
              `${stage} step ${operation.step}: operation point belongs to another stage`,
            );
          }
          if (operationPoints.has(operation.point)) {
            errors.push(
              `${stage} step ${operation.step}: operation point is duplicated`,
            );
          }
          operationPoints.add(operation.point);
          if (earnedPointBudget <= 0) {
            errors.push(
              `${stage} step ${operation.step}: add exceeds availablePointDelta budget`,
            );
          } else {
            earnedPointBudget -= 1;
          }
        } else if (refundBalance <= 0) {
          errors.push(
            `${stage} step ${operation.step}: add has no available refund point`,
          );
        } else {
          refundBalance -= 1;
        }
        if (
          !operation.adjacentTo ||
          !node.connections.includes(operation.adjacentTo) ||
          !(
            operation.adjacentTo === "61525" ||
            state.has(operation.adjacentTo)
          )
        ) {
          errors.push(
            `${stage} step ${operation.step}: adjacentTo is not a currently allocated neighbor`,
          );
        }
        state.add(operation.nodeId);
        if (!isConnectedToStart(state, tree)) {
          errors.push(`${stage} step ${operation.step}: operation disconnects tree`);
        }
      } else {
        errors.push(`${stage} step ${operation.step}: unknown operation action`);
      }
    }
    for (const row of rowsByStage.get(stage) ?? []) {
      if (operationPoints.has(row.point)) continue;
      if (state.has(row.nodeId)) {
        errors.push(`${stage} point ${row.point}: add allocated node`);
      }
      if (earnedPointBudget <= 0) {
        errors.push(
          `${stage} point ${row.point}: add exceeds availablePointDelta budget`,
        );
      } else {
        earnedPointBudget -= 1;
      }
      if (
        !tree.nodes[row.nodeId].connections.some(
          (id) => id === "61525" || state.has(id),
        )
      ) {
        errors.push(`${stage} point ${row.point}: add is not adjacent`);
      }
      state.add(row.nodeId);
      if (!isConnectedToStart(state, tree)) {
        errors.push(`${stage} point ${row.point}: operation disconnects tree`);
      }
    }
    if (earnedPointBudget !== 0) {
      errors.push(`${stage}: unused availablePointDelta budget`);
    }
    if (refundBalance !== 0) {
      errors.push(`${stage}: unused refund point balance`);
    }
    if (
      state.size !== expected.size ||
      [...state].some((id) => !expected.has(id))
    ) {
      errors.push(`${stage}: simulated state does not match PoB Spec`);
    }
  }
  return errors;
}

export function validatePassiveRespecs(data, tree) {
  const errors = [];
  if (data.respecs.length !== 3) errors.push("exactly three respecs required");
  for (const row of data.respecs) {
    const before = ordinarySpec(tree, row.previousStage);
    const after = ordinarySpec(tree, row.stage);
    const expectedRemove = [...before].filter((id) => !after.has(id));
    const expectedAdd = [...after].filter((id) => !before.has(id));
    if (
      row.remove.length !== expectedRemove.length ||
      row.remove.some((id) => !expectedRemove.includes(id))
    ) {
      errors.push(`${row.name}: remove nodes do not match PoB Spec difference`);
    }
    if (
      row.add.length !== expectedAdd.length ||
      row.add.some((id) => !expectedAdd.includes(id))
    ) {
      errors.push(`${row.name}: add nodes do not match PoB Spec difference`);
    }
    if (row.add.length - row.remove.length !== row.availablePointDelta) {
      errors.push(`${row.name}: respec creates unaccounted passive points`);
    }
  }
  return errors;
}

export function validateAscendancy(data, tree) {
  const errors = [];
  const final = new Set(
    tree.specs.AegisRespec.filter((id) =>
      ["ascendancy", "bloodline"].includes(tree.nodes[id].type),
    ),
  );
  const ids = data.ascendancy.map((row) => row.nodeId);
  if (
    ids.length !== final.size ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !final.has(id))
  ) {
    errors.push("ascendancy table must exactly cover final paid ascendancy nodes");
  }
  return errors;
}

export function validateChinesePrefixes(data, tree) {
  const errors = [];
  const values = [
    ...Object.entries(tree.nodes).map(([id, node]) => [
      `node ${id}`,
      node.cn,
      node.en,
      node.displayName,
    ]),
    ...data.passiveOrder.map((row) => [
      `point ${row.point}`,
      row.cn,
      row.en,
      row.displayName,
    ]),
    ...(data.pobAdditionalPoints ?? []).map((row) => [
      `point ${row.point}`,
      row.cn,
      row.en,
      row.displayName,
    ]),
    ...(data.finalPassiveSnapshot ?? []).map((row) => [
      `final snapshot point ${row.point}`,
      row.cn,
      row.en,
      row.displayName,
    ]),
    ...data.ascendancy.map((row) => [
      `ascendancy ${row.nodeId}`,
      row.cn,
      row.en,
      row.displayName,
    ]),
  ];
  for (const [label, cn, en, displayName] of values) {
    if (cn.includes("实际属性")) {
      errors.push(`${label}: placeholder Chinese name is forbidden`);
    }
    if (/[A-Za-z]/.test(cn)) {
      errors.push(`${label}: structured cn contains English text`);
    }
    if (displayName !== `${cn}（${en}）`) {
      errors.push(`${label}: displayName must exactly equal cn（en）`);
    }
  }
  const task3SkillFields = [
    "mainLinks",
    "auras",
    "bossTools",
    "defence",
    "movement",
    "activeDebuffs",
    "keystones",
  ];
  for (const stage of data.skillStages ?? []) {
    for (const field of task3SkillFields) {
      for (const term of stage[field] ?? []) {
        if (!/[\u3400-\u9fff].*（[^）]*[A-Za-z][^）]*）/.test(term)) {
          errors.push(
            `${stage.stageId} ${field}: special term must use Chinese（English）`,
          );
          continue;
        }
        const englishParentheses = [
          ...term.matchAll(/（([^）]*[A-Za-z][^）]*)）/g),
        ][0]?.[1];
        if (
          !englishParentheses ||
          /[\u3400-\u9fff，。；：]/.test(englishParentheses)
        ) {
          errors.push(
            `${stage.stageId} ${field}: English parentheses must contain only the English name`,
          );
        }
      }
    }
  }
  function validateArrayParentheses(value, pathLabel) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string") {
          for (const match of item.matchAll(/（([^）]*[A-Za-z][^）]*)）/g)) {
            if (/[\u3400-\u9fff，。；：]/.test(match[1])) {
              errors.push(
                `${pathLabel}[${index}]: English parentheses must not contain Chinese notes`,
              );
            }
          }
        } else {
          validateArrayParentheses(item, `${pathLabel}[${index}]`);
        }
      });
    } else if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        validateArrayParentheses(
          child,
          pathLabel ? `${pathLabel}.${key}` : key,
        );
      }
    }
  }
  validateArrayParentheses(data, "");
  return errors;
}

export function validatePassiveSemantics(data, tree) {
  const errors = [];
  const required = {
    "1105": {
      category: "图腾",
      purpose: "增加1个图腾上限，并提高图腾持续时间与放置速度",
    },
    "34434": {
      category: "图腾/资源",
      purpose: "每个已召唤图腾提供更多伤害，并回复生命与魔力",
    },
    "41970": {
      category: "图腾",
      purpose: "增加1个图腾上限，但角色无法亲自用技能造成伤害",
    },
    "44562": {
      category: "图腾/暴击",
      purpose: "提高图腾技能的暴击率与暴击伤害",
    },
    "25651": {
      category: "资源/机制",
      purpose: "提供最低耐力球与暴击球，并提高两者上限",
    },
    "41476": {
      category: "伤害",
      purpose: "每个暴击球提高法杖伤害，击杀时有几率获得暴击球",
    },
    "56029": {
      category: "属性",
      purpose: "提供30点敏捷",
    },
    "35958": {
      category: "防御",
      purpose: "提高护甲、最大能量护盾和全部元素抗性",
    },
    "36949": {
      category: "防御",
      purpose: "提高最大生命，并增强你创造的奉献地面效果",
    },
    "41472": {
      category: "防御",
      purpose: "提供固定生命并提高最大生命",
    },
    "58218": {
      category: "防御",
      purpose: "提高最大生命、最大能量护盾和混沌抗性",
    },
  };
  for (const [id, expected] of Object.entries(required)) {
    const node = tree.nodes[id];
    if (
      node?.category !== expected.category ||
      node?.purpose !== expected.purpose
    ) {
      errors.push(
        `node ${id}: category/purpose must match the pinned semantic assertion`,
      );
    }
  }
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (/^提升：/.test(node.purpose ?? "")) {
      errors.push(`node ${id}: generic purpose fallback is forbidden`);
    }
  }
  const displayRows = [
    ...data.passiveOrder,
    ...(data.pobAdditionalPoints ?? []),
    ...(data.finalPassiveSnapshot ?? []),
    ...data.ascendancy,
    ...(data.respecs ?? []).flatMap((row) => row.operations ?? []),
    ...(data.passiveTree.stageAdjustments ?? []).flatMap(
      (row) => row.operations ?? [],
    ),
  ];
  for (const row of displayRows) {
    const node = tree.nodes[row.nodeId];
    if (
      !node ||
      row.category !== node.category ||
      row.purpose !== node.purpose
    ) {
      errors.push(`${row.nodeId}: display object semantic metadata is out of sync`);
    }
  }
  return errors;
}

export function validatePinnedSources(data, tree) {
  const errors = [];
  const expectedHash =
    "709bb1bf9228d808bbcabf3e45582beb4c5db275c1663dcee9bcb88cd6803f0b";
  const actualHash = crypto
    .createHash("sha256")
    .update(tree.specs.AegisRespec.join(","))
    .digest("hex");
  if (actualHash !== expectedHash) {
    errors.push("pinned PoB final Spec hash mismatch");
  }
  if (
    tree.sourceMetadata?.pob?.finalSpecNodeCount !== 130 ||
    tree.sourceMetadata?.pob?.finalSpecNodeIdSha256 !== expectedHash
  ) {
    errors.push("pinned PoB final Spec metadata mismatch");
  }
  if (
    tree.sourceMetadata?.ggg?.tag !== "3.29.0" ||
    tree.sourceMetadata?.ggg?.status !== "Preview/Pre-release"
  ) {
    errors.push("GGG 3.29 source must be pinned and marked Preview/Pre-release");
  }
  for (const [id, node] of Object.entries(tree.nodes)) {
    if (node.type.startsWith("cluster") && node.source !== "PoB dynamic cluster patch") {
      errors.push(`node ${id}: dynamic cluster source is not explicit`);
    }
  }
  return errors;
}

export function validateConflicts(data) {
  const errors = [];
  const invertStageIds = new Set();
  for (const stage of data.skillStages ?? []) {
    const usesInvert = stage.mainLinks?.some((name) =>
      name.includes("逆转规则"),
    );
    if (usesInvert) invertStageIds.add(stage.stageId);
    if (
      usesInvert &&
      stage.activeDebuffs?.some((name) =>
        /元素要害|曝露|降低.*抗性|Elemental Weakness|Exposure|reduced.*Resistance/i.test(
          name,
        ),
      )
    ) {
      errors.push(
        `${stage.stageId}: Invert the Rules conflicts with resistance reduction`,
      );
    }
    if (
      stage.buildMode === "critical" &&
      stage.keystones?.some((name) => name.includes("元素超载"))
    ) {
      errors.push(
        `${stage.stageId}: Elemental Overload cannot remain in a critical stage`,
      );
    }
    const disabledGuard =
      stage.pobStage === "EarlyMaps"
        ? "钢铁之肤"
        : stage.pobStage === "BeforeAegis"
          ? "钢铁之肤"
          : stage.pobStage === "AegisRespec"
            ? "熔岩护盾"
            : null;
    if (
      disabledGuard &&
      stage.defence?.some((name) => name.includes(disabledGuard))
    ) {
      errors.push(
        `${stage.stageId}: disabled guard skill group cannot be listed as enabled defence`,
      );
    }
  }
  for (const check of data.switchChecks ?? []) {
    if (
      check.enables?.some((name) => name.includes("斗转星移")) &&
      (!(check.thresholds?.minArmour >= 43000) ||
        !(check.thresholds?.minEnergyShield >= 2000) ||
        !(check.blockRecoverySources?.length > 0))
    ) {
      errors.push(
        `${check.stageId}: Aegis thresholds require minArmour >= 43000, minEnergyShield >= 2000 and block recovery`,
      );
    }
  }
  for (const row of data.gearStages ?? []) {
    if (
      row.weaponMode === "attack-wand" &&
      row.modTags?.includes("spell-added")
    ) {
      errors.push(
        `${row.stageId}: attack wand cannot target spell-only added damage`,
      );
    }
    if (
      row.weaponMode === "story-spell" &&
      row.modTags?.includes("attack-added")
    ) {
      errors.push(
        `${row.stageId}: story spell weapon cannot target attack-only added damage`,
      );
    }
    if (invertStageIds.has(row.stageId)) {
      const badModTag = row.modTags?.some((tag) =>
        ["elemental-exposure", "curse-resistance-reduction"].includes(tag),
      );
      const badDebuffSource = row.activeDebuffSources?.some((source) =>
        /elemental-exposure|curse-resistance-reduction|元素曝露|元素要害|降低.*抗性/i.test(
          typeof source === "string"
            ? source
            : `${source?.type ?? ""} ${source?.displayName ?? ""}`,
        ),
      );
      if (badModTag || badDebuffSource) {
        errors.push(
          `${row.stageId}: Invert the Rules conflicts with gear resistance reduction`,
        );
      }
    }
  }
  return errors;
}

function runPassiveValidatorRegressionTests() {
  const connectedTree = {
    nodes: {
      start: { connections: ["next"] },
      next: { connections: ["start", "leaf"] },
      leaf: { connections: ["next"] },
      island: { connections: [] },
    },
  };
  const checks = [
    {
      name: "rejects fewer than 111 passive points",
      actual: validatePassiveOrder(
        {
          passiveOrder: [
            {
              point: 1,
              nodeId: "start",
              prerequisite: "起点",
            },
          ],
        },
        connectedTree,
      ),
      expected: "passive points must be exactly 1..111",
    },
    {
      name: "rejects unbalanced respecs",
      actual: validateRespecs({
        respecs: [
          {
            name: "broken respec",
            remove: ["a", "b"],
            add: ["c"],
            refundPointsRequired: 1,
          },
        ],
      }),
      expected: "broken respec: refund points do not match removed nodes",
    },
  ];
  const failures = checks.filter(
    ({ actual, expected }) => !actual.includes(expected),
  );
  assert.deepEqual(
    failures.map(({ name }) => name),
    [],
    `passive validator regression failures: ${failures
      .map(({ name }) => name)
      .join(", ")}`,
  );
}

runPassiveValidatorRegressionTests();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  await fs.readFile(path.join(__dirname, "source-data.json"), "utf8"),
);
const tree = JSON.parse(
  await fs.readFile(path.join(__dirname, "passive-tree-source.json"), "utf8"),
);

function runTask3RegressionTests(data) {
  const missingStagesMutation = structuredClone(data);
  missingStagesMutation.stages = [];
  assert(
    validateStageReferences(missingStagesMutation).includes(
      "stages must exactly match the 16-stage canonical sequence",
    ),
    "RED regression: missing canonical stages must fail",
  );
  const missingSwitchesMutation = structuredClone(data);
  missingSwitchesMutation.switchChecks = [];
  assert(
    validateStageReferences(missingSwitchesMutation).includes(
      "switchChecks must cover the 5 required switch groups",
    ),
    "RED regression: missing switch groups must fail",
  );
  const missingCraftsMutation = structuredClone(data);
  missingCraftsMutation.craftingRoutes = [];
  assert(
    validateStageReferences(missingCraftsMutation).includes(
      "craftingRoutes must cover wand, body armour, gloves, boots, rings, belt and jewels",
    ),
    "RED regression: missing crafting slots must fail",
  );
  const missingGearMutation = structuredClone(data);
  missingGearMutation.gearStages = [];
  assert(
    validateStageReferences(missingGearMutation).includes(
      "gearStages must cover all pinned progression items",
    ),
    "RED regression: missing progression items must fail",
  );

  const invertMutation = {
    skillStages: [
      {
        stageId: "aspirational",
        mainLinks: ["逆转规则（辅）（Invert the Rules Support）"],
        activeDebuffs: ["元素要害（Elemental Weakness）"],
      },
    ],
    gearStages: [],
    switchChecks: [],
  };
  assert(
    validateConflicts(invertMutation).includes(
      "aspirational: Invert the Rules conflicts with resistance reduction",
    ),
    "RED regression: Invert the Rules with resistance reduction must fail",
  );

  const criticalMutation = {
    skillStages: [
      {
        stageId: "early-maps",
        mainLinks: ["念动齐射（Kinetic Fusillade）"],
        keystones: [],
        buildMode: "critical",
      },
    ],
    gearStages: [],
    switchChecks: [],
  };
  criticalMutation.skillStages[0].keystones.push(
    "元素超载（Elemental Overload）",
  );
  assert(
    validateConflicts(criticalMutation).includes(
      "early-maps: Elemental Overload cannot remain in a critical stage",
    ),
    "RED regression: Elemental Overload in a critical stage must fail",
  );

  const glancingMutation = {
    skillStages: [],
    gearStages: [],
    switchChecks: [
      {
        stageId: "aegis-respec",
        key: "aegis-glancing-blows",
        enables: ["斗转星移（Glancing Blows）"],
        blockRecoverySources: [],
        thresholds: { minArmour: 0, minEnergyShield: 0 },
      },
    ],
  };
  assert(
    validateConflicts(glancingMutation).includes(
      "aegis-respec: Aegis thresholds require minArmour >= 43000, minEnergyShield >= 2000 and block recovery",
    ),
    "RED regression: Glancing Blows without its defensive thresholds must fail",
  );

  const weaponMutation = {
    skillStages: [],
    switchChecks: [],
    gearStages: [
      {
        stageId: "a3-ballista",
        slot: "法杖（Wand）",
        weaponMode: "attack-wand",
        modTags: ["spell-added"],
      },
    ],
  };
  assert(
    validateConflicts(weaponMutation).includes(
      "a3-ballista: attack wand cannot target spell-only added damage",
    ),
    "RED regression: an attack wand with spell-only added damage must fail",
  );

  const enabledDisabledGroupMutation = structuredClone(data);
  enabledDisabledGroupMutation.skillStages.find(
    (row) => row.stageId === "early-maps",
  ).defence = [
    "钢铁之肤（Steelskin）",
    "受伤时施放（辅）（Cast when Damage Taken Support）",
  ];
  assert(
    validateConflicts(enabledDisabledGroupMutation).includes(
      "early-maps: disabled guard skill group cannot be listed as enabled defence",
    ),
    "RED regression: a PoB-disabled guard group cannot be presented as enabled",
  );

  const gearExposureMutation = structuredClone(data);
  const aspirationalGear = gearExposureMutation.gearStages.find(
    (row) => row.stageId === "aspirational",
  );
  aspirationalGear.modTags = [
    ...(aspirationalGear.modTags ?? []),
    "elemental-exposure",
  ];
  assert(
    validateConflicts(gearExposureMutation).includes(
      "aspirational: Invert the Rules conflicts with gear resistance reduction",
    ),
    "RED regression: gear exposure must conflict with Invert the Rules",
  );
  const missingGearDebuffStructureMutation = structuredClone(data);
  delete missingGearDebuffStructureMutation.gearStages.find(
    (row) => row.stageId === "aegis-respec",
  ).activeDebuffSources;
  assert(
    validateStageReferences(missingGearDebuffStructureMutation).includes(
      "aegis-respec: Invert gear stage requires modTags and activeDebuffSources arrays",
    ),
    "RED regression: Invert gear stage requires explicit debuff-source structure",
  );

  const lowAegisThresholdMutation = structuredClone(data);
  const aegisCheck = lowAegisThresholdMutation.switchChecks.find(
    (row) => row.key === "aegis-glancing-blows",
  );
  aegisCheck.thresholds = { minArmour: 1, minEnergyShield: 1 };
  aegisCheck.blockRecoverySources = [];
  assert(
    validateConflicts(lowAegisThresholdMutation).includes(
      "aegis-respec: Aegis thresholds require minArmour >= 43000, minEnergyShield >= 2000 and block recovery",
    ),
    "RED regression: Aegis thresholds of 1/1 must fail",
  );

  const missingChecksMutation = structuredClone(data);
  missingChecksMutation.switchChecks.find(
    (row) => row.key === "a3-ballista",
  ).checks = [];
  assert(
    validateStageReferences(missingChecksMutation).includes(
      "a3-ballista: switch check missing required structured checks",
    ),
    "RED regression: A3 switch requires structured objective checks",
  );

  const silentEmptyMutation = structuredClone(data);
  const a1Stage = silentEmptyMutation.skillStages.find(
    (row) => row.stageId === "a1-spell",
  );
  a1Stage.defence = [];
  delete a1Stage.noneReasons;
  assert(
    validateStageReferences(silentEmptyMutation).includes(
      "a1-spell: empty defence requires noneReason or disabled/conditional skill data",
    ),
    "RED regression: an empty defence array must be explained",
  );
}

runTask3RegressionTests(data);

function runRouteMigrationRegressionTests(data) {
  const missingRowsMutation = structuredClone(data);
  missingRowsMutation.routeRows = missingRowsMutation.routeRows.slice(0, 139);
  assert(
    validateRouteMigration(missingRowsMutation).includes(
      "routeRows must contain exactly 140 rows",
    ),
    "RED regression: fewer than 140 route rows must fail",
  );

  const badIndexMutation = structuredClone(data);
  badIndexMutation.routeRows[1].index = 999;
  assert(
    validateRouteMigration(badIndexMutation).includes(
      "routeRows indexes must be exactly 1..140",
    ),
    "RED regression: non-contiguous route indexes must fail",
  );

  const actOneGemMutation = structuredClone(data);
  actOneGemMutation.routeRows.find((row) => row.index === 18).gemIds.push(
    "herald-of-ash",
  );
  assert(
    validateRouteMigration(actOneGemMutation).includes(
      "route 18 must not contain any Act 2 gem",
    ),
    "RED regression: an Act 2 gem on route 18 must fail",
  );

  const exclusiveMutation = structuredClone(data);
  exclusiveMutation.routeRows.find((row) => row.index === 35).gemIds.push(
    "herald-of-ash",
  );
  assert(
    validateRouteMigration(exclusiveMutation).includes(
      "route 35: 黑色入侵者 must be exclusive and select only wave-of-conviction",
    ),
    "RED regression: 黑色入侵者 selecting multiple gems must fail",
  );

  const badPurchaseMutation = structuredClone(data);
  badPurchaseMutation.purchases = [
    {
      routeIndex: 18,
      actNumber: 1,
      event: "冲出监牢后",
      npc: "奈莎（Nessa）",
      method: "商店购买",
      priority: "高",
      source: "https://poedb.tw/cn/Herald_of_Ash",
      gemIds: ["herald-of-ash"],
    },
  ];
  assert(
    validatePurchases(badPurchaseMutation).includes(
      "purchase 1: Act 2 gem herald-of-ash cannot be listed in Act 1",
    ),
    "RED regression: an Act 2 purchase in Act 1 must fail",
  );
}

runRouteMigrationRegressionTests(data);

function runSkillGemAcquisitionRegressionTests(data) {
  const lateElementalProliferation = structuredClone(data);
  lateElementalProliferation.gemAcquisitions.find(
    (record) => record.en === "Elemental Proliferation Support",
  ).routeIndex = 5;
  assert(
    validateSkillGemAcquisitions(lateElementalProliferation).includes(
      "Elemental Proliferation Support must unlock for Templar at route 2 after Enemy at the Gate",
    ),
    "regression: a late Elemental Proliferation acquisition must fail",
  );
  const earlyArcaneSurge = structuredClone(data);
  earlyArcaneSurge.gemAcquisitions.find(
    (record) => record.en === "Arcane Surge Support",
  ).routeIndex = 2;
  assert(
    validateSkillGemAcquisitions(earlyArcaneSurge).includes(
      "Arcane Surge Support must unlock for Templar at route 5 after Mercy Mission",
    ),
    "regression: Arcane Surge listed before Mercy Mission must fail",
  );
  const missingRecord = structuredClone(data);
  missingRecord.gemAcquisitions = missingRecord.gemAcquisitions.filter(
    (record) => record.en !== "Momentum Support",
  );
  assert(
    validateSkillGemAcquisitions(missingRecord).includes(
      "missing acquisition record: Momentum Support",
    ),
    "regression: every gem used by a skill stage needs an acquisition record",
  );
  const prematureStageUse = structuredClone(data);
  prematureStageUse.skillStages
    .find((stage) => stage.stageId === "a3-ballista")
    .bossTools.push("奥法烙印（Arcanist Brand）");
  assert(
    validateSkillGemAcquisitions(prematureStageUse).includes(
      "a3-ballista: Arcanist Brand is used before a4 acquisition",
    ),
    "RED regression: a gem cannot be presented as active before its acquisition stage",
  );
}

runSkillGemAcquisitionRegressionTests(data);

function runPassiveMutationRegressionTests(data, tree) {
  const contentNameMutation = structuredClone(data);
  contentNameMutation.skillStages[0].mainLinks[0] = "Rolling Magma";
  assert(
    validateChinesePrefixes(contentNameMutation, tree).includes(
      "a1-spell mainLinks: special term must use Chinese（English）",
    ),
    "RED regression: untranslated skill content must fail",
  );
  const mixedParenthesesMutation = structuredClone(data);
  mixedParenthesesMutation.skillStages[0].auras[0] =
    "清晰（Clarity，保持低等级）";
  assert(
    validateChinesePrefixes(mixedParenthesesMutation, tree).includes(
      "a1-spell auras: English parentheses must contain only the English name",
    ),
    "RED regression: Chinese notes inside English parentheses must fail",
  );

  const hashMutation = structuredClone(tree);
  hashMutation.specs.AegisRespec[0] = "999999";
  assert(
    validatePinnedSources(data, hashMutation).includes(
      "pinned PoB final Spec hash mismatch",
    ),
    "RED regression: a mutated final Spec must fail the pinned hash",
  );

  const stepMutation = structuredClone(data);
  stepMutation.respecs[0].operations[0].step = 999;
  assert(
    validatePassiveTimeline(stepMutation, tree).some((error) =>
      error.includes("operation steps must be exactly 1..N"),
    ),
    "RED regression: a mutated operation step must fail",
  );

  const adjacencyMutation = structuredClone(data);
  const adjacentAdd = adjacencyMutation.respecs
    .flatMap((row) => row.operations)
    .find((operation) => operation.action === "add");
  adjacentAdd.adjacentTo = "999999";
  assert(
    validatePassiveTimeline(adjacencyMutation, tree).some((error) =>
      error.includes("adjacentTo is not a currently allocated neighbor"),
    ),
    "RED regression: a mutated adjacentTo must fail",
  );

  const refundMutation = structuredClone(data);
  const refundTransition = refundMutation.respecs.find((row) =>
    row.operations.some(
      (operation) => operation.action === "add" && operation.point == null,
    ),
  );
  const refundAddIndex = refundTransition.operations.findIndex(
    (operation) => operation.action === "add" && operation.point == null,
  );
  const [refundAdd] = refundTransition.operations.splice(refundAddIndex, 1);
  refundTransition.operations.unshift(refundAdd);
  refundTransition.operations.forEach((operation, index) => {
    operation.step = index + 1;
  });
  assert(
    validatePassiveTimeline(refundMutation, tree).some((error) =>
      error.includes("add has no available refund point"),
    ),
    "RED regression: a refund-funded add before its refund must fail",
  );
}

runPassiveMutationRegressionTests(data, tree);

const errors = [
  ...validateGemAvailability(data),
  ...validateExclusiveQuestRewards(data),
  ...validateRouteMigration(data),
  ...validatePurchases(data),
  ...validateSkillGemAcquisitions(data),
  ...validateStageReferences(data),
  ...validatePassiveOrder(data, tree),
  ...validatePassiveCoverage(data, tree),
  ...validateFinalPassiveSnapshot(data, tree),
  ...validatePassiveTimeline(data, tree),
  ...validateRespecs(data),
  ...validatePassiveRespecs(data, tree),
  ...validateAscendancy(data, tree),
  ...validateChinesePrefixes(data, tree),
  ...validatePassiveSemantics(data, tree),
  ...validatePinnedSources(data, tree),
  ...validateConflicts(data),
];
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("PASSIVE_ORDER_111_OK");
  console.log("PASSIVE_ADDITIONAL_112_118_OK");
  console.log("RESPECS_BALANCED");
  console.log("STAGES_16_OK");
  console.log("SKILL_GEAR_CRAFT_SWITCH_OK");
  console.log("CONFLICT_RULES_OK");
  console.log("POB_DISABLED_SKILL_STATES_OK");
  console.log("STRUCTURED_SWITCH_CHECKS_OK");
  console.log("INVERT_CROSS_TABLE_OK");
  console.log("AEGIS_THRESHOLDS_OK");
  console.log("VALIDATION_OK");
}
