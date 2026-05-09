import crypto from "node:crypto";
import fs from "node:fs/promises";
import { TextDecoder } from "node:util";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const sourcesPath = new URL("content/college-sources.json", root);
const universitiesPath = new URL("content/universities-985.json", root);

const majorHints = [
  "人工智能",
  "计算机科学与技术",
  "软件工程",
  "网络空间安全",
  "智能科学与技术",
  "电子信息",
  "大数据科学与工程",
  "信息安全",
  "智慧治理",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    source: "",
    school: "",
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source") {
      options.source = args[index + 1];
      index += 1;
    } else if (arg === "--school") {
      options.school = args[index + 1];
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
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

function cleanText(value) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCharset(contentType, bytes) {
  const headerMatch = contentType?.match(/charset=([^;\s]+)/i);
  if (headerMatch) {
    return headerMatch[1].toLowerCase();
  }

  const preview = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2000));
  const metaMatch = preview.match(/charset=["']?([^"'\s/>]+)/i);
  return metaMatch ? metaMatch[1].toLowerCase() : "utf-8";
}

function decodeBytes(bytes, contentType) {
  const charset = detectCharset(contentType, bytes);
  for (const candidate of [charset, "utf-8", "gb18030", "gbk"]) {
    try {
      return new TextDecoder(candidate).decode(bytes);
    } catch {
      // Try the next charset.
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 baoyan-beacon-college-crawler/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const contentType = response.headers.get("content-type") || "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    return decodeBytes(bytes, contentType);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function idFor(url, title) {
  return `college-${crypto.createHash("sha1").update(`${url}:${title}`).digest("hex").slice(0, 12)}`;
}

function inferType(title) {
  if (/夏令营|研学营/.test(title)) {
    return "夏令营";
  }

  if (/预推免|预报名/.test(title)) {
    return "预推免";
  }

  if (/直博|直接攻读博士/.test(title)) {
    return "直博";
  }

  return "推免";
}

function inferYear(title, url) {
  const titleMatch = title.match(/20\d{2}/);
  if (titleMatch) {
    return Number(titleMatch[0]);
  }

  const urlMatch = url.match(/20\d{2}/);
  return urlMatch ? Number(urlMatch[0]) : new Date().getFullYear();
}

function inferPublishedAt(url, fallbackYear) {
  const match = url.match(/(20\d{2})(\d{2})(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  return `${fallbackYear}-01-01`;
}

function inferMajors(title, text) {
  const source = `${title} ${text}`;
  const majors = majorHints.filter((major) => source.includes(major));
  return majors.length > 0 ? Array.from(new Set(majors)).slice(0, 5) : ["待确认"];
}

function parseAnchors(html, listUrl) {
  const results = [];
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const inner = match[2];
    const heading = inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || inner;
    const title = cleanText(heading);
    const excerpt = cleanText(inner).replace(title, "").trim();

    if (!title) {
      continue;
    }

    try {
      const url = new URL(decodeHtml(match[1]), listUrl).toString();
      results.push({ title, excerpt, url });
    } catch {
      // Ignore malformed links.
    }
  }

  return results;
}

function pageTitle(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]
    || "";
  return cleanText(title);
}

function officialDomain(url, university) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return university.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
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

function shouldKeep(candidate, source, university) {
  const text = `${candidate.title} ${candidate.excerpt}`;
  const includes = source.includeKeywords || [];
  const excludes = source.excludeKeywords || [];

  if (!officialDomain(candidate.url, university)) {
    return false;
  }

  if (!includes.some((keyword) => text.includes(keyword))) {
    return false;
  }

  if (excludes.some((keyword) => text.includes(keyword))) {
    return false;
  }

  if (candidate.title.length < 8 || candidate.title.length > 140) {
    return false;
  }

  return true;
}

function isLikelyListPage(candidate) {
  const text = `${candidate.title} ${candidate.url}`;
  return /下页|下一页|尾页|更多|招生|通知|公告|研究生|index\d+|list\d+|yjszs|zsxx/i.test(text);
}

async function expandListUrls(source, university) {
  const urls = new Set(source.listUrls || []);
  const seedUrls = Array.from(urls);

  for (const listUrl of seedUrls) {
    const html = await fetchHtml(listUrl);
    if (!html) {
      continue;
    }

    for (const anchor of parseAnchors(html, listUrl)) {
      if (!officialDomain(anchor.url, university) || !isLikelyListPage(anchor)) {
        continue;
      }

      urls.add(anchor.url);
      if (urls.size >= (source.maxListPages || 8)) {
        break;
      }
    }
  }

  return Array.from(urls).slice(0, source.maxListPages || 8);
}

async function candidatesForSource(source, university) {
  const candidates = [];

  for (const listUrl of await expandListUrls(source, university)) {
    const html = await fetchHtml(listUrl);
    const title = pageTitle(html);
    if (title && shouldKeep({ title, excerpt: cleanText(html).slice(0, 500), url: listUrl }, source, university)) {
      candidates.push({ title, excerpt: "", url: listUrl });
    }

    for (const candidate of parseAnchors(html, listUrl)) {
      if (shouldKeep(candidate, source, university)) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

async function createNotice(candidate, source, university) {
  const detailHtml = await fetchHtml(candidate.url);
  const detailText = cleanText(detailHtml).slice(0, 5000);
  const title = candidate.title;
  const year = inferYear(title, candidate.url);

  return {
    id: idFor(candidate.url, title),
    title,
    school: source.school,
    department: source.department,
    majors: inferMajors(title, detailText),
    type: inferType(title),
    year,
    region: source.region || university.region,
    deadline: "",
    publishedAt: inferPublishedAt(candidate.url, year),
    sourceName: `${source.school}${source.department}官方站点`,
    sourceUrl: candidate.url,
    sourceHost: sourceHost(candidate.url),
    sourceHomepage: sourceHomepage(candidate.url),
    departmentHomepage: source.homepageUrl || source.baseUrl || sourceHomepage(candidate.url),
    summary: candidate.excerpt || `${source.department}学院官网补漏发现的推免相关官方信息，请复核报名时间、项目类型和申请要求。`,
    tags: ["985", "官方域名", "学院官网", "补漏", source.id],
    confidence: "auto",
    sourceExcerpt: detailText.slice(0, 500),
  };
}

async function main() {
  const options = parseArgs();
  const [sources, universities, notices] = await Promise.all([
    fs.readFile(sourcesPath, "utf8").then(JSON.parse),
    fs.readFile(universitiesPath, "utf8").then(JSON.parse),
    fs.readFile(noticesPath, "utf8").then(JSON.parse),
  ]);
  const selectedSources = sources
    .filter((source) => !options.source || source.id === options.source)
    .filter((source) => !options.school || source.school === options.school);
  const existingKeys = new Set(notices.map((notice) => `${notice.sourceUrl}::${notice.title}`));
  const additions = [];

  for (const source of selectedSources) {
    const university = universities.find((item) => item.name === source.school);
    if (!university) {
      console.warn(`skip ${source.id}: university not found`);
      continue;
    }

    const candidates = await candidatesForSource(source, university);
    for (const candidate of candidates) {
      const key = `${candidate.url}::${candidate.title}`;
      if (existingKeys.has(key)) {
        continue;
      }

      const notice = await createNotice(candidate, source, university);
      existingKeys.add(key);
      additions.push(notice);
    }

    console.log(`${source.id}: candidates=${candidates.length}, new=${additions.length}`);
  }

  const next = [...notices, ...additions].sort((a, b) => {
    if (a.school === "中国人民大学" && b.school !== "中国人民大学") {
      return -1;
    }

    if (a.school !== "中国人民大学" && b.school === "中国人民大学") {
      return 1;
    }

    return (b.year || 0) - (a.year || 0) || (a.school || "").localeCompare(b.school || "", "zh-CN");
  });

  console.log(JSON.stringify({ before: notices.length, added: additions.length, after: next.length }, null, 2));

  if (!options.dryRun) {
    await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
