import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const unitsPath = new URL("content/graduate-units.json", root);
const sourcesPath = new URL("content/college-sources.json", root);

const noisePatterns = [
  /领导信箱/,
  /北大概况/,
  /招生公示/,
  /联系方式/,
  /联系信息/,
  /信息联系/,
  /招办联系/,
  /院系联系/,
  /联系院系/,
  /院系介绍/,
  /各研究生招生院系/,
  /研招办/,
  /师资队伍/,
  /科研成果/,
  /学术期刊/,
  /管理部/,
  /五四体育中心/,
  /王克桢楼/,
  /陈守仁国际研究中心/,
  /标识系/,
  /与院系$/,
  /共设\d+个/,
  /\d+个系/,
  /\d+个学院/,
  /\d+个书院/,
  /跨学科类/,
  /非实体学院/,
  /教学中心/,
  /训练中心/,
  /艺术教育中心/,
  /学系经济学研究所/,
  /学部\/学院/,
  /^学院/,
  /^学院法学院$/,
  /^（/,
];

const genericNames = new Set([
  "学部与院系",
  "院系设置",
  "学院设置",
  "学部设置",
  "院系",
  "学院",
  "研究生院",
  "领导信箱学部",
  "北大概况招生学部",
]);

function normalize(value) {
  return String(value || "")
    .replace(/中国人民大学/g, "")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/[（）()]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function hasUnbalancedParenthesis(value) {
  const text = String(value || "");
  return (text.includes("（") && !text.includes("）")) || (text.includes("(") && !text.includes(")"));
}

function isNoiseDepartment(value) {
  const normalized = normalize(value);
  if (!normalized || normalized.length < 2 || genericNames.has(normalized)) {
    return true;
  }

  if (hasUnbalancedParenthesis(value)) {
    return true;
  }

  if (noisePatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (/书院$/.test(normalized)) {
    return true;
  }

  if (!/(学院|学部|学系|系|研究院|书院|中心|部|所)$/.test(normalized)) {
    return true;
  }

  return false;
}

function dedupeUnits(units) {
  const byKey = new Map();

  for (const unit of units) {
    if (isNoiseDepartment(unit.department)) {
      continue;
    }

    const key = `${unit.school}::${normalize(unit.department)}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, unit);
      continue;
    }

    byKey.set(key, {
      ...unit,
      ...current,
      sourceUrl: current.sourceUrl || unit.sourceUrl,
      sourceName: current.sourceName || unit.sourceName,
      aliases: Array.from(new Set([...(unit.aliases || []), ...(current.aliases || []), unit.department, current.department].filter(Boolean))),
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if ((a.schoolPriority || 999) !== (b.schoolPriority || 999)) {
      return (a.schoolPriority || 999) - (b.schoolPriority || 999);
    }

    if (a.school !== b.school) {
      return a.school.localeCompare(b.school, "zh-CN");
    }

    return (a.priority || 9999) - (b.priority || 9999) || a.department.localeCompare(b.department, "zh-CN");
  });
}

function pruneSources(sources, unitKeys) {
  return sources
    .filter((source) => !isNoiseDepartment(source.department))
    .filter((source) => !/\.?bbs\./i.test(source.sourceHost || source.homepageUrl || source.baseUrl || ""))
    .filter((source) => unitKeys.has(`${source.school}::${normalize(source.department)}`))
    .sort((a, b) => {
      if (a.school !== b.school) {
        return a.school.localeCompare(b.school, "zh-CN");
      }

      return a.department.localeCompare(b.department, "zh-CN");
    });
}

async function main() {
  const [units, sources] = await Promise.all([
    fs.readFile(unitsPath, "utf8").then(JSON.parse),
    fs.readFile(sourcesPath, "utf8").then(JSON.parse).catch(() => []),
  ]);
  const nextUnits = dedupeUnits(units);
  const unitKeys = new Set(nextUnits.map((unit) => `${unit.school}::${normalize(unit.department)}`));
  const nextSources = pruneSources(sources, unitKeys);

  await Promise.all([
    fs.writeFile(unitsPath, `${JSON.stringify(nextUnits, null, 2)}\n`),
    fs.writeFile(sourcesPath, `${JSON.stringify(nextSources, null, 2)}\n`),
  ]);

  console.log(JSON.stringify({
    unitsBefore: units.length,
    unitsAfter: nextUnits.length,
    unitsRemoved: units.length - nextUnits.length,
    sourcesBefore: sources.length,
    sourcesAfter: nextSources.length,
    sourcesRemoved: sources.length - nextSources.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
