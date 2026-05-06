import crypto from "node:crypto";
import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const sourcesPath = new URL("content/sources.json", root);
const keywords = ["推免", "推荐免试", "免试", "保研", "夏令营", "预推免", "直博"];
const formalWords = ["通知", "办法", "简章", "公告", "安排", "实施", "招生", "接收", "选拔"];

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
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

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(decodeHtml(href), baseUrl).toString();
  } catch {
    return "";
  }
}

function extractCandidates(html, source) {
  const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = [];
  let match;

  while ((match = linkPattern.exec(html))) {
    const title = stripTags(decodeHtml(match[2]));
    const href = normalizeUrl(match[1], source.url);

    if (!title || !href) {
      continue;
    }

    if (!keywords.some((keyword) => title.includes(keyword))) {
      continue;
    }

    if (title.length < 10 || !formalWords.some((word) => title.includes(word))) {
      continue;
    }

    candidates.push({
      id: `auto-${idFor(href, title)}`,
      title,
      school: source.school,
      department: "待结构化",
      majors: ["待确认"],
      type: inferType(title),
      year: new Date().getFullYear(),
      region: source.region,
      deadline: "",
      publishedAt: new Date().toISOString().slice(0, 10),
      sourceName: source.name,
      sourceUrl: href,
      summary: "每日抓取脚本自动发现的候选通知，发布前建议由维护者核验学院、专业、报名截止日期等字段。",
      tags: ["自动抓取", source.school],
      confidence: "auto",
    });
  }

  return candidates;
}

async function main() {
  const [noticesRaw, sourcesRaw] = await Promise.all([
    fs.readFile(noticesPath, "utf8"),
    fs.readFile(sourcesPath, "utf8"),
  ]);

  const notices = JSON.parse(noticesRaw);
  const sources = JSON.parse(sourcesRaw);
  const known = new Set(notices.map((notice) => `${notice.sourceUrl}:${notice.title}`));
  const additions = [];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          "user-agent": "baoyan-beacon/0.1 (+https://github.com/HuiBinLai/baoyan-beacon)",
        },
      });

      if (!response.ok) {
        console.warn(`skip ${source.name}: HTTP ${response.status}`);
        continue;
      }

      const html = await response.text();
      const candidates = extractCandidates(html, source);

      for (const candidate of candidates) {
        const key = `${candidate.sourceUrl}:${candidate.title}`;
        if (!known.has(key)) {
          known.add(key);
          additions.push(candidate);
        }
      }
    } catch (error) {
      console.warn(`skip ${source.name}: ${error.message}`);
    }
  }

  if (additions.length === 0) {
    console.log("No new notice candidates.");
    return;
  }

  if (process.env.DRY_RUN === "1") {
    console.log(`Dry run found ${additions.length} notice candidates.`);
    return;
  }

  const next = [...additions, ...notices];
  await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Added ${additions.length} notice candidates.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
