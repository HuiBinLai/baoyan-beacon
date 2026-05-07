import crypto from "node:crypto";
import fs from "node:fs/promises";
import { TextDecoder } from "node:util";

const root = new URL("../", import.meta.url);
const universitiesPath = new URL("content/universities-985.json", root);
const unitsPath = new URL("content/graduate-units.json", root);

const queryTemplates = [
  "site:{domain} {school} 院系设置 学院",
  "site:{domain} {school} 院系 学部 研究院",
  "site:{domain} {school} 研究生招生 院系 联系方式",
];
const commonDepartmentPaths = [
  "department.html",
  "departments.html",
  "yxsz/",
  "yxsz/index.htm",
  "xysz/",
  "xysz/index.htm",
  "yxsz.htm",
  "yxsz/index.htm",
  "xysz.htm",
  "jgsz.htm",
  "jgsz/index.htm",
  "xyxk.htm",
  "xyxk/index.htm",
  "yxbm/",
  "yxbm/index.htm",
  "school/",
  "schools/",
  "zzjg.htm",
  "zzjg/index.htm",
];
const knownDepartmentUrls = {
  中国人民大学: ["https://pgs.ruc.edu.cn/lxwm/xylxdh.htm"],
  北京大学: ["https://www.pku.edu.cn/department.html", "https://admission.pku.edu.cn/lxxx/lxyx/index.htm"],
  清华大学: ["https://www.tsinghua.edu.cn/yxsz.htm?s=103"],
  复旦大学: ["http://www.fudan.edu.cn/489/list.htm"],
  上海交通大学: ["https://www.sjtu.edu.cn/yxsz/"],
  浙江大学: ["https://hr.zju.edu.cn/cn/1186/list.htm", "https://www.grs.zju.edu.cn/"],
  南京大学: ["https://www.nju.edu.cn/xybm.htm"],
  中国科学技术大学: ["https://www.ustc.edu.cn/yxjs.htm"],
  西安交通大学: ["https://www.xjtu.edu.cn/yxsz.htm"],
  哈尔滨工业大学: ["https://www.hit.edu.cn/11589/list.htm", "https://www.hit.edu.cn/11386/list.htm"],
  北京航空航天大学: ["https://www.buaa.edu.cn/jgsz/jxkyjg02.htm"],
  北京理工大学: ["https://www.bit.edu.cn/gbxxgk/gbgljg/index.htm"],
};
const excludeUnitPatterns = [
  /研究生院/,
  /本科生院/,
  /招生办/,
  /教务处/,
  /新闻网/,
  /图书馆/,
  /校友会/,
  /附属医院/,
  /出版社/,
  /附属学校/,
  /实验室/,
  /办公室/,
  /委员会/,
  /专题/,
  /专栏/,
  /通知/,
  /公告/,
  /新闻/,
  /首页/,
  /大学$/,
];

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    school: valueAfter(args, "--school"),
    limitSchools: Number(valueAfter(args, "--limit-schools") || Infinity),
    maxPages: Number(valueAfter(args, "--max-pages") || 4),
    maxResults: Number(valueAfter(args, "--max-results") || 6),
    sleepMs: Number(valueAfter(args, "--sleep-ms") || 300),
    concurrency: Number(valueAfter(args, "--concurrency") || 4),
  };
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(value) {
  return String(value || "")
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

function normalizeText(value) {
  return cleanText(value)
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/\s+/g, "")
    .replace(/[（）()]/g, "")
    .replace(/^.*大学/, "")
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
  const candidates = [detectCharset(contentType, bytes), "utf-8", "gb18030", "gbk"];

  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate).decode(bytes);
    } catch {
      // Continue with the next charset.
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 baoyan-beacon-unit-discovery/0.1",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return "";
    }

    const contentType = response.headers.get("content-type") || "";
    if (/pdf|msword|officedocument/i.test(contentType) || /\.pdf($|\?)/i.test(url)) {
      return "";
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return decodeBytes(bytes, contentType);
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
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

function officialDomain(url, university) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return university.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
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

    results.push({ title: cleanText(linkMatch[2]), url: normalizeUrl(linkMatch[1]) });
  }

  return results;
}

function parseDuckDuckGo(html) {
  const results = [];
  const linkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let linkMatch;

  while ((linkMatch = linkPattern.exec(html))) {
    results.push({ title: cleanText(linkMatch[2]), url: normalizeUrl(linkMatch[1]) });
  }

  return results;
}

async function search(query, maxResults) {
  const encoded = encodeURIComponent(query);
  const engines = [
    { url: `https://www.bing.com/search?q=${encoded}&setlang=zh-CN`, parser: parseBing },
    { url: `https://html.duckduckgo.com/html/?q=${encoded}`, parser: parseDuckDuckGo },
  ];
  const found = [];

  for (const engine of engines) {
    const html = await fetchHtml(engine.url);
    found.push(...engine.parser(html));

    if (found.length >= maxResults) {
      break;
    }
  }

  return found.slice(0, maxResults);
}

function parseAnchors(html, pageUrl) {
  const anchors = [];
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const title = cleanText(match[2]);
    if (!title) {
      continue;
    }

    try {
      anchors.push({ title, url: new URL(decodeHtml(match[1]), pageUrl).toString() });
    } catch {
      // Ignore malformed URLs.
    }
  }

  return anchors;
}

function candidateNamesFromText(text) {
  const candidates = new Map();
  const spacedText = cleanText(text).replace(/([（）()])/g, "");
  const tokens = spacedText.split(/[\s|｜、，,;；:：>《》「」【】\[\]]+/).filter(Boolean);

  for (const token of tokens) {
    const raw = token.replace(/^.*大学/, "").replace(/^[>：:、，,\s-]+/, "").trim();
    const normalized = normalizeText(raw);

    if (!/(学院|学部|学系|系|研究院|书院|中心|部)$/.test(normalized)) {
      continue;
    }

    if (!normalized || normalized.length < 2 || normalized.length > 18) {
      continue;
    }

    if (excludeUnitPatterns.some((pattern) => pattern.test(normalized))) {
      continue;
    }

    candidates.set(normalized, raw);
  }

  const compactText = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2");
  const unitPattern = /([\u4e00-\u9fa5A-Za-z0-9·（）()]{2,24}?(学院|学部|学系|系|研究院|书院|中心|部))/g;
  let match;

  while ((match = unitPattern.exec(compactText))) {
    const raw = match[1]
      .replace(/^.*大学/, "")
      .replace(/^[>：:、，,\s-]+/, "")
      .trim();
    const normalized = normalizeText(raw);

    if (!normalized || normalized.length < 2 || normalized.length > 18) {
      continue;
    }

    if (excludeUnitPatterns.some((pattern) => pattern.test(normalized))) {
      continue;
    }

    candidates.set(normalized, raw);
  }

  return candidates;
}

function findUnitsOnPage(html, pageUrl, university) {
  const units = new Map();
  const pageText = cleanText(html);

  for (const [normalized, raw] of candidateNamesFromText(pageText)) {
    units.set(normalized, { department: raw, sourceUrl: pageUrl });
  }

  for (const anchor of parseAnchors(html, pageUrl)) {
    if (!officialDomain(anchor.url, university)) {
      continue;
    }

    for (const [normalized, raw] of candidateNamesFromText(anchor.title)) {
      units.set(normalized, { department: raw, sourceUrl: anchor.url });
    }
  }

  return Array.from(units.values());
}

function mergeUnits(existing, discovered) {
  const byKey = new Map();

  for (const unit of existing) {
    byKey.set(`${unit.school}::${normalizeText(unit.department)}`, unit);
  }

  for (const unit of discovered) {
    const key = `${unit.school}::${normalizeText(unit.department)}`;
    if (byKey.has(key)) {
      const current = byKey.get(key);
      byKey.set(key, {
        ...unit,
        ...current,
        aliases: Array.from(new Set([...(unit.aliases || []), ...(current.aliases || [])])),
      });
      continue;
    }

    byKey.set(key, unit);
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.school !== b.school) {
      return (a.schoolPriority || 999) - (b.schoolPriority || 999);
    }

    return (a.priority || 9999) - (b.priority || 9999) || a.department.localeCompare(b.department, "zh-CN");
  });
}

async function discoverForSchool(university, options) {
  const urls = new Map();
  for (const url of knownDepartmentUrls[university.name] || []) {
    urls.set(url, "已知官方院系页面");
  }

  for (const template of queryTemplates) {
    const query = template
      .replace("{domain}", university.domains[0])
      .replace("{school}", university.name);
    const results = await search(query, options.maxResults);

    for (const result of results) {
      if (officialDomain(result.url, university) && /院系|学院|学部|研究生|招生|联系|机构|设置/.test(`${result.title} ${result.url}`)) {
        urls.set(result.url, result.title);
      }
    }

    await sleep(options.sleepMs);
  }

  for (const domain of university.domains) {
    for (const path of commonDepartmentPaths) {
      urls.set(`https://www.${domain}/${path}`, "常见院系页面");
      urls.set(`https://${domain}/${path}`, "常见院系页面");
    }
  }

  const discovered = [];
  const htmlPages = await Promise.all(Array.from(urls.keys()).slice(0, options.maxPages).map(async (url) => {
    const html = await fetchHtml(url);
    return { url, html };
  }));

  for (const { url, html } of htmlPages) {
    if (!html) {
      continue;
    }
    discovered.push(...findUnitsOnPage(html, url, university));
  }

  const unique = new Map();
  for (const item of discovered) {
    const key = normalizeText(item.department);
    if (!unique.has(key)) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values()).map((item, index) => ({
    id: `${hash(`${university.name}:${item.department}`)}`,
    school: university.name,
    department: item.department,
    aliases: [item.department],
    sourceName: `${university.name}官方院系页面自动发现`,
    sourceUrl: item.sourceUrl,
    sourceStatus: "auto_discovered",
    schoolPriority: university.priority,
    priority: index + 1,
  }));
}

async function runPool(items, concurrency, worker) {
  const results = [];
  let cursor = 0;

  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) {
      return;
    }

    results[index] = await worker(items[index], index);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

async function main() {
  const options = parseArgs();
  const [universities, existing] = await Promise.all([
    fs.readFile(universitiesPath, "utf8").then(JSON.parse),
    fs.readFile(unitsPath, "utf8").then(JSON.parse).catch(() => []),
  ]);
  const selected = universities
    .filter((university) => !options.school || university.name === options.school)
    .slice(0, options.limitSchools);
  const allDiscovered = [];

  const discoveredBySchool = await runPool(selected, options.concurrency, async (university) => {
    const units = await discoverForSchool(university, options);
    console.log(`${university.name}: discovered ${units.length} candidate units`);
    return units;
  });

  allDiscovered.push(...discoveredBySchool.flat());

  const merged = mergeUnits(existing, allDiscovered);
  const totals = {
    schools: new Set(merged.map((unit) => unit.school)).size,
    units: merged.length,
    discovered: allDiscovered.length,
  };
  console.log(JSON.stringify(totals, null, 2));

  if (!options.dryRun) {
    await fs.writeFile(unitsPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
