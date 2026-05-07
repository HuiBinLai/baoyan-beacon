import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const today = new Date().toISOString().slice(0, 10);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
  };
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function noticeText(notice) {
  return [
    notice.title,
    notice.department,
    notice.summary,
    notice.applicationMethod,
    notice.targetStudents,
    notice.sourceExcerpt,
    ...(notice.majors || []),
    ...(notice.requirements || []),
    ...(notice.materials || []),
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/博士后/g, "")
    .replace(/\s+/g, " ");
}

function inferDegreeTypes(notice) {
  const text = noticeText(notice);
  const compact = text.replace(/\s+/g, "");
  const degreeTypes = [];

  if (/直接攻读博士|直博|本科直博|本博贯通|硕博连读/.test(compact) || notice.type === "直博") {
    degreeTypes.push("直博");
  }

  if (/学术型硕士|学术硕士|学硕|学术学位硕士|学术学位研究生|学术型研究生/.test(compact)) {
    degreeTypes.push("学术型硕士");
  }

  if (
    /专业学位硕士|专业硕士|专硕|专业学位研究生|专业型硕士|工程硕博士/.test(compact) ||
    /电子信息（[^）]*(人工智能|计算机|软件|网络空间安全)[^）]*）专业硕士/.test(compact)
  ) {
    degreeTypes.push("专业型硕士");
  }

  if (/博士研究生|博士学位研究生|攻读博士学位/.test(compact) && !degreeTypes.includes("直博")) {
    degreeTypes.push("博士");
  }

  if (/硕士研究生|硕士学位研究生|攻读硕士学位/.test(compact) && !degreeTypes.some((item) => item.includes("硕士"))) {
    degreeTypes.push("硕士");
  }

  return unique(degreeTypes).slice(0, 5);
}

function inferNoticeStage(notice) {
  const title = notice.title || "";
  const text = `${title} ${notice.summary || ""}`;

  if (/补充通知/.test(text)) {
    return "补充通知";
  }

  if (/招生简章/.test(title)) {
    return "招生简章";
  }

  if (/夏令营|研学营/.test(title)) {
    return "夏令营/研学营";
  }

  if (/预推免|预报名/.test(title)) {
    return "预推免";
  }

  if (/推免|推荐免试|免试攻读|接收优秀应届本科毕业生/.test(title)) {
    return "推免报名";
  }

  if (/复试|面试|考核/.test(title)) {
    return "复试/考核";
  }

  if (/公示|名单|结果/.test(title)) {
    return "结果公示";
  }

  if (/推免|推荐免试|免试攻读/.test(text)) {
    return "推免报名";
  }

  return notice.type || "待确认";
}

async function main() {
  const options = parseArgs();
  const notices = JSON.parse(await fs.readFile(noticesPath, "utf8"));
  let changed = 0;

  const next = notices.map((notice) => {
    const degreeTypes = inferDegreeTypes(notice);
    const noticeStage = inferNoticeStage(notice);
    const normalizedDegreeTypes = degreeTypes.length > 0 ? degreeTypes : ["待确认"];

    if (
      JSON.stringify(notice.degreeTypes || []) === JSON.stringify(normalizedDegreeTypes) &&
      notice.noticeStage === noticeStage
    ) {
      return notice;
    }

    changed += 1;
    return {
      ...notice,
      degreeTypes: normalizedDegreeTypes,
      noticeStage,
      classifiedAt: today,
    };
  });

  const counts = next.reduce((acc, notice) => {
    for (const item of notice.degreeTypes || ["待确认"]) {
      acc[item] = (acc[item] || 0) + 1;
    }
    return acc;
  }, {});

  console.log(JSON.stringify({ total: next.length, changed, degreeTypes: counts }, null, 2));

  if (!options.dryRun) {
    await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
