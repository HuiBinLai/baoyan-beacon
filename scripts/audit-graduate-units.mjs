import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const unitsPath = new URL("content/graduate-units.json", root);
const reportPath = new URL("content/graduate-unit-coverage.json", root);
const currentSeasonAdmissionYear = new Date().getFullYear() + 1;
const recentReferenceYears = Array.from({ length: 5 }, (_, index) => currentSeasonAdmissionYear - 1 - index);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    school: valueAfter(args, "--school"),
  };
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/中国人民大学/g, "")
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .trim();
}

function compactDepartment(value) {
  const raw = Array.isArray(value) ? value.join("、") : String(value || "");
  return normalizeText(raw) || "待确认";
}

function noticeHaystack(notice) {
  return normalizeText([
    notice.department,
    notice.title,
    notice.summary,
    notice.sourceName,
    notice.sourceUrl,
    notice.sourceExcerpt,
    ...(notice.majors || []),
    ...(notice.tags || []),
  ].filter(Boolean).join(" "));
}

function unitKeys(unit) {
  return [unit.department, ...(unit.aliases || [])]
    .map(normalizeText)
    .filter((item) => item.length >= 2);
}

function matchesUnit(notice, unit) {
  if (notice.school !== unit.school) {
    return false;
  }

  const department = compactDepartment(notice.department);
  const haystack = noticeHaystack(notice);
  return unitKeys(unit).some((key) => department === key || haystack.includes(key));
}

function latestDate(notices) {
  return notices
    .map((notice) => notice.publishedAt || notice.applicationEnd || notice.deadline || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function buildUnitReport(unit, notices) {
  const matched = notices.filter((notice) => matchesUnit(notice, unit));
  const years = Array.from(new Set(matched.map((notice) => notice.year).filter(Boolean))).sort((a, b) => b - a);
  const recent = matched.filter((notice) => recentReferenceYears.includes(notice.year));
  const currentSeason = matched.filter((notice) => notice.year === currentSeasonAdmissionYear);

  return {
    id: unit.id,
    school: unit.school,
    department: unit.department,
    sourceName: unit.sourceName,
    sourceUrl: unit.sourceUrl,
    total: matched.length,
    recentFiveYears: recent.length,
    currentSeason: currentSeason.length,
    years,
    latestDate: latestDate(matched),
    status: matched.length === 0 ? "missing" : recent.length === 0 ? "stale" : "covered",
  };
}

async function main() {
  const options = parseArgs();
  const [notices, units] = await Promise.all([
    fs.readFile(noticesPath, "utf8").then(JSON.parse),
    fs.readFile(unitsPath, "utf8").then(JSON.parse),
  ]);
  const selectedUnits = units.filter((unit) => !options.school || unit.school === options.school);
  const items = selectedUnits
    .map((unit) => buildUnitReport(unit, notices))
    .sort((a, b) => {
      if (a.school !== b.school) {
        return a.school.localeCompare(b.school, "zh-CN");
      }

      return (units.find((unit) => unit.id === a.id)?.priority || 999) - (units.find((unit) => unit.id === b.id)?.priority || 999);
    });
  const report = {
    generatedAt: new Date().toISOString(),
    currentSeasonAdmissionYear,
    recentReferenceYears,
    totals: {
      units: items.length,
      covered: items.filter((item) => item.status === "covered").length,
      stale: items.filter((item) => item.status === "stale").length,
      missing: items.filter((item) => item.status === "missing").length,
      currentSeasonCovered: items.filter((item) => item.currentSeason > 0).length,
    },
    units: items,
    actionItems: items
      .filter((item) => item.status !== "covered")
      .map((item) => `${item.school}${item.department} 最近五年暂无招生项目候选，需要补官网/公众号来源。`),
  };

  console.log(JSON.stringify(report.totals, null, 2));
  console.log(`action items: ${report.actionItems.length}`);

  if (!options.dryRun) {
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
