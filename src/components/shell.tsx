import Link from "next/link";
import { ArrowUpRight, BookOpen, Library, NotebookPen, Sprout } from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">
    <aside className="fixed inset-y-0 left-0 hidden w-[224px] flex-col border-r border-[#e5e9e2] bg-[#f0f3ed] px-6 py-9 lg:flex">
      <Link href="/" className="flex items-center gap-3" aria-label="面经札记首页"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#215e4e] text-white"><NotebookPen size={21} /></span><span><span className="block text-lg font-bold tracking-wider">面经札记</span><span className="block text-[9px] tracking-[2.4px] text-stone-500">INTERVIEW NOTES</span></span></Link>
      <div className="mb-4 mt-14 text-[10px] font-semibold tracking-[2px] text-[#879087]">MY WORKSPACE</div>
      <nav className="space-y-2"><Link href="/" className="flex items-center gap-3 rounded-xl bg-[#e0e9df] px-4 py-3 text-sm font-semibold text-[#215e4e]"><Library size={17} />面经资料库</Link><Link href="/guide" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-stone-500 hover:bg-white/60"><BookOpen size={17} />整理指南<ArrowUpRight size={13} className="ml-auto" /></Link></nav>
      <div className="paper-grid mt-auto rounded-2xl border border-[#dde5d8] p-5"><Sprout size={24} className="mb-4 text-[#52765a]"/><p className="text-sm font-medium leading-7">每一次复盘，<br/>都让下一次更从容。</p><p className="mt-3 text-[11px] text-stone-500">积累经验，也积累底气。</p></div>
      <div className="mt-6 flex items-center gap-2 text-[11px] text-stone-500"><span className="h-1.5 w-1.5 rounded-full bg-[#679c76]"/>个人面试知识库<span className="ml-auto text-stone-400">V1.0</span></div>
    </aside>
    <div className="lg:ml-[224px]"><header className="flex h-[76px] items-center justify-between border-b border-[#e8ebe5] bg-white/65 px-6 sm:px-10 xl:px-14"><Link href="/" className="flex items-center gap-2 text-sm text-stone-500"><NotebookPen size={17} className="lg:hidden"/><span className="hidden sm:inline">我的工作台</span><span className="mx-2 hidden text-stone-300 sm:inline">/</span><span className="font-medium text-[#334d40]">面经资料库</span></Link><span className="flex items-center gap-2 rounded-full border border-[#e1e8df] px-3 py-1.5 text-[11px] text-[#657761]"><span className="h-1.5 w-1.5 rounded-full bg-[#70976a]"/>慢慢积累，认真准备</span></header>
    <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-10 sm:py-11 xl:px-14">{children}</main>
    <footer className="mx-6 mt-6 flex flex-wrap justify-between gap-2 border-t border-[#e6e9e2] py-6 text-[11px] text-stone-400 sm:mx-10 xl:mx-14"><span>面经札记 · 把零散经历，变成自己的知识</span><span>Stay curious. Keep growing.</span></footer></div>
  </div>;
}
