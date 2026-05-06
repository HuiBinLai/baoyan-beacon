"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import notices from "../../content/notices.json";

type Notice = {
  id: string;
  title: string;
  school: string;
  department: string;
  majors: string[];
  type: string;
  year: number;
  region: string;
  deadline: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
  summary: string;
  tags: string[];
  confidence: "auto" | "verified";
  applicationStart?: string;
  applicationEnd?: string;
  registrationTime?: string;
  requirements?: string[];
  materials?: string[];
  applicationMethod?: string;
  targetStudents?: string;
  structuredStatus?: string;
  degreeTypes?: string[];
  noticeStage?: string;
};

const typedNotices = notices as Notice[];

const noticeTypes = ["全部阶段", ...Array.from(new Set(typedNotices.map((notice) => notice.noticeStage || notice.type)))];
const schools = ["全部院校", ...Array.from(new Set(typedNotices.map((notice) => notice.school)))];
const majors = ["全部专业", ...Array.from(new Set(typedNotices.flatMap((notice) => notice.majors)))];
const degreeTypes = ["全部培养类型", ...Array.from(new Set(typedNotices.flatMap((notice) => notice.degreeTypes || [])))];
const allYearsLabel = "全部招生年份";
const recentYearsLabel = "最近五年";
const currentSeasonAdmissionYear = new Date().getFullYear() + 1;
const currentSeasonLabel = `当前季 ${currentSeasonAdmissionYear} 招生`;
const yearValues = Array.from(new Set(typedNotices.map((notice) => notice.year))).sort((a, b) => b - a);
const latestAdmissionYear = Math.max(...yearValues);
const recentYearValues = yearValues.filter((item) => item <= latestAdmissionYear && item >= latestAdmissionYear - 4);
const yearCounts = yearValues.map((item) => ({
  year: item,
  count: typedNotices.filter((notice) => notice.year === item).length,
}));
const years = [recentYearsLabel, allYearsLabel, ...yearValues.map(String)];
const resultLimit = 120;
const currentSeasonCount = typedNotices.filter((notice) => notice.year === currentSeasonAdmissionYear).length;

function formatDate(date: string) {
  if (!date) {
    return "待确认";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

function isClosingSoon(deadline: string) {
  if (!deadline) {
    return false;
  }

  const remaining = new Date(deadline).getTime() - Date.now();
  return remaining > 0 && remaining < 1000 * 60 * 60 * 24 * 14;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("全部院校");
  const [major, setMajor] = useState("全部专业");
  const [degreeType, setDegreeType] = useState("全部培养类型");
  const [type, setType] = useState("全部");
  const [year, setYear] = useState(recentYearsLabel);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredNotices = typedNotices.filter((notice) => {
    const haystack = [
      notice.title,
      notice.school,
      notice.department,
      notice.region,
      notice.type,
      notice.noticeStage,
      notice.summary,
      ...notice.majors,
      ...(notice.degreeTypes || []),
      ...notice.tags,
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = deferredQuery ? haystack.includes(deferredQuery) : true;
    const matchesSchool = school === "全部院校" || notice.school === school;
    const matchesMajor = major === "全部专业" || notice.majors.includes(major);
    const matchesDegreeType = degreeType === "全部培养类型" || notice.degreeTypes?.includes(degreeType);
    const matchesType = type === "全部阶段" || (notice.noticeStage || notice.type) === type;
    const matchesYear =
      year === allYearsLabel ||
      (year === currentSeasonLabel && notice.year === currentSeasonAdmissionYear) ||
      (year === recentYearsLabel && recentYearValues.includes(notice.year)) ||
      String(notice.year) === year;

    return matchesQuery && matchesSchool && matchesMajor && matchesDegreeType && matchesType && matchesYear;
  });

  const visibleNotices = filteredNotices.slice(0, resultLimit);

  const verifiedCount = typedNotices.filter((notice) => notice.confidence === "verified").length;
  const structuredCount = typedNotices.filter((notice) => notice.structuredStatus).length;

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <section className="relative px-5 pb-12 pt-8 sm:px-8 lg:px-12">
        <div className="beacon-glow" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/60 bg-white/70 px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--navy)] text-lg text-[var(--beam)]">
              灯
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.24em] text-[var(--muted)]">
                BAOYAN BEACON
              </span>
              <span className="block text-xl font-black">保研灯塔</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] md:flex">
            <a href="#notices" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">
              信息索引
            </a>
            <Link href="/submit" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">
              投稿共建
            </Link>
            <a href="#guardrails" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">
              风险边界
            </a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-10 pb-8 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-rise">
            <p className="mb-5 inline-flex rounded-full border border-[var(--beam)]/60 bg-[var(--beam-soft)] px-4 py-2 text-sm font-bold text-[var(--navy)]">
              开源的推免信息索引与经验资料库
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.06em] text-[var(--navy)] sm:text-7xl">
              把分散在官网和公众号里的保研信息，照亮成一张地图。
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-[var(--muted)]">
              每日聚合高校推免、夏令营、预推免通知，沉淀往年面经和门槛参考。
              第一版采用 GitHub 共建和外部讨论机制，先快跑上线，再逐步增强自动化。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#notices"
                className="rounded-full bg-[var(--navy)] px-7 py-4 text-center text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5"
              >
                搜索最新信息
              </a>
              <Link
                href="/submit"
                className="rounded-full border border-[var(--navy)]/15 bg-white px-7 py-4 text-center text-sm font-black text-[var(--navy)] transition hover:-translate-y-0.5 hover:border-[var(--navy)]/40"
              >
                提交公众号/官网链接
              </Link>
            </div>
          </div>

          <div className="animate-float rounded-[2rem] border border-white/70 bg-white/75 p-5 shadow-[0_30px_80px_rgba(12,28,51,0.16)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-[var(--navy)] p-6 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white/55">今日索引状态</p>
                  <h2 className="mt-2 text-3xl font-black">MVP 数据管线</h2>
                </div>
                <span className="rounded-full bg-[var(--beam)] px-3 py-1 text-xs font-black text-[var(--navy)]">
                  Day 1
                </span>
              </div>
              <div className="mt-8 grid gap-3">
                {[
                  ["官网抓取", "GitHub Actions 每日定时执行"],
                  ["公众号", "用户提交链接，AI/规则抽取"],
                  ["讨论区", "外部 GitHub Discussions/微信群"],
                  ["交易", "仅展示外链和联系方式，不做支付"],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
                    <div className="text-base font-black">{title}</div>
                    <div className="mt-1 text-sm leading-6 text-white/62">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="notices" className="relative z-10 px-5 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-black tracking-[0.24em] text-[var(--rust)]">SEARCH</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--navy)]">
                快速定位院校和专业
              </h2>
              <p className="mt-4 max-w-xl leading-8 text-[var(--muted)]">
                当前默认展示最近五年历史库；按今天的推免节奏，接下来重点监控的是 {currentSeasonAdmissionYear} 招生季。
                接入数据库后，这套筛选字段会直接映射到搜索索引和后台审核流。
              </p>
            </div>
            <div className="grid gap-3 rounded-[2rem] border border-[var(--line)] bg-white/85 p-4 shadow-[0_24px_60px_rgba(12,28,51,0.08)]">
              <input
                aria-label="搜索通知"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索：清华 计算机 夏令营 / 0854 预推免 / 直博"
                className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 text-base font-semibold outline-none transition focus:border-[var(--sea)] focus:bg-white"
              />
              <div className="grid gap-3 md:grid-cols-5">
                <select
                  aria-label="院校筛选"
                  value={school}
                  onChange={(event) => setSchool(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
                >
                  {schools.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  aria-label="专业筛选"
                  value={major}
                  onChange={(event) => setMajor(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
                >
                  {majors.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  aria-label="培养类型筛选"
                  value={degreeType}
                  onChange={(event) => setDegreeType(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
                >
                  {degreeTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  aria-label="阶段筛选"
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
                >
                  {noticeTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
                <select
                  aria-label="年份筛选"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
                >
                  {years.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StatCard label="已索引信息" value={String(typedNotices.length)} detail="通知、面经、门槛参考统一建模" />
            <StatCard label="已结构化" value={String(structuredCount)} detail="报名时间、要求、材料等字段已抽取" />
            <StatCard label="已核验" value={String(verifiedCount)} detail="人工确认来源和时间后标记" />
          </div>

          <div className="mt-5 rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm font-black tracking-[0.22em] text-[var(--rust)]">ADMISSION YEAR</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--navy)]">按招生年份分类</h3>
              </div>
              <p className="max-w-2xl text-sm font-semibold leading-7 text-[var(--muted)]">
                这里的 2026 指“2026 级/2026 年接收推免生”，很多通知实际会在 2025 年发布和报名；发布时间会在卡片右侧单独展示。
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <YearButton active={year === currentSeasonLabel} label={currentSeasonLabel} count={currentSeasonCount} onClick={() => setYear(currentSeasonLabel)} />
              <YearButton active={year === recentYearsLabel} label={recentYearsLabel} count={recentYearValues.reduce((sum, item) => sum + (yearCounts.find((entry) => entry.year === item)?.count || 0), 0)} onClick={() => setYear(recentYearsLabel)} />
              <YearButton active={year === allYearsLabel} label={allYearsLabel} count={typedNotices.length} onClick={() => setYear(allYearsLabel)} />
              {yearCounts.map((item) => (
                <YearButton
                  key={item.year}
                  active={year === String(item.year)}
                  label={`${item.year} 招生`}
                  count={item.count}
                  onClick={() => setYear(String(item.year))}
                />
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-2 rounded-[1.5rem] border border-[var(--line)] bg-white/70 p-4 text-sm font-bold text-[var(--muted)] md:flex-row md:items-center md:justify-between">
            <span>
              找到 <span className="text-[var(--navy)]">{filteredNotices.length}</span> 条结果
              {filteredNotices.length > resultLimit ? `，当前先展示前 ${resultLimit} 条` : ""}
            </span>
            <span>建议输入“院校 + 学院/专业 + 招生年份”，例如：中国人民大学 法学院 2026</span>
          </div>

          <div className="mt-5 grid gap-4">
            {visibleNotices.map((notice) => (
              <article
                key={notice.id}
                className="group rounded-[2rem] border border-[var(--line)] bg-white/90 p-5 shadow-[0_18px_45px_rgba(12,28,51,0.06)] transition hover:-translate-y-1 hover:border-[var(--sea)]/30 hover:shadow-[0_28px_70px_rgba(12,28,51,0.12)]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--mist)] px-3 py-1 text-xs font-black text-[var(--sea)]">
                        {notice.noticeStage || notice.type}
                      </span>
                      {displayDegreeTypes(notice.degreeTypes).map((item) => (
                        <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--navy)] ring-1 ring-[var(--line)]">
                          {item}
                        </span>
                      ))}
                      <span className="rounded-full bg-[var(--beam-soft)] px-3 py-1 text-xs font-black text-[var(--rust)]">
                        {notice.confidence === "verified" ? "已核验" : notice.structuredStatus?.startsWith("heuristic") ? "规则结构化" : "待复核"}
                      </span>
                      {isClosingSoon(notice.applicationEnd || notice.deadline) ? (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-600">
                          即将截止
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] text-[var(--navy)]">
                      {notice.title}
                    </h3>
                    <p className="mt-2 text-base font-semibold text-[var(--muted)]">
                      {notice.school} · {notice.department}
                    </p>
                    <p className="mt-3 max-w-4xl leading-8 text-[var(--muted)]">{notice.summary}</p>
                    <div className="mt-4 grid gap-3 rounded-3xl bg-[var(--paper)] p-4 text-sm font-semibold text-[var(--muted)] md:grid-cols-2">
                      <InfoLine label="报名时间" value={notice.registrationTime || dateRange(notice.applicationStart, notice.applicationEnd)} />
                      <InfoLine label="报名方式" value={notice.applicationMethod} />
                      <InfoLine label="面向对象" value={notice.targetStudents} />
                      <InfoLine label="招生年份" value={`${notice.year} 招生`} />
                      <InfoLine label="培养类型" value={displayDegreeTypes(notice.degreeTypes).join(" / ")} />
                      <InfoLine label="结构化状态" value={notice.structuredStatus ? statusText(notice.structuredStatus) : "待结构化"} />
                    </div>
                    <KeyList title="申请条件" items={notice.requirements} />
                    <KeyList title="材料要求" items={notice.materials} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {notice.majors.map((item) => (
                        <span key={item} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid shrink-0 gap-3 rounded-3xl bg-[var(--paper)] p-4 text-sm font-bold text-[var(--muted)] lg:w-60">
                    <div className="flex items-center justify-between gap-4">
                      <span>发布时间/索引</span>
                      <span className="text-[var(--navy)]">{formatDate(notice.publishedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>招生年份</span>
                      <span className="text-[var(--sea)]">{notice.year}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span>截止日期</span>
                      <span className="text-[var(--rust)]">{formatDate(notice.applicationEnd || notice.deadline)}</span>
                    </div>
                    <a
                      href={notice.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 rounded-full bg-white px-4 py-3 text-center text-[var(--navy)] ring-1 ring-[var(--line)] transition group-hover:bg-[var(--navy)] group-hover:text-white"
                    >
                      查看原文
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {filteredNotices.length === 0 ? (
            <div className="mt-8 rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 p-10 text-center">
              <h3 className="text-2xl font-black text-[var(--navy)]">暂时没有匹配结果</h3>
              <p className="mt-3 text-[var(--muted)]">换一个关键词试试，或提交你看到的官网/公众号链接。</p>
            </div>
          ) : null}
        </div>
      </section>

      <section id="guardrails" className="px-5 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          <GuardrailCard
            title="公众号收集"
            desc="不批量搬运全文。优先保存标题、摘要、结构化字段和原文链接，公众号内容通过用户投稿链接进入审核队列。"
          />
          <GuardrailCard
            title="讨论区外部化"
            desc="站内不做自由评论。问题沉淀为 FAQ，实时讨论跳转 GitHub Discussions、微信群或飞书群，降低个人运营风险。"
          />
          <GuardrailCard
            title="交易轻入口"
            desc="第一版只允许外部链接和联系方式展示，不做支付、担保、聊天和评价，保留举报与过期下架机制。"
          />
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-white/80 p-5">
      <p className="text-sm font-black tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--navy)]">{value}</div>
      <p className="mt-2 leading-7 text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-xs font-black tracking-[0.18em] text-[var(--rust)]">{label}</span>
      <p className="mt-1 line-clamp-2 leading-6 text-[var(--navy)]">{value || "待确认"}</p>
    </div>
  );
}

function YearButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-black transition ${
        active
          ? "bg-[var(--navy)] text-white shadow-[0_12px_30px_rgba(12,28,51,0.18)]"
          : "bg-[var(--paper)] text-[var(--muted)] ring-1 ring-[var(--line)] hover:bg-white hover:text-[var(--navy)]"
      }`}
    >
      {label}
      <span className={active ? "ml-2 text-[var(--beam)]" : "ml-2 text-[var(--rust)]"}>{count}</span>
    </button>
  );
}

function KeyList({ title, items }: { title: string; items?: string[] }) {
  const visibleItems = (items || []).filter(Boolean).slice(0, 3);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-3xl border border-[var(--line)] bg-white/70 p-4">
      <h4 className="text-sm font-black tracking-[0.18em] text-[var(--rust)]">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
        {visibleItems.map((item) => (
          <li key={item} className="line-clamp-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function displayDegreeTypes(items?: string[]) {
  const visibleItems = (items || []).filter((item) => item && item !== "待确认").slice(0, 3);
  return visibleItems.length > 0 ? visibleItems : ["待确认"];
}

function dateRange(start?: string, end?: string) {
  if (start && end) {
    return `${formatDate(start)} 至 ${formatDate(end)}`;
  }

  if (end) {
    return `截止 ${formatDate(end)}`;
  }

  return "";
}

function statusText(status: string) {
  if (status === "llm") {
    return "LLM 结构化";
  }

  if (status === "heuristic_page") {
    return "规则抽取，已读取原文";
  }

  if (status === "heuristic_title") {
    return "规则抽取，仅标题/摘要";
  }

  return status;
}

function GuardrailCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--navy)] p-6 text-white shadow-[0_24px_60px_rgba(12,28,51,0.14)]">
      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-4 leading-8 text-white/68">{desc}</p>
    </div>
  );
}
