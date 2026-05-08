import crypto from "node:crypto";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const universitiesPath = new URL("content/universities-985.json", root);
const graduateUnitsPath = new URL("content/graduate-units.json", root);
const graduateUnitCoveragePath = new URL("content/graduate-unit-coverage.json", root);

const currentYear = new Date().getFullYear();
const defaultYears = Array.from({ length: 5 }, (_, index) => currentYear - index);
const keywords = ["夏令营", "研学营", "预推免", "预报名", "推免", "推免生", "推荐免试", "免试攻读", "直博", "接收办法", "工作办法", "实施细则"];
const excludeWords = ["考研网", "新东方", "高顿", "保研通", "知乎", "小红书", "百度", "豆丁", "道客", "中公", "跨考", "掌上考研"];
const excludeTitleWords = ["登录", "入口", "系统", "名单", "结果公示", "培养方案", "推免工作实施细则", "推荐工作实施办法", "推荐工作安排"];
const basicQueryTemplates = [
  "{site} {school} {year} 夏令营 推免",
  "{site} {school} {year} 预推免 通知",
  "{site} {school} {year} 推荐免试 研究生",
];
const deepQueryTemplates = [
  "{site} {school} {year} 推免生 接收 工作 报名 通知",
  "{site} {school} {year} 接收优秀应届本科毕业生免试攻读研究生",
  "{site} {school} {year} 推荐免试研究生 工作办法",
  "{site} {school} {year} 直接攻读博士",
  "{site} {school} {year} 优秀大学生夏令营 通知",
  "{site} {school} {year} 研学营 推免",
  "{site} {school} {year} 学院 推免",
  "{site} {school} {year} 研究生 推免 接收",
];
const unitBasicQueryTemplates = [
  "{site} {school} {department} {year} 推免",
  "{site} {school} {department} {year} 夏令营",
  "{site} {school} {department} {year} 推荐免试",
];
const unitDeepQueryTemplates = [
  "{site} {school} {department} {year} 接收优秀应届本科毕业生免试攻读",
  "{site} {school} {department} {year} 推免生 接收 工作 报名 通知",
  "{site} {school} {department} {year} 预报名 预推免",
  "{site} {school} {department} {year} 直博",
];
const majorHints = [
  "哲学",
  "经济学",
  "金融",
  "法学",
  "政治学",
  "社会学",
  "马克思主义理论",
  "教育学",
  "心理学",
  "体育学",
  "中国语言文学",
  "外国语言文学",
  "新闻传播学",
  "历史学",
  "数学",
  "物理学",
  "化学",
  "天文学",
  "地理学",
  "大气科学",
  "海洋科学",
  "地球物理学",
  "地质学",
  "生物学",
  "统计学",
  "力学",
  "机械工程",
  "光学工程",
  "材料科学与工程",
  "能源动力",
  "电气工程",
  "电子科学与技术",
  "信息与通信工程",
  "控制科学与工程",
  "计算机科学与技术",
  "软件工程",
  "网络空间安全",
  "人工智能",
  "建筑学",
  "土木工程",
  "水利工程",
  "化学工程与技术",
  "交通运输工程",
  "航空宇航科学与技术",
  "环境科学与工程",
  "生物医学工程",
  "食品科学与工程",
  "城乡规划学",
  "风景园林",
  "基础医学",
  "临床医学",
  "公共卫生",
  "药学",
  "护理学",
  "管理科学与工程",
  "工商管理",
  "公共管理",
  "会计",
  "图书情报",
  "艺术学",
  "设计学",
  "电子信息",
  "机械",
  "材料与化工",
  "资源与环境",
  "生物与医药",
  "法律",
  "翻译",
  "出版",
  "文物与博物馆",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    schools: [],
    years: defaultYears,
    maxPerQuery: 3,
    deep: false,
    sleepMs: 420,
    dryRun: false,
    graduateUnits: false,
    departments: [],
    unitLimit: Infinity,
    unitOffset: 0,
    missingOnly: false,
    engines: ["baidu", "bing", "duckduckgo"],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--school") {
      options.schools.push(args[index + 1]);
      index += 1;
    } else if (arg === "--years") {
      options.years = args[index + 1].split(",").map((year) => Number(year.trim()));
      index += 1;
    } else if (arg === "--max-per-query") {
      options.maxPerQuery = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--deep") {
      options.deep = true;
    } else if (arg === "--sleep-ms") {
      options.sleepMs = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--graduate-units") {
      options.graduateUnits = true;
    } else if (arg === "--department") {
      options.departments.push(args[index + 1]);
      index += 1;
    } else if (arg === "--unit-limit") {
      options.unitLimit = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--unit-offset") {
      options.unitOffset = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--missing-only") {
      options.missingOnly = true;
    } else if (arg === "--engines") {
      options.engines = args[index + 1].split(",").map((engine) => engine.trim()).filter(Boolean);
      index += 1;
    }
  }

  return options;
}

function buildQueries(university, year, deep, unit = null) {
  const site = `site:${university.domains[0]}`;
  const templates = unit
    ? deep
      ? [...unitBasicQueryTemplates, ...unitDeepQueryTemplates]
      : unitBasicQueryTemplates
    : deep
      ? [...basicQueryTemplates, ...deepQueryTemplates]
      : basicQueryTemplates;
  return templates.map((template) => template
    .replace("{site}", site)
    .replace("{school}", university.name)
    .replace("{department}", unit?.department || "")
    .replace("{year}", String(year)));
}

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-_\s]+|[-_\s]+$/g, "")
    .trim();
}

function normalizeChineseSpaces(value) {
  return String(value || "")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    })
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number.parseInt(code, 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : "";
    });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function rotate(items, offset) {
  if (!items.length) {
    return items;
  }

  const safeOffset = ((Number(offset) || 0) % items.length + items.length) % items.length;
  return [...items.slice(safeOffset), ...items.slice(0, safeOffset)];
}

function idFor(url, title) {
  return crypto.createHash("sha1").update(`${url}:${title}`).digest("hex").slice(0, 12);
}

function inferType(title) {
  if (title.includes("夏令营")) {
    return "夏令营";
  }

  if (title.includes("预推免") || title.includes("预报名")) {
    return "预推免";
  }

  if (title.includes("直博")) {
    return "直博";
  }

  return "推免";
}

function inferYear(title, fallbackYear) {
  const match = title.match(/20\d{2}/);
  return match ? Number(match[0]) : fallbackYear;
}

function inferDepartment(title) {
  const normalizedTitle = normalizeChineseSpaces(title);
  const match = normalizedTitle.match(/([\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,28}(学院|学部|研究院|书院|中心|系|所|部))/);
  if (!match) {
    return "待结构化";
  }

  const department = match[1].replace(/^.*大学/, "");
  return department || match[1];
}

function normalizeUnitText(value) {
  return normalizeChineseSpaces(value)
    .replace(/中国人民大学/g, "")
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "");
}

function unitMatchesTitle(title, unit) {
  if (!unit) {
    return false;
  }

  const normalizedTitle = normalizeUnitText(title);
  return [unit.department, ...(unit.aliases || [])]
    .map(normalizeUnitText)
    .filter((item) => item.length >= 2)
    .some((alias) => normalizedTitle.includes(alias));
}

function inferMajors(title) {
  const majors = majorHints.filter((major) => title.includes(major));
  return majors.length > 0 ? Array.from(new Set(majors)).slice(0, 5) : ["待确认"];
}

function officialDomain(url, domains) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function sourceHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function sourceHomepage(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return "";
  }
}

function normalizeUrl(rawUrl) {
  try {
    const url = new URL(decodeHtml(rawUrl));

    if (url.hostname.includes("bing.com") && url.searchParams.has("u")) {
      const encoded = url.searchParams.get("u") || "";
      const normalized = encoded.startsWith("a1") ? atob(encoded.slice(2)) : encoded;
      return new URL(normalized).toString();
    }

    if (url.hostname.includes("duckduckgo.com") && url.searchParams.has("uddg")) {
      return new URL(url.searchParams.get("uddg") || "").toString();
    }

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function shouldKeep(title, url, university) {
  if (!title || !url) {
    return false;
  }

  if (!officialDomain(url, university.domains)) {
    return false;
  }

  if (!keywords.some((keyword) => title.includes(keyword))) {
    return false;
  }

  if (excludeWords.some((word) => title.includes(word) || url.includes(word))) {
    return false;
  }

  if (excludeTitleWords.some((word) => title.includes(word))) {
    return false;
  }

  if (/\.pdf($|\?)/i.test(url) && !/(招生简章|报名通知|接收|工作办法|夏令营|研学营|预推免)/.test(title)) {
    return false;
  }

  if (/^(推荐免试|推免|夏令营|预推免)\s*[-_—]/.test(title)) {
    return false;
  }

  if (title.length < 8 || title.length > 120) {
    return false;
  }

  return true;
}

function parseBing(html) {
  const results = [];
  const itemPattern = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(html))) {
    const item = itemMatch[0];
    const linkMatch = item.match(linkPattern);
    if (!linkMatch) {
      continue;
    }

    results.push({
      title: cleanText(linkMatch[2]),
      url: normalizeUrl(linkMatch[1]),
    });
  }

  return results;
}

function parseDuckDuckGo(html) {
  const results = [];
  const linkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch;

  while ((linkMatch = linkPattern.exec(html))) {
    results.push({
      title: cleanText(linkMatch[2]),
      url: normalizeUrl(linkMatch[1]),
    });
  }

  return results;
}

function parseBaidu(html) {
  const results = [];
  const itemPattern = /<div class="result c-container[\s\S]*?(?=<div class="result c-container|<div id="page"|$)/gi;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(html))) {
    const item = itemMatch[0];
    const urlMatch = item.match(/\smu="([^"]+)"/i);
    const titleMatch = item.match(/<h3[\s\S]*?<\/h3>/i);

    if (!urlMatch || !titleMatch) {
      continue;
    }

    results.push({
      title: cleanText(titleMatch[0]),
      url: normalizeUrl(urlMatch[1]),
    });
  }

  return results;
}

async function search(query, maxPerQuery, enabledEngines) {
  const encoded = encodeURIComponent(query);
  const urls = [
    {
      engine: "baidu",
      url: `https://www.baidu.com/s?wd=${encoded}`,
      parser: parseBaidu,
    },
    {
      engine: "bing",
      url: `https://www.bing.com/search?q=${encoded}&setlang=zh-CN`,
      parser: parseBing,
    },
    {
      engine: "duckduckgo",
      url: `https://html.duckduckgo.com/html/?q=${encoded}`,
      parser: parseDuckDuckGo,
    },
  ];
  const found = [];

  for (const item of urls.filter((engine) => enabledEngines.includes(engine.engine))) {
    try {
      const response = await fetch(item.url, {
        headers: {
          "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
          "user-agent": "Mozilla/5.0 baoyan-beacon-data-harvester/0.1",
        },
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      found.push(...item.parser(html).map((result) => ({ ...result, engine: item.engine })));
    } catch (error) {
      console.warn(`search failed: ${item.engine} ${error.message}`);
    }
  }

  const seen = new Set();
  return found
    .filter((result) => {
      const key = `${result.url}::${result.title}`;
      if (!result.url || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, maxPerQuery);
}

function toNotice(result, university, queryYear, unit = null) {
  const year = inferYear(result.title, queryYear);
  const unitHit = unitMatchesTitle(result.title, unit);
  const department = unitHit ? unit.department : inferDepartment(result.title);
  return {
    id: `search-${idFor(result.url, result.title)}`,
    title: result.title,
    school: university.name,
    department,
    majors: inferMajors(result.title),
    type: inferType(result.title),
    year,
    region: university.region,
    deadline: "",
    publishedAt: `${Math.min(year, currentYear)}-01-01`,
    sourceName: unitHit ? `${university.name}${unit.department}官方站点` : `${university.name}官方站点`,
    sourceUrl: result.url,
    sourceHost: sourceHost(result.url),
    sourceHomepage: sourceHomepage(result.url),
    departmentHomepage: unit?.sourceUrl || sourceHomepage(result.url),
    summary: `搜索引擎发现的${university.name}${year}年${inferType(result.title)}相关官方信息，已按官方域名过滤。请在后台复核学院、专业、截止日期和正文摘要。`,
    tags: ["985", "官方域名", "搜索发现", result.engine, ...(unit ? ["院系补漏", unit.id] : [])],
    confidence: "auto",
  };
}

function sortNotices(notices, priorities) {
  return notices.sort((a, b) => {
    const priorityA = priorities.get(a.school) ?? 999;
    const priorityB = priorities.get(b.school) ?? 999;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    if (b.year !== a.year) {
      return b.year - a.year;
    }
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function dedupeNotices(notices) {
  const seenUrls = new Set();
  const seenTitleKeys = new Set();
  const clean = [];

  for (const notice of notices) {
    if (excludeTitleWords.some((word) => notice.title.includes(word))) {
      continue;
    }

    const urlKey = notice.sourceUrl.replace(/\/$/, "");
    const titleKey = `${notice.school}:${notice.year}:${notice.title.replace(/\s+/g, "").replace(/[...…]/g, "")}`;

    if (seenUrls.has(urlKey) || seenTitleKeys.has(titleKey)) {
      continue;
    }

    seenUrls.add(urlKey);
    seenTitleKeys.add(titleKey);
    clean.push(notice);
  }

  return clean;
}

async function main() {
  const options = parseArgs();
  const [noticesRaw, universitiesRaw] = await Promise.all([
    fs.readFile(noticesPath, "utf8"),
    fs.readFile(universitiesPath, "utf8"),
  ]);

  const notices = JSON.parse(noticesRaw);
  const universities = JSON.parse(universitiesRaw)
    .filter((university) => options.schools.length === 0 || options.schools.includes(university.name))
    .sort((a, b) => a.priority - b.priority);

  const known = new Set(notices.flatMap((notice) => [`${notice.sourceUrl}:${notice.title}`, notice.sourceUrl.replace(/\/$/, "")]));
  const priorities = new Map(JSON.parse(universitiesRaw).map((university) => [university.name, university.priority]));
  const additions = [];
  let missingUnitIds = null;
  if (options.missingOnly) {
    try {
      const report = JSON.parse(await fs.readFile(graduateUnitCoveragePath, "utf8"));
      missingUnitIds = new Set((report.units || []).filter((unit) => unit.status !== "covered").map((unit) => unit.id));
      console.log(`missing unit scope: ${missingUnitIds.size}`);
    } catch {
      missingUnitIds = new Set();
    }
  }

  const graduateUnits = options.graduateUnits
    ? rotate(
      JSON.parse(await fs.readFile(graduateUnitsPath, "utf8"))
      .filter((unit) => universities.some((university) => university.name === unit.school))
      .filter((unit) => options.departments.length === 0 || options.departments.includes(unit.department))
      .filter((unit) => !missingUnitIds || missingUnitIds.has(unit.id))
      .sort((a, b) => (a.schoolPriority || 999) - (b.schoolPriority || 999) || (a.priority || 999) - (b.priority || 999)),
      options.unitOffset,
    ).slice(0, options.unitLimit)
    : [];

  for (const university of universities) {
    const unitScope = options.graduateUnits ? graduateUnits.filter((unit) => unit.school === university.name) : [null];
    for (const unit of unitScope) {
      for (const year of options.years) {
        const queries = buildQueries(university, year, options.deep, unit);

        for (const query of queries) {
          console.log(`search: ${query}`);
          const results = await search(query, options.maxPerQuery, options.engines);

          for (const result of results) {
            if (!shouldKeep(result.title, result.url, university)) {
              continue;
            }

            const key = `${result.url}:${result.title}`;
            const urlKey = result.url.replace(/\/$/, "");
            if (known.has(key) || known.has(urlKey)) {
              continue;
            }

            known.add(key);
            known.add(urlKey);
            additions.push(toNotice(result, university, year, unit));
          }

          await sleep(options.sleepMs);
        }
      }
    }
  }

  console.log(`found ${additions.length} new notices`);
  if (options.dryRun || additions.length === 0) {
    return;
  }

  const next = sortNotices(dedupeNotices([...additions, ...notices]), priorities);
  await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
