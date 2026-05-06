import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "保研灯塔 | 开源推免信息索引",
  description: "聚合高校推免、夏令营、预推免通知与往年经验资料，帮助同学打破升学信息差。",
  metadataBase: new URL("https://github.com/HuiBinLai/baoyan-beacon"),
  openGraph: {
    title: "保研灯塔",
    description: "开源的推免/保研信息索引与经验资料库。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
