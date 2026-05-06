"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import projects from "../../../content/projects.json";
import notices from "../../../content/notices.json";

type TimelineNotice = {
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
  notices: TimelineNotice[];
};

type Project = {
  id: string;
  school: string;
  department: string;
  region: string;
  title: string;
  tracks: string[];
  qualityFlags: string[];
  timeline: ProjectTimeline[];
  currentSeasonStatus: string;
  currentSeasonCount: number;
  noticeCount: number;
  llmStructuredCount: number;
  years: number[];
  stages: string[];
  degreeTypes: string[];
  majors: string[];
  referenceNote: string;
};

type Notice = {
  id: string;
  title: string;
  summary: string;
  requirements?: string[];
  materials?: string[];
  applicationMethod?: string;
  targetStudents?: string;
  structuredStatus?: string;
};

const typedProjects = projects as Project[];
const typedNotices = notices as Notice[];
const currentSeasonAdmissionYear = new Date().getFullYear() + 1;
const noticeById = new Map(typedNotices.map((notice) => [notice.id, notice]));

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

function compact(values: string[], limit = 8) {
  return values.filter((item) => item && item !== "待确认").slice(0, limit);
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectShell>加载项目中...</ProjectShell>}>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsContent() {
  const params = useSearchParams();
  const id = params.get("id") || "";
  const school = params.get("school") || "";
  const department = params.get("department") || "";
  const selectedProject =
    typedProjects.find((project) => project.id === id) ||
    typedProjects.find((project) => project.school === school && project.department === department);

  if (!selectedProject) {
    return (
      <ProjectShell>
        <div className="rounded-[2rem] border border-[var(--line)] bg-white/85 p-6">
          <p className="text-sm font-black tracking-[0.22em] text-[var(--rust)]">PROJECTS</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--navy)]">项目库</h1>
          <p className="mt-4 max-w-3xl leading-8 text-[var(--muted)]">
            每个项目聚合同一学校、同一学院/项目的历年通知。先看项目，再看具体通知，会比在通知列表里翻找更快。
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {typedProjects.slice(0, 120).map((project) => (
            <Link key={project.id} href={projectHref(project)} className="rounded-[2rem] border border-[var(--line)] bg-white/90 p-5 transition hover:-translate-y-1 hover:border-[var(--sea)]/30">
              <p className="text-sm font-black tracking-[0.18em] text-[var(--rust)]">{project.school} · {project.region}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--navy)]">{project.department}</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--muted)]">
                {project.noticeCount} 条记录 · {project.years.slice(0, 5).join(" / ")} 招生
              </p>
              <TagRow items={[...project.tracks, ...project.degreeTypes, ...project.stages].slice(0, 6)} />
            </Link>
          ))}
        </div>
      </ProjectShell>
    );
  }

  return (
    <ProjectShell>
      <section className="rounded-[2.25rem] border border-[var(--line)] bg-white/90 p-6 shadow-[0_24px_70px_rgba(12,28,51,0.08)]">
        <Link href="/" className="inline-flex rounded-full bg-[var(--paper)] px-4 py-2 text-sm font-black text-[var(--navy)] ring-1 ring-[var(--line)]">
          返回项目筛选
        </Link>
        <p className="mt-6 text-sm font-black tracking-[0.24em] text-[var(--rust)]">PROJECT</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--navy)] md:text-6xl">
          {selectedProject.school} · {selectedProject.department}
        </h1>
        <p className="mt-5 max-w-4xl text-lg leading-9 text-[var(--muted)]">
          当前季 {currentSeasonAdmissionYear} 招生：{selectedProject.currentSeasonStatus}。
          下面的往年发布时间、报名区间、申请材料和培养类型只用于提前准备，具体以当年官方通知为准。
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <Metric label="归档记录" value={String(selectedProject.noticeCount)} />
          <Metric label="覆盖年份" value={selectedProject.years.join(" / ")} />
          <Metric label="培养类型" value={compact(selectedProject.degreeTypes, 4).join(" / ") || "待确认"} />
          <Metric label="当前季" value={selectedProject.currentSeasonCount ? "已发现" : "监控中"} />
        </div>
        <div className="mt-5 grid gap-3 rounded-3xl bg-[var(--paper)] p-5 md:grid-cols-2">
          <InfoLine label="专业方向" value={compact(selectedProject.tracks, 6).join(" / ") || "待确认"} />
          <InfoLine label="相关专业" value={compact(selectedProject.majors, 12).join(" / ") || "待确认"} />
          <InfoLine label="通知阶段" value={compact(selectedProject.stages, 8).join(" / ") || "待确认"} />
          <InfoLine label="数据提醒" value={selectedProject.qualityFlags.length ? selectedProject.qualityFlags.join(" / ") : selectedProject.referenceNote} />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-[var(--line)] bg-white/90 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black tracking-[0.22em] text-[var(--rust)]">TIMELINE</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[var(--navy)]">往年时间参考</h2>
          </div>
          <p className="max-w-2xl text-sm font-semibold leading-7 text-[var(--muted)]">仅供参考，以当年官方通知为准。</p>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs font-black tracking-[0.16em] text-[var(--rust)]">
              <tr>
                <th className="px-4 py-2">招生年份</th>
                <th className="px-4 py-2">阶段</th>
                <th className="px-4 py-2">通知发布时间</th>
                <th className="px-4 py-2">报名开始</th>
                <th className="px-4 py-2">报名截止</th>
                <th className="px-4 py-2">培养类型</th>
              </tr>
            </thead>
            <tbody>
              {selectedProject.timeline.map((entry) => (
                <tr key={entry.year} className="bg-[var(--paper)] font-semibold text-[var(--muted)]">
                  <td className="rounded-l-2xl px-4 py-3 text-[var(--navy)]">{entry.year} 招生</td>
                  <td className="px-4 py-3">{entry.stages.join(" / ") || "待确认"}</td>
                  <td className="px-4 py-3">{formatDate(entry.firstPublishedAt)}</td>
                  <td className="px-4 py-3">{formatDate(entry.firstApplicationStart)}</td>
                  <td className="px-4 py-3 text-[var(--rust)]">{formatDate(entry.lastApplicationEnd)}</td>
                  <td className="rounded-r-2xl px-4 py-3">{compact(entry.degreeTypes, 4).join(" / ") || "待确认"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 grid gap-5">
        {selectedProject.timeline.map((group) => (
          <div key={group.year} className="rounded-[2rem] border border-[var(--line)] bg-white/90 p-5">
            <h2 className="text-2xl font-black text-[var(--navy)]">{group.year} 招生通知</h2>
            <div className="mt-4 grid gap-3">
              {group.notices.map((timelineNotice) => {
                const detail = noticeById.get(timelineNotice.id);
                return (
                  <article key={timelineNotice.id} className="rounded-3xl bg-[var(--paper)] p-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{timelineNotice.stage}</Badge>
                      {compact(timelineNotice.degreeTypes, 3).map((item) => <Badge key={item}>{item}</Badge>)}
                      <Badge>{detail?.structuredStatus === "llm" ? "LLM 结构化" : "规则结构化"}</Badge>
                    </div>
                    <h3 className="mt-3 text-xl font-black leading-8 text-[var(--navy)]">{timelineNotice.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm font-semibold leading-7 text-[var(--muted)]">{detail?.summary || "暂无摘要，请打开官方原文复核。"}</p>
                    <div className="mt-4 grid gap-3 rounded-2xl bg-white/75 p-4 text-sm font-semibold text-[var(--muted)] md:grid-cols-2">
                      <InfoLine label="报名时间" value={dateRange(timelineNotice.applicationStart, timelineNotice.applicationEnd)} />
                      <InfoLine label="报名方式" value={detail?.applicationMethod} />
                      <InfoLine label="面向对象" value={detail?.targetStudents} />
                      <InfoLine label="官方发布时间" value={formatDate(timelineNotice.publishedAt)} />
                    </div>
                    <KeyList title="申请条件" items={detail?.requirements} />
                    <KeyList title="材料要求" items={detail?.materials} />
                    <a
                      href={timelineNotice.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-full bg-[var(--navy)] px-5 py-3 text-sm font-black text-white"
                    >
                      查看官方原文
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </ProjectShell>
  );
}

function ProjectShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--line)] bg-white p-4">
      <p className="text-xs font-black tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 text-2xl font-black text-[var(--navy)]">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-black tracking-[0.18em] text-[var(--rust)]">{label}</p>
      <p className="mt-1 line-clamp-3 leading-7 text-[var(--navy)]">{value || "待确认"}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--navy)] ring-1 ring-[var(--line)]">{children}</span>;
}

function TagRow({ items }: { items: string[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {(items.length ? items : ["待确认"]).map((item) => (
        <Badge key={item}>{item}</Badge>
      ))}
    </div>
  );
}

function KeyList({ title, items }: { title: string; items?: string[] }) {
  const visibleItems = (items || []).filter(Boolean).slice(0, 4);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl bg-white/75 p-4">
      <h4 className="text-sm font-black tracking-[0.16em] text-[var(--rust)]">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--muted)]">
        {visibleItems.map((item) => (
          <li key={item} className="line-clamp-2">{item}</li>
        ))}
      </ul>
    </div>
  );
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
