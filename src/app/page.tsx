"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDeferredValue, useState } from "react";
import projects from "../../content/projects.json";

type ProjectNotice = {
  id: string;
  title: string;
  stage: string;
  year: number;
  publishedAt: string;
  applicationStart?: string;
  applicationEnd?: string;
  degreeTypes: string[];
  sourceUrl: string;
};

type ProjectTimeline = {
  year: number;
  count: number;
  stages: string[];
  degreeTypes: string[];
  firstPublishedAt?: string;
  lastPublishedAt?: string;
  firstApplicationStart?: string;
  lastApplicationEnd?: string;
  notices: ProjectNotice[];
};

type Project = {
  id: string;
  school: string;
  department: string;
  region: string;
  levels?: string[];
  title: string;
  tracks: string[];
  qualityFlags: string[];
  timeline: ProjectTimeline[];
  currentSeasonStatus: string;
  currentSeasonCount: number;
  latestPastYear?: number;
  noticeCount: number;
  llmStructuredCount: number;
  years: number[];
  stages: string[];
  degreeTypes: string[];
  majors: string[];
  referenceNote: string;
};

const typedProjects = projects as Project[];
const currentSeasonAdmissionYear = new Date().getFullYear() + 1;
const currentSeasonLabel = `当前季 ${currentSeasonAdmissionYear} 招生`;
const recentYearsLabel = "最近五年";
const allYearsLabel = "全部招生年份";
const allTracksLabel = "全部专业方向";
const allSchoolsLabel = "全部院校";
const allRegionsLabel = "全部地区";
const allStagesLabel = "全部阶段";
const allDegreesLabel = "全部培养类型";
const allStatusLabel = "全部状态";
const currentFoundLabel = "当前季已发现";
const currentWatchingLabel = "当前季监控中";
const needsReviewLabel = "需要复核";

const yearValues = Array.from(new Set(typedProjects.flatMap((project) => project.years))).sort((a, b) => b - a);
const latestAdmissionYear = Math.max(...yearValues);
const recentYearValues = yearValues.filter((item) => item <= latestAdmissionYear && item >= latestAdmissionYear - 4);
const yearOptions = [currentSeasonLabel, recentYearsLabel, allYearsLabel, ...yearValues.map(String)];
const trackOptions = [allTracksLabel, ...Array.from(new Set(typedProjects.flatMap((project) => project.tracks))).sort((a, b) => a.localeCompare(b, "zh-CN"))];
const schoolOptions = [allSchoolsLabel, ...Array.from(new Set(typedProjects.map((project) => project.school)))];
const regionOptions = [allRegionsLabel, ...Array.from(new Set(typedProjects.map((project) => project.region))).sort((a, b) => a.localeCompare(b, "zh-CN"))];
const stageOptions = [allStagesLabel, ...Array.from(new Set(typedProjects.flatMap((project) => project.stages)))];
const degreeOptions = [allDegreesLabel, ...Array.from(new Set(typedProjects.flatMap((project) => project.degreeTypes)))];
const noticeArchiveCount = typedProjects.reduce((sum, project) => sum + project.noticeCount, 0);
const resultLimit = 90;

function formatDate(date?: string) {
  if (!date) {
    return "待确认";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "待确认";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function projectHref(project: Project) {
  return `/projects?id=${encodeURIComponent(project.id)}`;
}

function yearCount(year: number) {
  return typedProjects.filter((project) => project.years.includes(year)).length;
}

function currentSeasonProjects() {
  return typedProjects.filter((project) => project.currentSeasonCount > 0);
}

function latestReference(project: Project) {
  return project.timeline.find((entry) => entry.year < currentSeasonAdmissionYear) || project.timeline[0];
}

function timelineText(entry?: ProjectTimeline) {
  if (!entry) {
    return "暂无往年时间";
  }

  const published = entry.firstPublishedAt ? `发布 ${formatDate(entry.firstPublishedAt)}` : "发布时间待确认";
  const start = entry.firstApplicationStart ? formatDate(entry.firstApplicationStart) : "待确认";
  const end = entry.lastApplicationEnd ? formatDate(entry.lastApplicationEnd) : "待确认";
  return `${entry.year} 招生：${published}，报名 ${start} 至 ${end}`;
}

function compact(values: string[], limit = 4) {
  return values.filter((item) => item && item !== "待确认").slice(0, limit);
}

export default function Home() {
  const [track, setTrack] = useState(allTracksLabel);
  const [school, setSchool] = useState(allSchoolsLabel);
  const [region, setRegion] = useState(allRegionsLabel);
  const [stage, setStage] = useState(allStagesLabel);
  const [degree, setDegree] = useState(allDegreesLabel);
  const [year, setYear] = useState(recentYearsLabel);
  const [status, setStatus] = useState(allStatusLabel);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredProjects = typedProjects.filter((project) => {
    const haystack = [
      project.title,
      project.school,
      project.department,
      project.region,
      ...project.tracks,
      ...project.stages,
      ...project.degreeTypes,
      ...project.majors,
      ...project.timeline.flatMap((entry) => entry.notices.map((notice) => notice.title)),
    ]
      .join(" ")
      .toLowerCase();
    const matchesQuery = deferredQuery ? haystack.includes(deferredQuery) : true;
    const matchesTrack = track === allTracksLabel || project.tracks.includes(track);
    const matchesSchool = school === allSchoolsLabel || project.school === school;
    const matchesRegion = region === allRegionsLabel || project.region === region;
    const matchesStage = stage === allStagesLabel || project.stages.includes(stage);
    const matchesDegree = degree === allDegreesLabel || project.degreeTypes.includes(degree);
    const matchesStatus =
      status === allStatusLabel ||
      (status === currentFoundLabel && project.currentSeasonCount > 0) ||
      (status === currentWatchingLabel && project.currentSeasonCount === 0) ||
      (status === needsReviewLabel && project.qualityFlags.length > 0);
    const matchesYear =
      year === allYearsLabel ||
      (year === currentSeasonLabel && project.currentSeasonCount > 0) ||
      (year === recentYearsLabel && project.years.some((item) => recentYearValues.includes(item))) ||
      project.years.includes(Number(year));

    return matchesQuery && matchesTrack && matchesSchool && matchesRegion && matchesStage && matchesDegree && matchesStatus && matchesYear;
  });
  const visibleProjects = filteredProjects.slice(0, resultLimit);
  const currentCount = currentSeasonProjects().length;

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
      <section className="relative px-5 pb-10 pt-8 sm:px-8 lg:px-12">
        <div className="beacon-glow" />
        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/60 bg-white/75 px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.08)] backdrop-blur">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[var(--navy)] text-lg text-[var(--beam)]">灯</span>
            <span>
              <span className="block text-sm font-semibold tracking-[0.24em] text-[var(--muted)]">BAOYAN BEACON</span>
              <span className="block text-xl font-black">保研灯塔</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 text-sm font-semibold text-[var(--muted)] md:flex">
            <a href="#projects" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">项目检索</a>
            <Link href="/projects" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">项目库</Link>
            <Link href="/submit" className="rounded-full px-4 py-2 transition hover:bg-[var(--mist)]">补充/纠错</Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-7xl gap-8 pb-8 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="animate-rise">
            <p className="mb-5 inline-flex rounded-full border border-[var(--beam)]/60 bg-[var(--beam-soft)] px-4 py-2 text-sm font-bold text-[var(--navy)]">
              {currentSeasonLabel}监控中 · 往期信息仅供参考
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-[-0.06em] text-[var(--navy)] sm:text-7xl">
              查推免项目，看往年时间，别错过报名。
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-9 text-[var(--muted)]">
              按专业方向、院校、地区、阶段和培养类型筛选项目；进入项目主页查看往年发布时间、报名区间、申请条件和官方原文。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#projects" className="rounded-full bg-[var(--navy)] px-7 py-4 text-center text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5">
                开始筛选项目
              </a>
              <button
                type="button"
                onClick={() => {
                  setTrack("计算机/AI");
                  setYear(recentYearsLabel);
                }}
                className="rounded-full border border-[var(--navy)]/15 bg-white px-7 py-4 text-center text-sm font-black text-[var(--navy)] transition hover:-translate-y-0.5 hover:border-[var(--navy)]/40"
              >
                看计算机/AI方向
              </button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_30px_80px_rgba(12,28,51,0.14)] backdrop-blur">
            <div className="rounded-[1.5rem] bg-[var(--navy)] p-6 text-white">
              <p className="text-sm font-semibold text-white/60">当前季状态</p>
              <h2 className="mt-2 text-3xl font-black">{currentSeasonAdmissionYear} 招生</h2>
              <p className="mt-4 leading-8 text-white/70">
                {currentCount > 0
                  ? `已发现 ${currentCount} 个项目有当前季通知。`
                  : "暂未发现当前季官方通知。现在适合先看往年发布时间和材料要求，提前准备成绩单、排名证明、英语证明和个人陈述。"}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <StatusTile label="项目库" value={String(typedProjects.length)} />
                <StatusTile label="通知归档" value={String(noticeArchiveCount)} />
                <StatusTile label="AI/计算机" value={String(typedProjects.filter((project) => project.tracks.includes("计算机/AI")).length)} />
              </div>
              <p className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-7 text-white/72">
                往期时间只用于估算准备节奏，最终报名时间、条件和材料以当年官方通知为准。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="projects" className="relative z-10 px-5 py-10 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-[var(--line)] bg-white/88 p-5 shadow-[0_24px_60px_rgba(12,28,51,0.08)]">
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Select label="专业方向" value={track} onChange={setTrack} options={trackOptions} />
              <Select label="招生年份" value={year} onChange={setYear} options={yearOptions} />
              <Select label="院校" value={school} onChange={setSchool} options={schoolOptions} />
              <Select label="地区" value={region} onChange={setRegion} options={regionOptions} />
              <Select label="阶段" value={stage} onChange={setStage} options={stageOptions} />
              <Select label="培养类型" value={degree} onChange={setDegree} options={degreeOptions} />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_14rem]">
              <input
                aria-label="在筛选结果中搜索"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="在当前筛选结果中搜索：高瓴、人工智能、电子信息、直博、六级..."
                className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 text-base font-semibold outline-none transition focus:border-[var(--sea)] focus:bg-white"
              />
              <Select label="状态" value={status} onChange={setStatus} options={[allStatusLabel, currentFoundLabel, currentWatchingLabel, needsReviewLabel]} />
            </div>
          </div>

          <div className="mt-5 rounded-[2rem] border border-[var(--line)] bg-white/78 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black tracking-[0.22em] text-[var(--rust)]">RESULTS</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--navy)]">
                  匹配到 {filteredProjects.length} 个项目
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <YearButton active={year === currentSeasonLabel} label={currentSeasonLabel} count={currentCount} onClick={() => setYear(currentSeasonLabel)} />
                <YearButton active={year === recentYearsLabel} label={recentYearsLabel} count={typedProjects.filter((project) => project.years.some((item) => recentYearValues.includes(item))).length} onClick={() => setYear(recentYearsLabel)} />
                {yearValues.slice(0, 5).map((item) => (
                  <YearButton key={item} active={year === String(item)} label={`${item} 招生`} count={yearCount(item)} onClick={() => setYear(String(item))} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="mt-8 rounded-[2rem] border border-dashed border-[var(--line)] bg-white/70 p-10 text-center">
              <h3 className="text-2xl font-black text-[var(--navy)]">暂时没有匹配项目</h3>
              <p className="mt-3 text-[var(--muted)]">可以放宽专业方向或年份筛选，或者提交你看到的官网/公众号链接。</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-black tracking-[0.16em] text-[var(--rust)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 font-semibold outline-none">
        {options.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const reference = latestReference(project);
  const tags = [...compact(project.tracks, 2), ...compact(project.degreeTypes, 2), ...compact(project.stages, 1)];

  return (
    <article className="group flex min-h-full flex-col rounded-[2rem] border border-[var(--line)] bg-white/92 p-5 shadow-[0_18px_45px_rgba(12,28,51,0.06)] transition hover:-translate-y-1 hover:border-[var(--sea)]/30 hover:shadow-[0_28px_70px_rgba(12,28,51,0.12)]">
      <div className="flex flex-wrap gap-2">
        <Badge tone={project.currentSeasonCount > 0 ? "hot" : "soft"}>{project.currentSeasonStatus}</Badge>
        {project.qualityFlags.map((item) => (
          <Badge key={item} tone="warn">{item}</Badge>
        ))}
      </div>
      <p className="mt-4 text-sm font-black tracking-[0.18em] text-[var(--rust)]">{project.school} · {project.region}</p>
      <h3 className="mt-2 text-2xl font-black leading-8 tracking-[-0.03em] text-[var(--navy)]">{project.department}</h3>
      <p className="mt-3 text-sm font-semibold leading-7 text-[var(--muted)]">{timelineText(reference)}</p>
      <div className="mt-4 grid gap-2 rounded-3xl bg-[var(--paper)] p-4 text-sm font-semibold text-[var(--muted)]">
        <InfoLine label="覆盖年份" value={project.years.slice(0, 5).join(" / ")} />
        <InfoLine label="相关专业" value={compact(project.majors, 6).join(" / ") || "待确认"} />
        <InfoLine label="往期提醒" value={project.referenceNote} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(tags.length ? tags : ["待确认"]).map((item) => (
          <Badge key={item}>{item}</Badge>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <Link href={projectHref(project)} className="block rounded-full bg-[var(--navy)] px-5 py-3 text-center text-sm font-black text-white transition group-hover:-translate-y-0.5">
          查看项目主页
        </Link>
      </div>
    </article>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <p className="text-xs font-black tracking-[0.18em] text-white/50">{label}</p>
      <div className="mt-2 text-3xl font-black">{value}</div>
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

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-xs font-black tracking-[0.16em] text-[var(--rust)]">{label}</span>
      <p className="mt-1 line-clamp-2 leading-6 text-[var(--navy)]">{value || "待确认"}</p>
    </div>
  );
}

function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "hot" | "soft" | "warn" }) {
  const className = {
    default: "bg-white text-[var(--navy)] ring-1 ring-[var(--line)]",
    hot: "bg-red-50 text-red-700",
    soft: "bg-[var(--beam-soft)] text-[var(--rust)]",
    warn: "bg-amber-50 text-amber-700",
  }[tone];

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}
