"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const issueBase = "https://github.com/HuiBinLai/baoyan-beacon/issues/new";

export default function SubmitPage() {
  const [kind, setKind] = useState("通知线索");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [details, setDetails] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = [
      "## 类型",
      kind,
      "",
      "## 院校/学院/专业",
      `${school || "待补充"} / ${major || "待补充"}`,
      "",
      "## 原文链接",
      url || "待补充",
      "",
      "## 补充说明",
      details || "待补充",
      "",
      "## 提交须知",
      "- 我确认该信息来自公开来源或本人原创经验。",
      "- 我理解维护者会先审核再发布到网站。",
      "- 我不会提交隐私、泄题、盗版、攻击性或违法违规内容。",
    ].join("\n");

    const params = new URLSearchParams({
      title: `[${kind}] ${title || school || "新的共建投稿"}`,
      body,
      labels: kind === "经验分享" ? "ugc,experience" : "submission,notice",
    });

    window.open(`${issueBase}?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-sm font-black tracking-[0.24em] text-[var(--muted)]">
            BAOYAN BEACON
          </Link>
          <Link href="/" className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-bold">
            返回首页
          </Link>
        </nav>

        <section className="grid gap-8 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="rounded-full bg-[var(--beam-soft)] px-4 py-2 text-sm font-black text-[var(--rust)]">
              GitHub 共建投稿
            </p>
            <h1 className="mt-5 text-5xl font-black leading-tight tracking-[-0.06em] text-[var(--navy)]">
              看到一条信息，就替后来者点亮一盏灯。
            </h1>
            <p className="mt-5 leading-8 text-[var(--muted)]">
              三天上线版先用 GitHub Issues 作为投稿队列：不用登录我们自己的后台，不存自由评论，所有内容先审核再进入公开索引。
            </p>
            <div className="mt-6 rounded-[2rem] border border-[var(--line)] bg-white/75 p-5">
              <h2 className="text-xl font-black text-[var(--navy)]">适合提交什么？</h2>
              <ul className="mt-4 space-y-3 leading-7 text-[var(--muted)]">
                <li>高校官网推免、夏令营、预推免通知链接</li>
                <li>微信公众号文章链接和你整理的摘要</li>
                <li>本人原创面经、机试/笔试题型、入营门槛参考</li>
                <li>资料转让或咨询服务的外部链接，但不在本站交易</li>
              </ul>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-[var(--line)] bg-white/90 p-5 shadow-[0_30px_80px_rgba(12,28,51,0.1)]"
          >
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                投稿类型
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold outline-none"
                >
                  <option>通知线索</option>
                  <option>经验分享</option>
                  <option>资料/咨询外链</option>
                  <option>纠错补充</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                标题
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="例如：某大学计算机学院 2026 夏令营通知"
                  className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold outline-none"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                  院校/学院
                  <input
                    value={school}
                    onChange={(event) => setSchool(event.target.value)}
                    placeholder="例如：浙江大学 软件学院"
                    className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold outline-none"
                  />
                </label>
                <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                  专业/方向
                  <input
                    value={major}
                    onChange={(event) => setMajor(event.target.value)}
                    placeholder="例如：软件工程 / 0854"
                    className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold outline-none"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                原文链接
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="官网链接、公众号文章链接、闲鱼链接等"
                  className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold outline-none"
                />
              </label>

              <label className="grid gap-2 text-sm font-black text-[var(--navy)]">
                补充说明
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="请写明发布时间、截止时间、报名方式、你希望我们注意的字段。经验分享请尽量匿名化。"
                  rows={7}
                  className="resize-none rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-base font-semibold leading-7 outline-none"
                />
              </label>

              <button
                type="submit"
                className="rounded-full bg-[var(--navy)] px-7 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5"
              >
                打开 GitHub 投稿单
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
