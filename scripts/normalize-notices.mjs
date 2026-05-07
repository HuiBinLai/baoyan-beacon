import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const graduateUnitsPath = new URL("content/graduate-units.json", root);
let graduateUnits = [];

function toText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean).join("、") || fallback;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value).trim() || fallback;
}

function toOptionalText(value) {
  const text = toText(value);
  return /^(未知|不详|待定|无|没有|N\/A|null|undefined)$/i.test(text) ? "" : text;
}

function toTextArray(value, fallback = ["待确认"]) {
  const raw = Array.isArray(value) ? value : [value];
  const clean = raw
    .flatMap((item) => {
      if (Array.isArray(item)) {
        return item;
      }

      if (typeof item === "string" && /[、,，;；]/.test(item) && item.length < 120) {
        return item.split(/[、,，;；]/);
      }

      return [item];
    })
    .map((item) => toText(item))
    .filter((item) => !/^(未知|不详|待定|无|没有|N\/A|null|undefined)$/i.test(item))
    .filter(Boolean);

  return Array.from(new Set(clean)).slice(0, 30).length > 0 ? Array.from(new Set(clean)).slice(0, 30) : fallback;
}

function normalizeDepartmentText(value) {
  return toText(value)
    .replace(/中国人民大学/g, "")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .trim();
}

function normalizeDepartment(value, school) {
  const cleaned = normalizeDepartmentText(value);
  if (!cleaned) {
    return "待确认";
  }

  const matched = graduateUnits.find((unit) => {
    if (unit.school !== school) {
      return false;
    }

    return [unit.department, ...(unit.aliases || [])]
      .map(normalizeDepartmentText)
      .some((alias) => alias && (cleaned === alias || cleaned.includes(alias)));
  });

  return matched?.department || cleaned;
}

function normalizeNotice(notice) {
  return {
    ...notice,
    id: toText(notice.id),
    title: toText(notice.title, "未命名通知"),
    school: toText(notice.school, "待确认"),
    department: normalizeDepartment(notice.department, toText(notice.school, "待确认")),
    majors: toTextArray(notice.majors),
    type: toText(notice.type, "推免"),
    year: Number(notice.year) || new Date().getFullYear(),
    region: toText(notice.region, "待确认"),
    deadline: toOptionalText(notice.deadline),
    publishedAt: toOptionalText(notice.publishedAt),
    sourceName: toText(notice.sourceName),
    sourceUrl: toText(notice.sourceUrl),
    summary: toText(notice.summary),
    tags: toTextArray(notice.tags, []),
    confidence: notice.confidence === "verified" ? "verified" : "auto",
    requirements: toTextArray(notice.requirements, []),
    materials: toTextArray(notice.materials, []),
    degreeTypes: toTextArray(notice.degreeTypes, ["待确认"]),
    applicationStart: toOptionalText(notice.applicationStart),
    applicationEnd: toOptionalText(notice.applicationEnd),
    registrationTime: toOptionalText(notice.registrationTime),
    applicationMethod: toOptionalText(notice.applicationMethod),
    targetStudents: toOptionalText(notice.targetStudents),
    structuredStatus: toText(notice.structuredStatus),
    noticeStage: toText(notice.noticeStage),
  };
}

async function main() {
  graduateUnits = await fs.readFile(graduateUnitsPath, "utf8").then(JSON.parse).catch(() => []);
  const notices = JSON.parse(await fs.readFile(noticesPath, "utf8"));
  const next = notices.map(normalizeNotice);
  await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`normalized ${next.length} notices`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
