import fs from "node:fs/promises";
import { TextDecoder } from "node:util";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const today = new Date().toISOString().slice(0, 10);

const majorHints = [
  "哲学",
  "理论经济学",
  "应用经济学",
  "金融",
  "法学",
  "法律",
  "政治学",
  "社会学",
  "马克思主义理论",
  "教育学",
  "心理学",
  "中国语言文学",
  "外国语言文学",
  "新闻传播学",
  "历史学",
  "数学",
  "物理学",
  "化学",
  "生物学",
  "统计学",
  "机械工程",
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
  "环境科学与工程",
  "生物医学工程",
  "食品科学与工程",
  "基础医学",
  "临床医学",
  "公共卫生",
  "药学",
  "护理学",
  "管理科学与工程",
  "工商管理",
  "公共管理",
  "会计",
  "艺术学",
  "设计学",
  "电子信息",
  "材料与化工",
  "资源与环境",
  "生物与医药",
  "翻译",
  "新闻与传播",
];

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    concurrency: 6,
    fetchPages: true,
    limit: Infinity,
    llm: false,
    llmRetries: 3,
    llmRetryBaseMs: 1200,
    onlyUnstructured: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--concurrency") {
      options.concurrency = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--limit") {
      options.limit = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--no-fetch") {
      options.fetchPages = false;
    } else if (arg === "--llm") {
      options.llm = true;
    } else if (arg === "--llm-retries") {
      options.llmRetries = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--llm-retry-base-ms") {
      options.llmRetryBaseMs = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--only-unstructured") {
      options.onlyUnstructured = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  return options;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadLocalEnv() {
  const envFiles = [new URL(".env.local", root), new URL(".env", root)];

  for (const envFile of envFiles) {
    let text = "";
    try {
      text = await fs.readFile(envFile, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
      continue;
    }

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] !== undefined) {
        continue;
      }

      let value = match[2].trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      process.env[match[1]] = value.replace(/\\n/g, "\n");
    }
  }
}

function cleanText(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  return text
    .split(/[。；;！!？?\n\r]/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 8 && sentence.length <= 260);
}

function detectCharset(contentType, bytes) {
  const headerMatch = contentType?.match(/charset=([^;\s]+)/i);
  if (headerMatch) {
    return headerMatch[1].toLowerCase();
  }

  const ascii = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, 2000));
  const metaMatch = ascii.match(/charset=["']?([^"'\s/>]+)/i);
  return metaMatch ? metaMatch[1].toLowerCase() : "utf-8";
}

function decodeBytes(bytes, contentType) {
  const charset = detectCharset(contentType, bytes);
  const candidates = [charset, "utf-8", "gb18030", "gbk"];

  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate).decode(bytes);
    } catch {
      // Try next decoder.
    }
  }

  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(url, {
      headers: {
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.6",
        "user-agent": "Mozilla/5.0 baoyan-beacon-structurer/0.1",
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
    return cleanText(decodeBytes(bytes, contentType));
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function normalizeDate(raw, fallbackYear) {
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, "");
  const text = compact.replace(/[年月.\/]/g, "-").replace(/[日号]/g, "");
  const full = text.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  }

  const monthDay = text.match(/(^|[^\d])(\d{1,2})-(\d{1,2})(?!\d)/);
  if (monthDay && fallbackYear) {
    return `${fallbackYear}-${monthDay[2].padStart(2, "0")}-${monthDay[3].padStart(2, "0")}`;
  }

  return "";
}

function extractDates(text, year) {
  const datePattern = /20\s*\d\s*\d\s*[年./-]\s*\d{1,2}\s*[月./-]\s*\d{1,2}\s*[日号]?|\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/g;
  const sentences = splitSentences(text);
  const registrationSentences = sentences.filter((sentence) => /报名|申请|提交|截止|系统|材料|确认/.test(sentence));
  const allDateHits = [];

  for (const sentence of registrationSentences.slice(0, 80)) {
    const sentenceYear = Number(sentence.replace(/\s+/g, "").match(/20\d{2}/)?.[0]) || year;
    const dates = Array.from(sentence.matchAll(datePattern))
      .map((match) => normalizeDate(match[0], sentenceYear))
      .filter(Boolean);

    if (dates.length > 0) {
      allDateHits.push({ sentence, dates });
    }
  }

  const endHit = allDateHits.find((hit) => /截止|之前|前完成|逾期|止/.test(hit.sentence));
  const rangeHit = allDateHits.find((hit) => /自|从|即日起|开始|起|至|到/.test(hit.sentence) && hit.dates.length >= 2);
  const genericRangeHit = allDateHits.find((hit) => hit.dates.length >= 2);
  const firstHit = allDateHits[0];

  return {
    applicationStart: rangeHit?.dates[0] || genericRangeHit?.dates[0] || "",
    applicationEnd: endHit?.dates.at(-1) || rangeHit?.dates.at(-1) || genericRangeHit?.dates.at(-1) || "",
    registrationTimeText: endHit?.sentence || rangeHit?.sentence || genericRangeHit?.sentence || firstHit?.sentence || "",
  };
}

function pickSentences(text, pattern, limit = 4) {
  return splitSentences(text)
    .filter((sentence) => pattern.test(sentence))
    .slice(0, limit);
}

function inferDepartment(title, fallback) {
  if (fallback && fallback !== "待结构化") {
    return fallback;
  }

  const match = title.match(/([\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,28}(学院|学部|研究院|书院|中心|系|所))/);
  return match ? match[1].replace(/^.*大学/, "") : "待结构化";
}

function inferMajors(title, text, existing) {
  const source = `${title} ${text.slice(0, 2000)}`;
  const majors = majorHints.filter((major) => source.includes(major));
  const merged = [...(existing || []), ...majors].filter((major) => major && major !== "待确认");
  return Array.from(new Set(merged)).slice(0, 6);
}

function inferDegreeTypes(title, text, type) {
  const compact = `${title} ${text}`.replace(/博士后/g, "").replace(/\s+/g, "");
  const degreeTypes = [];

  if (/直接攻读博士|直博|本科直博|本博贯通|硕博连读/.test(compact) || type === "直博") {
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

  return Array.from(new Set(degreeTypes));
}

function heuristicExtract(notice, pageText) {
  const text = `${notice.title}。${notice.summary || ""}。${pageText || ""}`.slice(0, 18000);
  const dates = extractDates(text, notice.year);
  const requirements = pickSentences(text, /申请条件|报名条件|基本条件|资格|要求|成绩|排名|英语|六级|四级|科研|论文|推免资格|应届本科/, 5);
  const materials = pickSentences(text, /材料|申请表|成绩单|简历|推荐信|证明|获奖|身份证|学生证|承诺书/, 5);
  const applicationMethods = pickSentences(text, /报名系统|申请系统|网上报名|报名网址|登录|邮箱|发送|提交|系统填报/, 3);
  const targetStudents = pickSentences(text, /优秀应届本科|本科三年级|202\d届|应届毕业生|获得推免资格|有望获得推免资格/, 2);
  const majors = inferMajors(notice.title, pageText, notice.majors);

  return {
    department: inferDepartment(notice.title, notice.department),
    majors: majors.length > 0 ? majors : ["待确认"],
    applicationStart: dates.applicationStart,
    applicationEnd: dates.applicationEnd || notice.deadline || "",
    deadline: dates.applicationEnd || notice.deadline || "",
    registrationTime: dates.registrationTimeText,
    requirements,
    materials,
    applicationMethod: applicationMethods[0] || "",
    targetStudents: targetStudents[0] || "",
    degreeTypes: inferDegreeTypes(notice.title, text, notice.type),
    structuredStatus: pageText ? "heuristic_page" : "heuristic_title",
    structuredAt: today,
    sourceExcerpt: text.slice(0, 500),
  };
}

function getLlmConfig() {
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const zhipuApiKey = process.env.ZHIPUAI_API_KEY || process.env.ZAI_API_KEY;
  const isZhipu = provider === "zhipu" || Boolean(zhipuApiKey);
  const apiKey = process.env.LLM_API_KEY || zhipuApiKey || process.env.OPENAI_API_KEY;
  const baseUrl =
    process.env.LLM_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    (isZhipu ? "https://open.bigmodel.cn/api/paas/v4" : "https://api.openai.com/v1");
  const model = process.env.LLM_MODEL || (isZhipu ? "glm-4-flash-250414" : "gpt-4.1-mini");
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 60000);
  return { apiKey, baseUrl, model, timeoutMs };
}

function parseJsonContent(content) {
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const jsonText = stripped.match(/\{[\s\S]*\}/)?.[0] || stripped;
  return JSON.parse(jsonText);
}

async function llmExtract(notice, pageText, options) {
  const { apiKey, baseUrl, model, timeoutMs } = getLlmConfig();
  if (!apiKey) {
    return null;
  }

  const prompt = [
    "你是研究生推免招生信息结构化助手。只从给定文本抽取事实，不要猜测。",
    "返回严格 JSON，字段：department, majors, degreeTypes, applicationStart, applicationEnd, registrationTime, requirements, materials, applicationMethod, targetStudents, summary。",
    "degreeTypes 只能从这些值中选：学术型硕士、专业型硕士、直博、博士、硕士、待确认。可多选。",
    "日期用 YYYY-MM-DD；未知填空字符串；requirements/materials 是字符串数组。",
    "",
    `标题：${notice.title}`,
    `院校：${notice.school}`,
    `年份：${notice.year}`,
    `当前学院：${notice.department}`,
    `原文链接：${notice.sourceUrl}`,
    "",
    `文本：${`${notice.summary || ""}\n${pageText}`.slice(0, 12000)}`,
  ].join("\n");

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: "你只输出 JSON，不输出 Markdown。" },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 1600,
  });

  let lastError = null;
  for (let attempt = 0; attempt <= options.llmRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 220).replace(/\s+/g, " ");
        const retryable = response.status === 429 || response.status >= 500;
        const error = new Error(`LLM request failed: ${response.status} ${detail}`);
        error.retryable = retryable;
        throw error;
      }

      const payload = await response.json();
      const content = payload.choices?.[0]?.message?.content || "";
      return parseJsonContent(content);
    } catch (error) {
      if (error.name === "AbortError") {
        error.retryable = true;
      }
      lastError = error;
      if (!error.retryable || attempt >= options.llmRetries) {
        break;
      }

      const backoff = options.llmRetryBaseMs * 2 ** attempt + Math.floor(Math.random() * 500);
      await sleep(backoff);
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

async function enrichNotice(notice, options) {
  const pageText = options.fetchPages ? await fetchText(notice.sourceUrl) : "";
  const heuristic = heuristicExtract(notice, pageText);

  if (options.llm) {
    try {
      const llm = await llmExtract(notice, pageText, options);
      if (llm) {
        return {
          ...notice,
          ...heuristic,
          ...llm,
          deadline: llm.applicationEnd || heuristic.deadline,
          structuredStatus: "llm",
          structuredAt: today,
        };
      }
    } catch (error) {
      console.warn(`LLM fallback for ${notice.id}: ${error.message}`);
    }
  }

  return {
    ...notice,
    ...heuristic,
  };
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
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

  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

async function main() {
  await loadLocalEnv();
  const options = parseArgs();
  const raw = await fs.readFile(noticesPath, "utf8");
  const notices = JSON.parse(raw)
    .filter((notice) => notice.confidence !== "demo" && !notice.id?.startsWith("demo") && !notice.title?.includes("示例占位"));

  const indexed = notices.map((notice, index) => ({ notice, index }));
  const selectedIndexes = new Set(
    (options.onlyUnstructured ? indexed.filter(({ notice }) => !notice.structuredStatus) : indexed.slice(0, options.limit))
      .map(({ index }) => index),
  );
  const selected = notices.filter((_, index) => selectedIndexes.has(index));
  const untouched = notices.filter((_, index) => !selectedIndexes.has(index));
  console.log(`structuring ${selected.length} notices, untouched ${untouched.length}, llm=${options.llm}`);

  const structured = await runPool(selected, options.concurrency, async (notice, index) => {
    if ((index + 1) % 50 === 0) {
      console.log(`structured ${index + 1}/${selected.length}`);
    }

    return enrichNotice(notice, options);
  });

  const next = [...structured, ...untouched];
  if (options.dryRun) {
    console.log(JSON.stringify(next.slice(0, 3), null, 2));
    return;
  }

  await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`wrote ${next.length} notices`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
