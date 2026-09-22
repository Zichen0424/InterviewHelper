import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "面经札记 · 个人面试知识库", template: "%s · 面经札记" }, description: "整理面试经历，发现知识之间的联系。" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}</body></html>; }
