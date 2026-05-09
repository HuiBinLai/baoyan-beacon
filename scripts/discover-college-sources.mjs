import crypto from "node:crypto";
import fs from "node:fs/promises";
import { TextDecoder } from "node:util";

const root = new URL("../", import.meta.url);
const universitiesPath = new URL("content/universities-985.json", root);
const unitsPath = new URL("content/graduate-units.json", root);
const unitCoveragePath = new URL("content/graduate-unit-coverage.json", root);
const sourcesPath = new URL("content/college-sources.json", root);

const includeKeywords = ["推免", "推荐免试", "免试", "夏令营", "研学营", "优秀大学生", "预推免", "预报名", "直博", "接收优秀应届本科毕业生", "招生简章", "研究生招生"];
const excludeKeywords = ["博士后", "招聘", "人才招聘", "初试成绩", "成绩复核", "复试名单", "复试成绩", "复试录取", "港澳台", "优秀营员名单", "入营名单", "候补名单", "拟录取", "公示", "采购", "招标"];
const sourcePageHints = [
  "研究生招生",
  "研究生教育",
  "研究生培养",
  "招生信息",
  "招生工作",
  "招生公告",
  "招生就业",
  "人才培养",
  "硕士招生",
  "博士招生",
  "通知公告",
  "公告通知",
  "通知预告",
  "招生",
  "推免",
  "推荐免试",
  "夏令营",
  "预推免",
];
const negativePageHints = ["招聘", "博士后", "就业", "本科招生", "本科生", "校友", "党建", "工会", "采购", "招标", "媒体", "新闻"];
const genericUnitNames = new Set(["学部与院系", "院系设置", "学院设置", "学部设置", "院系", "学院", "研究生院"]);

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    missingOnly: args.includes("--missing-only"),
    search: args.includes("--search"),
    debug: args.includes("--debug"),
    school: valueAfter(args, "--school"),
    department: valueAfter(args, "--department"),
    limit: Number(valueAfter(args, "--limit") || Infinity),
    offset: Number(valueAfter(args, "--offset") || 0),
    maxListUrls: Number(valueAfter(args, "--max-list-urls") || 8),
    sleepMs: Number(valueAfter(args, "--sleep-ms") || 250),
    engines: (valueAfter(args, "--engines") || "baidu,bing,duckduckgo").split(",").map((engine) => engine.trim()).filter(Boolean),
  };
}

function valueAfter(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
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
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : "";
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
    .replace(/中国人民大学/g, "")
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, "$1$2")
    .replace(/[（）()]/g, "")
    .replace(/\s+/g, "")
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
      // Try the next charset.
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
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

async function fetchSearchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: controller.signal,
    });

    return response.ok ? await response.text() : "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function normalizeUrl(rawUrl, baseUrl = "") {
  try {
    const url = baseUrl ? new URL(decodeHtml(rawUrl), baseUrl) : new URL(decodeHtml(rawUrl));

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

function homepageFor(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}/`;
  } catch {
    return "";
  }
}

function hostFor(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function parseAnchors(html, pageUrl) {
  const anchors = [];
  const anchorPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const title = cleanText(match[2]);
    const url = normalizeUrl(match[1], pageUrl);
    if (title && url) {
      anchors.push({ title, url });
    }
  }

  return anchors;
}

function parseBing(html) {
  const results = [];
  const itemPattern = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;
  let itemMatch;

  while ((itemMatch = itemPattern.exec(html))) {
    const linkMatch = itemMatch[0].match(linkPattern);
    if (linkMatch) {
      results.push({ title: cleanText(linkMatch[2]), url: normalizeUrl(linkMatch[1]) });
    }
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

    results.push({ title: cleanText(titleMatch[0]), url: normalizeUrl(urlMatch[1]) });
  }

  return results;
}

async function search(query, options) {
  const encoded = encodeURIComponent(query);
  const engines = [
    { name: "baidu", url: `https://www.baidu.com/s?wd=${encoded}`, parser: parseBaidu },
    { name: "bing", url: `https://www.bing.com/search?q=${encoded}&setlang=zh-CN`, parser: parseBing },
    { name: "duckduckgo", url: `https://html.duckduckgo.com/html/?q=${encoded}`, parser: parseDuckDuckGo },
  ];
  const results = [];

  for (const engine of engines.filter((item) => options.engines.includes(item.name))) {
    const html = await fetchSearchHtml(engine.url);
    const parsed = engine.parser(html).map((item) => ({ ...item, engine: engine.name }));
    if (options.debug) {
      console.log(`search ${engine.name}: html=${html.length} parsed=${parsed.length} query=${query}`);
    }
    results.push(...parsed);
  }

  const seen = new Set();
  return results.filter((result) => {
    if (!result.url || seen.has(result.url)) {
      return false;
    }

    seen.add(result.url);
    return true;
  });
}

function pageScore(candidate, unit) {
  const text = `${candidate.title} ${candidate.url}`;
  let score = 0;

  if (normalizeText(text).includes(normalizeText(unit.department))) {
    score += 12;
  }

  for (const hint of sourcePageHints) {
    if (text.includes(hint)) {
      score += hint.length >= 4 ? 8 : 4;
    }
  }

  for (const hint of negativePageHints) {
    if (text.includes(hint)) {
      score -= 10;
    }
  }

  if (/yjs|yz|zs|zspy|zsgz|yjszs|zsxx|notice|news|tzgg|tzyg|rcpy/i.test(candidate.url)) {
    score += 3;
  }

  if (/\/info\/\d+\/\d+\.htm/i.test(candidate.url)) {
    score -= 2;
  }

  return score;
}

function realUnit(unit) {
  const department = normalizeText(unit.department);
  if (!department || department.length < 2 || genericUnitNames.has(department)) {
    return false;
  }

  return /(学院|学部|学系|系|研究院|书院|中心|部)$/.test(department);
}

function candidateHomepages(unit, university, searchResults) {
  const urls = new Map();

  for (const result of searchResults) {
    if (!officialDomain(result.url, university)) {
      continue;
    }

    const score = pageScore(result, unit);
    if (score >= 8) {
      urls.set(result.url, result.title);
      urls.set(homepageFor(result.url), result.title);
    }
  }

  if (unit.sourceUrl && officialDomain(unit.sourceUrl, university)) {
    urls.set(unit.sourceUrl, unit.department);
  }

  return Array.from(urls.entries())
    .filter(([url]) => Boolean(url))
    .map(([url, title]) => ({ url, title }));
}

async function discoverSourceForUnit(unit, university, options) {
  const searchResults = [];
  if (options.search) {
    const queries = [
      `site:${university.domains[0]} ${unit.school} ${unit.department} 研究生招生`,
      `site:${university.domains[0]} ${unit.school} ${unit.department} 推免`,
      `site:${university.domains[0]} ${unit.school} ${unit.department} 招生信息`,
      `site:${university.domains[0]} ${unit.school} ${unit.department} 官网`,
    ];

    for (const query of queries) {
      searchResults.push(...await search(query, options));
      await sleep(options.sleepMs);
    }

    if (options.debug) {
      console.log(JSON.stringify(searchResults.slice(0, 12), null, 2));
    }
  }

  const homepages = candidateHomepages(unit, university, searchResults);
  if (options.debug) {
    console.log("homepages", JSON.stringify(homepages.slice(0, 12), null, 2));
  }
  const listUrlScores = new Map();

  for (const seed of homepages.slice(0, 8)) {
    const { url } = seed;
    if (!officialDomain(url, university)) {
      continue;
    }

    listUrlScores.set(url, Math.max(listUrlScores.get(url) || 0, pageScore(seed, unit)));
    const html = await fetchHtml(url);
    if (!html) {
      continue;
    }

    for (const anchor of parseAnchors(html, url)) {
      if (!officialDomain(anchor.url, university)) {
        continue;
      }

      const score = pageScore(anchor, unit);
      if (score >= 4) {
        listUrlScores.set(anchor.url, Math.max(listUrlScores.get(anchor.url) || 0, score));
      }
    }
  }

  const listUrls = Array.from(listUrlScores.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([url]) => url)
    .slice(0, options.maxListUrls);
  if (options.debug) {
    console.log("listUrlScores", JSON.stringify(Array.from(listUrlScores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12), null, 2));
  }
  const bestUrl = listUrls[0] || homepages[0]?.url || unit.sourceUrl || "";
  const homepageUrl = homepageFor(bestUrl) || bestUrl;

  return {
    id: `auto-${hash(`${unit.school}:${unit.department}`)}`,
    school: unit.school,
    department: unit.department,
    region: university.region,
    homepageUrl: homepageUrl || "",
    sourceHost: hostFor(homepageUrl || listUrls[0] || ""),
    baseUrl: bestUrl || homepageUrl || "",
    listUrls: listUrls.length > 0 ? listUrls : [unit.sourceUrl].filter(Boolean),
    includeKeywords,
    excludeKeywords,
    maxListPages: 8,
    sourceStatus: options.search ? "auto_discovered_with_search" : "auto_discovered_from_homepage",
    discoveredAt: new Date().toISOString(),
  };
}

function sourceKey(source) {
  return `${source.school}::${normalizeText(source.department)}`;
}

function mergeSources(existing, discovered) {
  const byKey = new Map();

  for (const source of existing) {
    byKey.set(sourceKey(source), source);
  }

  for (const source of discovered) {
    const key = sourceKey(source);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, source);
      continue;
    }

    const shouldPreferNewHomepage = isGenericHomepage(current.homepageUrl || current.baseUrl) && !isGenericHomepage(source.homepageUrl || source.baseUrl);
    const mergedListUrls = shouldPreferNewHomepage
      ? [...(source.listUrls || []), ...(current.listUrls || [])]
      : [...(current.listUrls || []), ...(source.listUrls || [])];

    byKey.set(key, {
      ...source,
      ...current,
      homepageUrl: shouldPreferNewHomepage ? source.homepageUrl : current.homepageUrl || source.homepageUrl,
      sourceHost: shouldPreferNewHomepage ? source.sourceHost : current.sourceHost || source.sourceHost,
      baseUrl: shouldPreferNewHomepage ? source.baseUrl : current.baseUrl || source.baseUrl,
      listUrls: Array.from(new Set(mergedListUrls)).slice(0, Math.max(current.maxListPages || 8, source.maxListPages || 8)),
      includeKeywords: Array.from(new Set([...(current.includeKeywords || []), ...(source.includeKeywords || [])])),
      excludeKeywords: Array.from(new Set([...(current.excludeKeywords || []), ...(source.excludeKeywords || [])])),
      discoveredAt: current.discoveredAt || source.discoveredAt,
    });
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.school !== b.school) {
      return a.school.localeCompare(b.school, "zh-CN");
    }

    return a.department.localeCompare(b.department, "zh-CN");
  });
}

function isGenericHomepage(url) {
  return /\/lxwm\/xylxdh|\/department\.html|\/yxsz|\/xybm|\/jgsz/i.test(url || "");
}

async function main() {
  const options = parseArgs();
  const [universities, units, sources] = await Promise.all([
    fs.readFile(universitiesPath, "utf8").then(JSON.parse),
    fs.readFile(unitsPath, "utf8").then(JSON.parse),
    fs.readFile(sourcesPath, "utf8").then(JSON.parse).catch(() => []),
  ]);
  let missingIds = null;

  if (options.missingOnly) {
    const coverage = await fs.readFile(unitCoveragePath, "utf8").then(JSON.parse).catch(() => ({ units: [] }));
    missingIds = new Set((coverage.units || []).filter((unit) => unit.status !== "covered").map((unit) => unit.id));
  }

  const selectedUnits = units
    .filter(realUnit)
    .filter((unit) => !options.school || unit.school === options.school)
    .filter((unit) => !options.department || unit.department === options.department)
    .filter((unit) => !missingIds || missingIds.has(unit.id))
    .slice(options.offset, options.offset + options.limit);
  const discovered = [];

  for (const [index, unit] of selectedUnits.entries()) {
    const university = universities.find((item) => item.name === unit.school);
    if (!university) {
      continue;
    }

    const source = await discoverSourceForUnit(unit, university, options);
    discovered.push(source);
    console.log(`${index + 1}/${selectedUnits.length} ${unit.school}${unit.department}: listUrls=${source.listUrls.length} host=${source.sourceHost || "n/a"}`);
  }

  const merged = mergeSources(sources, discovered);
  console.log(JSON.stringify({ selected: selectedUnits.length, discovered: discovered.length, before: sources.length, after: merged.length }, null, 2));

  if (!options.dryRun) {
    await fs.writeFile(sourcesPath, `${JSON.stringify(merged, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
