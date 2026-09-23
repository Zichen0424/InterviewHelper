import Link from "next/link";
import { ArrowUpRight, BookOpen, Heart, NotebookPen, SquarePen } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <Link href="/" className="brand" aria-label="面经札记首页"><span className="brand-mark"><NotebookPen size={21} strokeWidth={1.7}/></span><span><strong>面经札记<span> / </span></strong><small>FIELD NOTES</small></span></Link>
      <nav className="header-nav" aria-label="主导航"><Link href="/">面经资料库</Link><Link href="/?view=liked"><Heart size={14}/>爱心清单</Link><Link href="/manage"><SquarePen size={14}/>管理面经</Link><Link href="/guide"><BookOpen size={14}/>整理指南<ArrowUpRight size={11}/></Link></nav>
      <span className="workspace-badge"><span/> AI 开发 · 个人知识库</span>
    </div></header>
    <main className="site-main">{children}</main>
    <footer className="site-footer"><Link href="/">面经札记<span>把经历变成下一次的底气。</span></Link><span>Built for curious minds. <span className="footer-star">✳</span></span></footer>
  </div>;
}
