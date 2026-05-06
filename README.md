# 保研灯塔 Baoyan Beacon

开源的推免/保研信息索引与经验资料库，目标是聚合高校官网、公众号和同学共建的信息，帮助后来者减少升学过程中的信息差。

## MVP 边界

- 聚合推免、夏令营、预推免、直博通知。
- 支持院校、专业、类型和关键词筛选。
- 用户通过 GitHub Issues 提交通知线索、公众号链接和经验分享。
- 每日 GitHub Actions 自动扫描高校招生网站，发现候选通知后写入 `content/notices.json`。
- 站内不做自由评论区，讨论跳转 GitHub Discussions、微信群或飞书群。
- 站内不做支付、担保、聊天和评价，交易信息只允许外部链接或联系方式。

## 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:3000`。

## 数据文件

- `content/notices.json`: 当前前端展示的数据源。
- `content/sources.json`: 每日抓取的高校招生网站来源。
- `docs/supabase-schema.sql`: 后续接 Supabase 时的数据库结构。

运行一次候选通知发现：

```bash
npm run fetch:notices
```

## 上线建议

第一阶段最简单的部署组合：

- GitHub: 开源协作和每日自动任务。
- Vercel: 部署 Next.js 前端。
- Supabase: 后续承载投稿、审核、搜索和后台数据。

## 内容安全原则

本站只做公开信息索引和经过审核的资料沉淀，不承诺通知完整性、真实性或交易安全。所有用户投稿默认先审核再发布；请勿提交隐私、泄题、盗版、攻击性或违法违规内容。
