import crypto from "node:crypto";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const projectsPath = new URL("content/projects.json", root);
const currentSeasonAdmissionYear = new Date().getFullYear() + 1;

const trackDefinitions = [
  {
    name: "计算机/AI",
    keywords: ["人工智能", "计算机", "软件", "电子信息", "智能科学", "数据", "大数据", "网络空间安全", "信息安全", "自动化", "控制", "机器人", "通信", "信息与通信", "电子科学"],
  },
  {
    name: "经管金融",
    keywords: ["经济", "金融", "会计", "工商管理", "管理科学", "公共管理", "财政", "保险", "统计", "商学院"],
  },
  {
    name: "法学",
    keywords: ["法学", "法律", "知识产权", "社会法", "国际法", "刑法", "民商法"],
  },
  {
    name: "医学药学",
    keywords: ["医学", "临床", "口腔", "公共卫生", "药学", "护理", "基础医学", "生物医学"],
  },
  {
    name: "理工基础",
    keywords: ["数学", "物理", "化学", "生物", "力学", "天文", "地理", "海洋", "大气", "地球"],
  },
  {
    name: "材料能源化工",
    keywords: ["材料", "能源", "动力", "化工", "电气", "环境", "资源", "新能源"],
  },
  {
    name: "建筑土木交通",
    keywords: ["建筑", "土木", "交通", "城乡规划", "风景园林", "水利"],
  },
  {
    name: "人文社科",
    keywords: ["哲学", "文学", "历史", "社会学", "政治", "马克思", "民族", "公共政策"],
  },
  {
    name: "教育心理",
    keywords: ["教育", "心理", "体育"],
  },
  {
    name: "新闻传播外语",
    keywords: ["新闻", "传播", "外语", "英语", "翻译", "出版", "国际中文"],
  },
  {
    name: "农林环境",
    keywords: ["农业", "农学", "林", "食品", "动物", "植物", "生态", "水土保持"],
  },
  {
    name: "艺术设计",
    keywords: ["艺术", "设计", "美术", "音乐", "戏剧", "电影"],
  },
];

function textOf(notice) {
  return [
    notice.title,
    notice.school,
    notice.department,
    notice.summary,
    notice.noticeStage,
    notice.type,
    ...(notice.majors || []),
    ...(notice.degreeTypes || []),
    ...(notice.tags || []),
  ]
    .filter(Boolean)
    .join(" ");
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function cleanDepartment(value, school) {
  const raw = Array.isArray(value) ? value.join("、") : String(value || "");
  const cleaned = raw.replace(/^.*大学/, "").trim();

  if (!cleaned || cleaned === "待结构化" || cleaned === "待确认") {
    return `${school}校级/待分院`;
  }

  return cleaned;
}

function projectId(school, department) {
  return `project-${hash(`${school}::${department}`)}`;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function inferTracks(items) {
  const text = items.map(textOf).join(" ");
  const tracks = trackDefinitions
    .filter((track) => track.keywords.some((keyword) => text.includes(keyword)))
    .map((track) => track.name);

  return tracks.length > 0 ? unique(tracks) : ["综合/待确认"];
}

function dateRange(values) {
  const clean = unique(values.filter(Boolean)).sort();
  return {
    first: clean[0] || "",
    last: clean.at(-1) || "",
  };
}

function yearTimeline(items) {
  const years = unique(items.map((item) => String(item.year))).sort((a, b) => Number(b) - Number(a));

  return years.map((year) => {
    const yearItems = items.filter((item) => String(item.year) === year);
    const published = dateRange(yearItems.map((item) => item.publishedAt));
    const starts = dateRange(yearItems.map((item) => item.applicationStart));
    const ends = dateRange(yearItems.map((item) => item.applicationEnd || item.deadline));

    return {
      year: Number(year),
      count: yearItems.length,
      stages: unique(yearItems.map((item) => item.noticeStage || item.type)),
      degreeTypes: unique(yearItems.flatMap((item) => item.degreeTypes || [])),
      firstPublishedAt: published.first,
      lastPublishedAt: published.last,
      firstApplicationStart: starts.first,
      lastApplicationEnd: ends.last,
      notices: yearItems
        .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
        .map((item) => ({
          id: item.id,
          title: item.title,
          stage: item.noticeStage || item.type,
          year: item.year,
          publishedAt: item.publishedAt,
          applicationStart: item.applicationStart || "",
          applicationEnd: item.applicationEnd || item.deadline || "",
          degreeTypes: item.degreeTypes || ["待确认"],
          sourceUrl: item.sourceUrl,
        })),
    };
  });
}

function projectSummary(items) {
  const timeline = yearTimeline(items);
  const latest = timeline[0];
  const currentSeasonItems = items.filter((item) => item.year === currentSeasonAdmissionYear);
  const latestPast = timeline.find((entry) => entry.year < currentSeasonAdmissionYear);

  return {
    timeline,
    currentSeasonStatus: currentSeasonItems.length > 0 ? "已发现" : "监控中，暂未发现官方通知",
    currentSeasonCount: currentSeasonItems.length,
    latestPastYear: latestPast?.year || latest?.year || null,
    noticeCount: items.length,
    llmStructuredCount: items.filter((item) => item.structuredStatus === "llm").length,
    years: timeline.map((entry) => entry.year),
    stages: unique(items.map((item) => item.noticeStage || item.type)),
    degreeTypes: unique(items.flatMap((item) => item.degreeTypes || [])),
    majors: unique(items.flatMap((item) => item.majors || []).filter((item) => item !== "待确认")).slice(0, 16),
  };
}

function toProject(items) {
  const sorted = [...items].sort((a, b) => b.year - a.year || (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const first = sorted[0];
  const department = cleanDepartment(first.department, first.school);
  const summary = projectSummary(sorted);
  const tags = unique(sorted.flatMap((item) => item.tags || []));

  return {
    id: projectId(first.school, department),
    school: first.school,
    department,
    region: first.region || "待确认",
    levels: tags.filter((tag) => ["985", "211", "双一流"].includes(tag)),
    title: `${first.school} · ${department}`,
    tracks: inferTracks(sorted),
    qualityFlags: department.includes("待分院") ? ["学院待复核"] : [],
    ...summary,
    referenceNote: "往期时间仅供参考，具体以当年官方通知为准。",
  };
}

async function main() {
  const notices = JSON.parse(await fs.readFile(noticesPath, "utf8"));
  const groups = new Map();

  for (const notice of notices) {
    const department = cleanDepartment(notice.department, notice.school);
    const key = `${notice.school}::${department}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push({ ...notice, department });
  }

  const projects = Array.from(groups.values())
    .map(toProject)
    .sort((a, b) => {
      if (a.school === "中国人民大学" && b.school !== "中国人民大学") {
        return -1;
      }

      if (a.school !== "中国人民大学" && b.school === "中国人民大学") {
        return 1;
      }

      return b.noticeCount - a.noticeCount || a.title.localeCompare(b.title, "zh-CN");
    });

  await fs.writeFile(projectsPath, `${JSON.stringify(projects, null, 2)}\n`);
  console.log(JSON.stringify({ projects: projects.length, notices: notices.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
