"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import notices from "../../../content/notices.json";
import universities from "../../../content/universities-985.json";
import unitCoverage from "../../../content/graduate-unit-coverage.json";

type Notice = {
  id: string;
  title: string;
  school: string;
  department: string;
  majors: string[];
  type: string;
  year: number;
  sourceUrl: string;
  confidence: "demo" | "auto" | "verified";
};

type University = {
  name: string;
  priority: number;
};

type UnitCoverageItem = {
  id: string;
  school: string;
  department: string;
  total: number;
  recentFiveYears: number;
  currentSeason: number;
  years: number[];
  status: "covered" | "stale" | "missing";
};

type UnitCoverageReport = {
  totals: {
    units: number;
    covered: number;
    stale: number;
    missing: number;
    currentSeasonCovered: number;
  };
  units: UnitCoverageItem[];
};

const typedNotices = notices as Notice[];
const typedUniversities = universities as University[];
const typedUnitCoverage = unitCoverage as UnitCoverageReport;

export default function AdminPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("auto");
  const [coverageSchool, setCoverageSchool] = useState("中国人民大学");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const universityCoverage = typedUniversities.map((university) => {
    const items = typedNotices.filter((notice) => notice.school === university.name);
    return {
      ...university,
      count: items.length,
      latestYear: items.reduce((max, notice) => Math.max(max, notice.year), 0),
    };
  });

  const filtered = typedNotices.filter((notice) => {
    const haystack = [notice.title, notice.school, notice.department, notice.type, String(notice.year), ...notice.majors]
      .join(" ")
      .toLowerCase();
    const matchesQuery = deferredQuery ? haystack.includes(deferredQuery) : true;
    const matchesStatus = status === "all" || notice.confidence === status;
    return matchesQuery && matchesStatus;
  });

  const autoCount = typedNotices.filter((notice) => notice.confidence === "auto").length;
  const verifiedCount = typedNotices.filter((notice) => notice.confidence === "verified").length;
  const rucCount = typedNotices.filter((notice) => notice.school === "中国人民大学").length;
  const selectedUnitItems = typedUnitCoverage.units.filter((item) => item.school === coverageSchool);
  const schoolUnitOptions = Array.from(new Set(typedUnitCoverage.units.map((item) => item.school)));
  const schoolUnitSummary = schoolUnitOptions.map((schoolName) => {
    const items = typedUnitCoverage.units.filter((item) => item.school === schoolName);
    return {
      school: schoolName,
      covered: items.filter((item) => item.status === "covered").length,
      total: items.length,
    };
  });

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <nav className="mb-8 flex flex-col gap-3 rounded-[2rem] border border-[var(--line)] bg-white/85 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black tracking-[0.24em] text-[var(--rust)]">ADMIN</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-[var(--navy)]">保研灯塔后台</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold">
              返回前台
            </Link>
            <a
              href="https://github.com/HuiBinLai/baoyan-beacon/issues"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[var(--navy)] px-4 py-2 text-sm font-bold text-white"
            >
              处理投稿
            </a>
          </div>
        </nav>

        <section className="grid gap-4 md:grid-cols-5">
          <Metric label="总条目" value={typedNotices.length} />
          <Metric label="待复核" value={autoCount} />
          <Metric label="已核验" value={verifiedCount} />
          <Metric label="人大条目" value={rucCount} />
          <Metric label="院系清单覆盖" value={`${typedUnitCoverage.totals.covered}/${typedUnitCoverage.totals.units}`} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white/85 p-5">
            <h2 className="text-2xl font-black text-[var(--navy)]">985 覆盖进度</h2>
            <p className="mt-2 leading-7 text-[var(--muted)]">
              中国人民大学固定排在第一位。数字为当前主库已收录条目数，0 代表还需要继续补来源或人工整理。
            </p>
            <div className="mt-5 max-h-[34rem] overflow-auto pr-2">
              {universityCoverage.map((item) => (
                <div key={item.name} className="mb-2 flex items-center justify-between rounded-2xl bg-[var(--paper)] px-4 py-3">
                  <div>
                    <span className="font-black text-[var(--navy)]">{item.priority}. {item.name}</span>
                    <span className="ml-2 text-xs font-bold text-[var(--muted)]">
                      {item.latestYear ? `最新 ${item.latestYear}` : "待补充"}
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[var(--sea)]">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--line)] bg-white/85 p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索学校、年份、专业、标题"
                className="min-w-0 flex-1 rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 font-semibold outline-none"
              />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none"
              >
                <option value="auto">待复核</option>
                <option value="verified">已核验</option>
                <option value="demo">示例</option>
                <option value="all">全部</option>
              </select>
            </div>

            <div className="mt-5 max-h-[34rem] overflow-auto">
              {filtered.map((notice) => (
                <article key={notice.id} className="mb-3 rounded-2xl border border-[var(--line)] bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--mist)] px-3 py-1 text-xs font-black text-[var(--sea)]">
                      {notice.school}
                    </span>
                    <span className="rounded-full bg-[var(--beam-soft)] px-3 py-1 text-xs font-black text-[var(--rust)]">
                      {notice.year} · {notice.type}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-black text-[var(--muted)]">
                      {notice.confidence}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-7 text-[var(--navy)]">{notice.title}</h3>
                  <p className="mt-2 text-sm font-semibold text-[var(--muted)]">
                    {notice.department} · {notice.majors.join("、")}
                  </p>
                  <a
                    href={notice.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-full bg-[var(--paper)] px-4 py-2 text-sm font-black text-[var(--navy)]"
                  >
                    打开原文复核
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-white/85 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-black text-[var(--navy)]">985 院系覆盖</h2>
              <p className="mt-2 leading-7 text-[var(--muted)]">
                每所学校先建立院系/培养单位清单，再判断哪些院系已有近五年项目候选，哪些还需要继续补官网或公众号来源。
              </p>
            </div>
            <select
              value={coverageSchool}
              onChange={(event) => setCoverageSchool(event.target.value)}
              className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-sm font-black text-[var(--navy)] outline-none"
            >
              {schoolUnitSummary.map((item) => (
                <option key={item.school} value={item.school}>
                  {item.school} {item.covered}/{item.total}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {schoolUnitSummary.map((item) => (
              <button
                key={item.school}
                type="button"
                onClick={() => setCoverageSchool(item.school)}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-black transition ${
                  item.school === coverageSchool ? "bg-[var(--navy)] text-white" : "bg-[var(--paper)] text-[var(--navy)] hover:bg-white"
                }`}
              >
                <span className="block truncate">{item.school}</span>
                <span className={item.school === coverageSchool ? "mt-1 block text-[var(--beam)]" : "mt-1 block text-[var(--rust)]"}>
                  {item.covered}/{item.total}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {selectedUnitItems.map((item) => (
              <div key={item.id} className="rounded-2xl bg-[var(--paper)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-[var(--navy)]">{item.department}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === "covered" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                    {item.status === "covered" ? "已覆盖" : "待补源"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted)]">
                  {item.total} 条记录 · 近五年 {item.recentFiveYears} 条 · {item.years.slice(0, 5).join(" / ") || "暂无年份"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[2rem] border border-[var(--line)] bg-white/85 p-5">
      <p className="text-sm font-black tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--navy)]">{value}</div>
    </div>
  );
}
