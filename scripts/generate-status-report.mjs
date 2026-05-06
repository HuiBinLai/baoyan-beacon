import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);
const coveragePath = new URL("content/coverage-report.json", root);
const outDir = new URL("out/", root);
const localMemoryDir = new URL("local-memory/", root);
const reportPath = new URL("local-memory/baoyan-beacon-status-report.html", root);

const serverSnapshot = {
  cpu: "1 vCPU",
  memory: "951 MiB",
  disk: "23 GB total, about 13 GB free",
  webServer: "Nginx 1.18.0 on Ubuntu",
  deployPath: "/var/www/html/baoyan",
  publicUrl: "https://lhbski.top/baoyan/",
};

async function readJson(url, fallback) {
  try {
    return JSON.parse(await fs.readFile(url, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

async function fileSize(url) {
  try {
    const stat = await fs.stat(url);
    return stat.size;
  } catch {
    return 0;
  }
}

async function dirSize(dirUrl) {
  let total = 0;
  try {
    const entries = await fs.readdir(dirUrl, { withFileTypes: true });
    for (const entry of entries) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dirUrl);
      total += entry.isDirectory() ? await dirSize(child) : await fileSize(child);
    }
  } catch {
    return 0;
  }

  return total;
}

function formatBytes(bytes) {
  if (!bytes) {
    return "待生成";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function countBy(notices, field) {
  return notices.reduce((acc, notice) => {
    const value = notice[field] || "待确认";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(map, limit = 8) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, value]) => `${escapeHtml(name)}：${value}`)
    .join("、");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capacityText(outSize, noticeSize) {
  const dataMb = Math.max(outSize, noticeSize) / 1024 / 1024;
  if (!outSize) {
    return "当前还未生成静态导出目录，需以最终构建后的 out/ 体积估算。";
  }

  return [
    `当前是静态站点，服务器只负责 Nginx 静态文件分发，CPU 压力很小。`,
    `单次首次访问主要下载前端资源和索引数据，当前静态导出约 ${formatBytes(outSize)}，原始数据文件约 ${formatBytes(noticeSize)}。`,
    `在 1 核 1GB VPS 上，保守估计可以承受日常公益站访问和短时数百人同时浏览；如果出现上千并发或每天数万 PV，优先接入 CDN、压缩缓存和把搜索改成服务端分页。`,
    `真正瓶颈不是计算，而是带宽、首屏数据体积、以及未来如果加入数据库/API 后的查询压力。`,
  ].join(" ");
}

async function main() {
  await fs.mkdir(localMemoryDir, { recursive: true });
  const [notices, coverage, noticeSize, outSize] = await Promise.all([
    readJson(noticesPath, []),
    readJson(coveragePath, null),
    fileSize(noticesPath),
    dirSize(outDir),
  ]);
  const schools = new Set(notices.map((notice) => notice.school)).size;
  const departments = new Set(notices.map((notice) => `${notice.school}:${notice.department}`)).size;
  const llmStructured = notices.filter((notice) => notice.structuredStatus === "llm").length;
  const heuristicStructured = notices.filter((notice) => notice.structuredStatus?.startsWith("heuristic")).length;
  const degreeTypeCounts = notices.reduce((acc, notice) => {
    const values = notice.degreeTypes?.length ? notice.degreeTypes : ["待确认"];
    for (const value of values) {
      acc[value] = (acc[value] || 0) + 1;
    }
    return acc;
  }, {});
  const typeCounts = countBy(notices, "type");
  const generatedAt = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Shanghai",
  }).format(new Date());

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>保研灯塔项目现状说明</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif; color: #172033; background: #fffdf6; line-height: 1.72; }
    h1 { font-size: 30px; margin: 0 0 8px; letter-spacing: -0.04em; }
    h2 { font-size: 19px; margin: 24px 0 8px; color: #0f3557; }
    p { margin: 7px 0; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; background: white; }
    th, td { border: 1px solid #e7dfcf; padding: 8px 10px; vertical-align: top; }
    th { background: #fff0bf; text-align: left; color: #0f3557; }
    .hero { border: 1px solid #eadfcb; border-radius: 18px; padding: 18px; background: linear-gradient(135deg, #fff8dc, #edf7f5); }
    .muted { color: #687086; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
    .card { border: 1px solid #eadfcb; border-radius: 14px; padding: 12px; background: #fff; }
    .num { font-size: 24px; font-weight: 800; color: #9a4d1f; }
    .small { font-size: 12px; color: #687086; }
    .page-break { break-before: page; }
    code { background: #f5efe2; padding: 1px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>保研灯塔项目现状说明</h1>
    <p class="muted">生成时间：${escapeHtml(generatedAt)}</p>
    <p>保研灯塔是一个静态优先的开源公益网站，用来聚合高校推免、夏令营、预推免、直博等信息。当前版本采用 Next.js 静态导出、GitHub 版本管理、Nginx 静态部署，数据以 JSON 文件驱动页面展示。</p>
    <div class="grid">
      <div class="card"><div class="num">${notices.length}</div><div class="small">通知候选</div></div>
      <div class="card"><div class="num">${schools}</div><div class="small">覆盖院校</div></div>
      <div class="card"><div class="num">${departments}</div><div class="small">院校-学院组合</div></div>
      <div class="card"><div class="num">${llmStructured}</div><div class="small">LLM 结构化</div></div>
    </div>
  </section>

  <h2>网站目前怎么做</h2>
  <table>
    <tr><th>模块</th><th>实现方式</th></tr>
    <tr><td>前端页面</td><td>Next.js App Router + React + Tailwind CSS，静态导出后由 Nginx 托管在 <code>/baoyan/</code>。</td></tr>
    <tr><td>数据存储</td><td>当前主数据在 <code>content/notices.json</code>，覆盖率报告在 <code>content/coverage-report.json</code>。后续访问量或数据量上来后，可以迁移到 Supabase/Postgres。</td></tr>
    <tr><td>数据抓取</td><td>使用学校官网搜索、学院公告页补漏、公众号候选检索、用户投稿四类来源。每日任务会去重、结构化、分类并生成覆盖率报告。</td></tr>
    <tr><td>AI 结构化</td><td>本地使用智谱 GLM Flash 系列模型抽取学校、学院、专业、报名时间、截止时间、材料要求、培养类型等字段。新增数据可先入库，之后再异步结构化。</td></tr>
    <tr><td>后台</td><td>当前是静态管理页，由 Nginx Basic Auth 保护，用于查看覆盖率和复核原文。下一阶段可接数据库管理 API。</td></tr>
  </table>

  <h2>三台/三端分别做什么</h2>
  <table>
    <tr><th>设备/平台</th><th>作用</th><th>关键点</th></tr>
    <tr><td>你的 Mac 本地</td><td>开发、测试、密钥保存、批量抓取、AI 结构化、生成报告。</td><td><code>.env.local</code> 和 <code>local-memory/</code> 只保存在本地，不上传 GitHub。</td></tr>
    <tr><td>GitHub</td><td>代码仓库、版本同步、开源协作、每日 Actions 自动抓取。</td><td>只放代码、公开数据和自动化脚本，不放服务器密码、API key、管理员密码。</td></tr>
    <tr><td>云服务器</td><td>线上发布和 HTTPS 访问。</td><td>Nginx 托管静态文件，路径是 <code>${escapeHtml(serverSnapshot.deployPath)}</code>，访问地址是 <code>${escapeHtml(serverSnapshot.publicUrl)}</code>。</td></tr>
  </table>

  <h2>当前数据状态</h2>
  <table>
    <tr><th>指标</th><th>当前值</th></tr>
    <tr><td>通知总数</td><td>${notices.length}</td></tr>
    <tr><td>覆盖院校数</td><td>${schools}</td></tr>
    <tr><td>LLM 结构化</td><td>${llmStructured}</td></tr>
    <tr><td>规则结构化</td><td>${heuristicStructured}</td></tr>
    <tr><td>通知类型 Top</td><td>${topEntries(typeCounts)}</td></tr>
    <tr><td>培养类型</td><td>${topEntries(degreeTypeCounts)}</td></tr>
  </table>

  <h2>访问承载能力</h2>
  <p>${capacityText(outSize, noticeSize)}</p>
  <table>
    <tr><th>服务器项</th><th>当前值</th></tr>
    <tr><td>CPU</td><td>${escapeHtml(serverSnapshot.cpu)}</td></tr>
    <tr><td>内存</td><td>${escapeHtml(serverSnapshot.memory)}</td></tr>
    <tr><td>磁盘</td><td>${escapeHtml(serverSnapshot.disk)}</td></tr>
    <tr><td>Web Server</td><td>${escapeHtml(serverSnapshot.webServer)}</td></tr>
    <tr><td>静态导出目录大小</td><td>${formatBytes(outSize)}</td></tr>
    <tr><td>主数据文件大小</td><td>${formatBytes(noticeSize)}</td></tr>
  </table>

  <h2>接下来怎么扩容</h2>
  <table>
    <tr><th>阶段</th><th>建议</th></tr>
    <tr><td>日常公益访问</td><td>继续静态部署即可，Nginx + 静态页面足够轻。</td></tr>
    <tr><td>数据到 1 万条以上</td><td>把 JSON 改为数据库和分页 API，前端只加载当前搜索结果。</td></tr>
    <tr><td>访问量明显上升</td><td>接入 CDN、开启 gzip/brotli、给静态资源设置长缓存。</td></tr>
    <tr><td>多人维护</td><td>接 Supabase/Postgres 后台，支持审核流、来源管理、变更历史和权限分级。</td></tr>
  </table>

  ${coverage ? `<h2 class="page-break">覆盖率审计摘要</h2><p>覆盖率报告生成时间：${escapeHtml(coverage.generatedAt || "未知")}。行动项数量：${coverage.actionItems?.length || 0}。</p>` : ""}
</body>
</html>`;

  await fs.writeFile(reportPath, html);
  console.log(path.resolve(fileURLToPath(reportPath)));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
