import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const universitiesPath = new URL("content/universities-985.json", root);
const collegeSourcesPath = new URL("content/college-sources.json", root);
const reportPath = new URL("content/coverage-report.json", root);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
}

async function readJson(url, fallback) {
  try {
    return JSON.parse(await fs.readFile(url, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

function compactDepartment(value) {
  const text = Array.isArray(value) ? value.join("、") : String(value || "待确认");
  return text.replace(/^.*大学/, "").trim() || "待确认";
}

function latestDate(notices) {
  return notices
    .map((notice) => notice.publishedAt || notice.applicationEnd || notice.deadline || "")
    .filter(Boolean)
    .sort()
    .at(-1) || "";
}

function schoolCoverage(notices, universities, currentYear, recentYears) {
  return universities.map((university) => {
    const schoolNotices = notices.filter((notice) => notice.school === university.name);
    const currentYearNotices = schoolNotices.filter((notice) => notice.year === currentYear);
    const recentNotices = schoolNotices.filter((notice) => recentYears.includes(notice.year));
    const departments = new Set(schoolNotices.map((notice) => compactDepartment(notice.department)));

    return {
      school: university.name,
      region: university.region,
      total: schoolNotices.length,
      currentYear: currentYearNotices.length,
      recentFiveYears: recentNotices.length,
      departments: departments.size,
      llmStructured: schoolNotices.filter((notice) => notice.structuredStatus === "llm").length,
      latestDate: latestDate(schoolNotices),
      status: schoolNotices.length === 0 ? "missing" : currentYearNotices.length === 0 ? "stale" : "covered",
    };
  });
}

function collegeSourceCoverage(notices, collegeSources) {
  return collegeSources.map((source) => {
    const sourceNotices = notices.filter((notice) => {
      const sourceTagHit = notice.tags?.includes(source.id);
      const sameDepartment = notice.school === source.school && compactDepartment(notice.department).includes(source.department);
      const sourceUrlHit = source.baseUrl ? notice.sourceUrl?.startsWith(source.baseUrl) : false;
      return sourceTagHit || sameDepartment || sourceUrlHit;
    });

    return {
      id: source.id,
      school: source.school,
      department: source.department,
      total: sourceNotices.length,
      years: Array.from(new Set(sourceNotices.map((notice) => notice.year))).sort((a, b) => b - a),
      latestDate: latestDate(sourceNotices),
      status: sourceNotices.length === 0 ? "missing" : "covered",
    };
  });
}

async function main() {
  const options = parseArgs();
  const [notices, universities, collegeSources] = await Promise.all([
    readJson(noticesPath, []),
    readJson(universitiesPath, []),
    readJson(collegeSourcesPath, []),
  ]);
  const currentYear = Math.max(new Date().getFullYear(), ...notices.map((notice) => notice.year || 0));
  const recentYears = Array.from({ length: 5 }, (_, index) => currentYear - index);
  const schools = schoolCoverage(notices, universities, currentYear, recentYears);
  const collegeSourcesCoverage = collegeSourceCoverage(notices, collegeSources);
  const report = {
    generatedAt: new Date().toISOString(),
    currentYear,
    totals: {
      notices: notices.length,
      schools: universities.length,
      coveredSchools: schools.filter((item) => item.status === "covered").length,
      staleSchools: schools.filter((item) => item.status === "stale").length,
      missingSchools: schools.filter((item) => item.status === "missing").length,
      collegeSources: collegeSources.length,
      missingCollegeSources: collegeSourcesCoverage.filter((item) => item.status === "missing").length,
      llmStructured: notices.filter((notice) => notice.structuredStatus === "llm").length,
      unstructured: notices.filter((notice) => !notice.structuredStatus).length,
    },
    schools,
    collegeSources: collegeSourcesCoverage,
    actionItems: [
      ...schools.filter((item) => item.status !== "covered").map((item) => `${item.school} ${currentYear} 年暂无候选，需要补源或复查关键词。`),
      ...collegeSourcesCoverage.filter((item) => item.status === "missing").map((item) => `${item.school}${item.department} 已登记源但暂无候选，需要检查公告页。`),
    ],
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
