import fs from "node:fs/promises";

const root = new URL("../", import.meta.url);
const noticesPath = new URL("content/notices.json", root);

const noisyTitlePatterns = [
  /培养方案/,
  /推免工作实施细则/,
  /推荐工作实施办法/,
  /推荐工作安排/,
  /推荐工作\(一般类型/,
  /优秀营员.*名单/,
  /营员名单/,
  /复试成绩/,
  /复试结果/,
  /拟录取名单/,
  /结果公示/,
];

function isNoisy(notice) {
  const title = String(notice.title || "");
  const url = String(notice.sourceUrl || "");

  if (noisyTitlePatterns.some((pattern) => pattern.test(title))) {
    return true;
  }

  if (/\.pdf($|\?)/i.test(url) && !/(招生简章|报名通知|接收|工作办法|夏令营|研学营|预推免)/.test(title)) {
    return true;
  }

  return false;
}

async function main() {
  const notices = JSON.parse(await fs.readFile(noticesPath, "utf8"));
  const next = notices.filter((notice) => !isNoisy(notice));
  const removed = notices.length - next.length;
  console.log(JSON.stringify({ before: notices.length, removed, after: next.length }, null, 2));

  if (removed > 0) {
    await fs.writeFile(noticesPath, `${JSON.stringify(next, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
