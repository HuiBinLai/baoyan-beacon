import crypto from "node:crypto";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const unitsPath = new URL("content/graduate-units.json", root);
const universitiesPath = new URL("content/universities-985.json", root);

const uncertainDepartments = new Set(["待确认", "待结构化", "校级/待分院"]);

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function normalizeDepartment(value) {
  return String(value || "")
    .replace(/中国人民大学/g, "")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/^.*大学/, "")
    .trim();
}

function shouldKeepDepartment(department) {
  if (!department || uncertainDepartments.has(department)) {
    return false;
  }

  return /(学院|学部|系|研究院|书院|中心|部|所)$/.test(department);
}

function mergeUnits(existing, seeded, schoolPriority) {
  const byKey = new Map();

  for (const unit of existing) {
    byKey.set(`${unit.school}::${normalizeDepartment(unit.department)}`, unit);
  }

  for (const unit of seeded) {
    const key = `${unit.school}::${normalizeDepartment(unit.department)}`;
    if (byKey.has(key)) {
      continue;
    }

    byKey.set(key, unit);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const priorityA = a.schoolPriority || schoolPriority.get(a.school) || 999;
    const priorityB = b.schoolPriority || schoolPriority.get(b.school) || 999;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return (a.priority || 9999) - (b.priority || 9999) || a.department.localeCompare(b.department, "zh-CN");
  });
}

async function main() {
  const [notices, existing, universities] = await Promise.all([
    fs.readFile(noticesPath, "utf8").then(JSON.parse),
    fs.readFile(unitsPath, "utf8").then(JSON.parse).catch(() => []),
    fs.readFile(universitiesPath, "utf8").then(JSON.parse),
  ]);
  const schoolPriority = new Map(universities.map((university) => [university.name, university.priority]));
  const seededByKey = new Map();

  for (const notice of notices) {
    const department = normalizeDepartment(notice.department);
    if (!schoolPriority.has(notice.school) || !shouldKeepDepartment(department)) {
      continue;
    }

    const key = `${notice.school}::${department}`;
    if (seededByKey.has(key)) {
      continue;
    }

    seededByKey.set(key, {
      id: hash(key),
      school: notice.school,
      department,
      aliases: [department],
      sourceName: "当前通知库自动归并",
      sourceUrl: notice.sourceUrl,
      sourceStatus: "from_notices",
      schoolPriority: schoolPriority.get(notice.school),
      priority: 9000 + seededByKey.size,
    });
  }

  const next = mergeUnits(existing, Array.from(seededByKey.values()), schoolPriority);
  console.log(JSON.stringify({ before: existing.length, seeded: seededByKey.size, after: next.length }, null, 2));
  await fs.writeFile(unitsPath, `${JSON.stringify(next, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
