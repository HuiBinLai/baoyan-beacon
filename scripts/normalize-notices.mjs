import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);

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
    .filter(Boolean);

  return Array.from(new Set(clean)).slice(0, 30).length > 0 ? Array.from(new Set(clean)).slice(0, 30) : fallback;
}

function normalizeNotice(notice) {
  return {
    ...notice,
    id: toText(notice.id),
    title: toText(notice.title, "未命名通知"),
    school: toText(notice.school, "待确认"),
    department: toText(notice.department, "待确认"),
    majors: toTextArray(notice.majors),
    type: toText(notice.type, "推免"),
    year: Number(notice.year) || new Date().getFullYear(),
    region: toText(notice.region, "待确认"),
    deadline: toText(notice.deadline),
    publishedAt: toText(notice.publishedAt),
    sourceName: toText(notice.sourceName),
    sourceUrl: toText(notice.sourceUrl),
    summary: toText(notice.summary),
    tags: toTextArray(notice.tags, []),
    confidence: notice.confidence === "verified" ? "verified" : "auto",
    requirements: toTextArray(notice.requirements, []),
    materials: toTextArray(notice.materials, []),
    degreeTypes: toTextArray(notice.degreeTypes, ["待确认"]),
    applicationStart: toText(notice.applicationStart),
    applicationEnd: toText(notice.applicationEnd),
    registrationTime: toText(notice.registrationTime),
    applicationMethod: toText(notice.applicationMethod),
    targetStudents: toText(notice.targetStudents),
    structuredStatus: toText(notice.structuredStatus),
    noticeStage: toText(notice.noticeStage),
  };
}

async function main() {
  const notices = JSON.parse(await fs.readFile(noticesPath, "utf8"));
  const next = notices.map(normalizeNotice);
  await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`normalized ${next.length} notices`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
