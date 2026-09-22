"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowRight, Building2, CalendarDays, ChevronLeft, ChevronRight, FileText, Hash, Lightbulb, LoaderCircle, MessageSquareText, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import type { InterviewCard, SearchItem } from "@/lib/schema";

export function LibraryView({ cards, buildId, demo, embeddingDemo }: { cards: InterviewCard[]; buildId: string; demo: boolean; embeddingDemo: boolean }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"keyword" | "semantic">("keyword");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [ready, setReady] = useState(false);
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setDraft(p.get("q") || ""); setQuery(p.get("q") || "");
    setMode(p.get("mode") === "semantic" ? "semantic" : "keyword");
    setCompany(p.get("company") || ""); setCategory(p.get("category") || ""); setTag(p.get("tag") || ""); setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams();
    if (query) p.set("q", query); if (mode !== "keyword") p.set("mode", mode);
    if (company) p.set("company", company); if (category) p.set("category", category); if (tag) p.set("tag", tag);
    window.history.replaceState(null, "", `${window.location.pathname}${p.size ? `?${p}` : ""}`);
    setPage(1); setError("");
    if (!query) { setResults([]); setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setResults([]);
    fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, mode, filters: { company, category, tag }, build_id: buildId }), signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "搜索失败，请稍后重试"); return body; })
      .then(body => { if (!controller.signal.aborted) setResults(body.items); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ready, query, mode, company, category, tag, revision, buildId]);
  const categories = useMemo(() => [...new Set(cards.map(c => c.category))], [cards]);
  const companies = useMemo(() => [...new Set(cards.map(c => c.company).filter((s): s is string => !!s))], [cards]);
  const tags = useMemo(() => [...new Set(cards.flatMap(c => c.tags))], [cards]);
  const visible = query ? results : cards.filter(c => (!company || c.company === company) && (!category || c.category === category) && (!tag || c.tags.includes(tag)));
  const totalPages = Math.max(1, Math.ceil(visible.length / 20));
  const current = visible.slice((page - 1) * 20, page * 20);
  function clear() { setDraft(""); setQuery(""); setCompany(""); setCategory(""); setTag(""); setError(""); }
  return <div className="reveal">
    <div className="flex items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-[10px] font-semibold tracking-[2.5px] text-[#749079]"><span className="h-px w-6 bg-[#749079]"/>YOUR NEXT CHAPTER</div><h1 className="text-3xl font-semibold tracking-tight sm:text-[36px]">让每一份面经，都有迹可循<span className="text-[#70a18a]">。</span></h1><p className="mt-4 text-sm leading-7 text-[#7c847b]">收集真实经历，整理关键问题，为下一次面试多一分准备。</p></div><div className="hidden rotate-[-7deg] rounded-2xl border border-[#d9e4d7] bg-[#ecf2e7] p-4 text-[#6a8662] xl:block"><FileText size={35} strokeWidth={1.2}/></div></div>
    <div className="mb-8 mt-8 grid grid-cols-3 gap-3 sm:gap-5">{[{ label: "收录面经", value: cards.length, icon: FileText }, { label: "覆盖公司", value: companies.length, icon: Building2 }, { label: "面试问题", value: cards.reduce((n, c) => n + c.question_count, 0), icon: MessageSquareText }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#e5e9e0] bg-white px-4 py-5 sm:gap-4 sm:px-6"><span className="hidden rounded-xl bg-[#f1f5ed] p-3 text-[#6a8263] sm:block"><Icon size={20} strokeWidth={1.6}/></span><div><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 text-[27px] font-medium leading-none tabular-nums">{String(value).padStart(2, "0")}<span className="ml-2 text-[10px] font-normal text-stone-400">{label === "收录面经" ? "篇" : label === "覆盖公司" ? "家" : "道"}</span></p></div></div>)}</div>
    <section aria-label="搜索面经" className="rounded-2xl border border-[#dde5d8] bg-white p-5 shadow-[0_4px_20px_#2d452607] sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-1 rounded-lg bg-[#f2f4ef] p-1">{(["keyword", "semantic"] as const).map(m => <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors ${mode === m ? "bg-white font-semibold text-[#215e4e] shadow-sm" : "text-stone-500"}`}>{m === "keyword" ? <Search size={13}/> : <Sparkles size={13}/>} {m === "keyword" ? "关键词搜索" : "语义搜索"}</button>)}</div><span className="hidden text-[11px] text-stone-400 sm:inline">{mode === "keyword" ? "从一个公司、技术或问题开始" : "换一种说法，也能找到相关经历"}</span></div>
    <form onSubmit={e => { e.preventDefault(); if (draft.trim()) { setQuery(draft.trim()); setRevision(v => v + 1); } }} className="flex gap-2 sm:gap-3"><div className="relative min-w-0 flex-1"><Search size={19} className="absolute left-4 top-3.5 text-[#899587]"/><input aria-label="搜索面经" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder={mode === "keyword" ? "搜索公司、岗位、技术关键词…" : "例如：如何应对突然增大的请求量？"} className="h-12 w-full rounded-xl border border-[#dfe5dc] bg-[#fcfdfb] pl-11 pr-9 text-sm outline-none placeholder:text-[#a1a79d] focus:border-[#63937b]"/>{draft && <button type="button" aria-label="清空搜索" onClick={() => { setDraft(""); setQuery(""); }} className="absolute right-3 top-4 text-stone-400"><X size={15}/></button>}</div><Button type="submit" aria-label="搜索面经" disabled={loading || !draft.trim()} className="h-12 px-4 sm:px-6">{loading ? <LoaderCircle size={16} className="animate-spin"/> : <Search size={16}/>}<span className="hidden sm:inline">搜索面经</span></Button></form>
    <div className="mt-3 flex items-center gap-2 text-[11px] leading-5 text-[#8a9285]"><Lightbulb size={13} className="shrink-0"/>{mode === "keyword" ? "试试 Redis、React 或 Java 并发；多个关键词用空格分隔。" : embeddingDemo ? "当前为模拟语义检索，仅演示流程；接入云端向量模型后可验证真实效果。" : "用一句话描述你想找的内容，搜索会返回相关面经和原文片段。"}</div></section>
    {demo && <div className="mt-4 flex items-center gap-2 text-[11px] leading-5 text-[#928569]"><span className="shrink-0 rounded bg-[#f0ecdf] px-2 py-0.5 font-medium">演示模式</span>当前部分能力使用演示规则，不代表真实模型效果。<Link href="/guide" className="ml-auto shrink-0 underline underline-offset-4">导入自己的面经</Link></div>}
    <div className="mb-5 mt-9 flex flex-wrap items-end justify-between gap-4 border-b border-[#e2e7de]"><div className="flex max-w-full gap-5 overflow-x-auto">{["", ...categories].map(c => <button key={c} onClick={() => setCategory(c)} className={`whitespace-nowrap border-b-2 pb-3 text-sm ${category === c ? "border-[#215e4e] font-semibold text-[#215e4e]" : "border-transparent text-stone-500"}`}>{c || "全部面经"}{!c && <span className="ml-2 rounded-md bg-[#e9eee5] px-1.5 py-0.5 text-[10px]">{cards.length}</span>}</button>)}</div><div className="mb-3 hidden items-center gap-1.5 text-[11px] text-stone-400 sm:flex"><ArrowDownWideNarrow size={13}/>{query ? "按相关程度排序" : "最近的经历在前"}</div></div>
    <div className="mb-5 flex flex-wrap items-center gap-3"><SlidersHorizontal size={15} className="text-stone-400"/><select aria-label="按公司筛选" value={company} onChange={e => setCompany(e.target.value)} className="max-w-[190px] rounded-lg border border-[#e2e6de] bg-white px-3 py-2 text-xs text-stone-600"><option value="">所有公司</option>{companies.map(c => <option key={c}>{c}</option>)}</select><select aria-label="按标签筛选" value={tag} onChange={e => setTag(e.target.value)} className="max-w-[170px] rounded-lg border border-[#e2e6de] bg-white px-3 py-2 text-xs text-stone-600"><option value="">所有知识标签</option>{tags.map(t => <option key={t}>{t}</option>)}</select>{(query || category || company || tag) && <button onClick={clear} className="text-xs text-stone-400 hover:text-[#215e4e]">重置筛选</button>}<span role="status" className="ml-auto text-xs text-stone-400">{loading ? "正在寻找相关经历…" : `共 ${visible.length} 篇面经`}</span></div>
    {error ? <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><p className="text-sm leading-6 text-amber-900">{error}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => { setMode("keyword"); setRevision(v => v + 1); }}>使用关键词搜索</Button></div> : loading ? <div className="grid gap-4 md:grid-cols-2">{[1,2,3,4].map(n => <div key={n} className="h-60 animate-pulse rounded-2xl bg-[#eaf0e6]"/>)}</div> : current.length ? <div className="grid gap-4 md:grid-cols-2">{current.map((card, index) => <ArticleCard key={card.id} card={card} index={index} searching={!!query}/>)}</div> : <div className="rounded-2xl border border-dashed border-[#d6dfd0] bg-white/60 px-6 py-14 text-center"><Search size={30} className="mx-auto mb-4 text-[#a0b29a]"/><h2 className="text-lg font-medium">{cards.length ? "暂时没有找到相关面经" : "你的资料库，从第一篇面经开始"}</h2><p className="mt-3 text-sm text-stone-500">{cards.length ? "试试更短的关键词，或者调整筛选条件。" : "按照整理指南添加原文，再回来发现新的收获。"}</p><Button variant="outline" className="mt-5" asChild={!cards.length} onClick={cards.length ? clear : undefined}>{cards.length ? "清除筛选" : <Link href="/guide">查看整理指南</Link>}</Button></div>}
    {totalPages > 1 && <nav aria-label="分页" className="mt-7 flex items-center justify-center gap-4"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/>上一页</Button><span className="text-xs text-stone-500">{page} / {totalPages}</span><Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>下一页<ChevronRight size={15}/></Button></nav>}
  </div>;
}
function ArticleCard({ card, index, searching }: { card: InterviewCard | SearchItem; index: number; searching: boolean }) {
  const result = "snippet" in card ? card : null;
  const href = `/interviews/${card.id}${result?.chunk_id ? `#${result.chunk_id}` : ""}`;
  return <article className="group flex flex-col rounded-2xl border border-[#e2e7dd] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#b5c9b0] hover:shadow-[0_8px_28px_#293b3408] sm:p-6"><div className="mb-4 flex items-center gap-2"><span className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${card.category === "前端" ? "bg-[#edf0fa] text-[#657aaf]" : card.category === "算法/数据" ? "bg-[#f1eefa] text-[#8a75ac]" : card.category === "测试" ? "bg-[#fbf0e5] text-[#aa845d]" : "bg-[#edf3e8] text-[#6a855a]"}`}>{card.category}</span><span className="truncate text-[11px] text-stone-400">{card.company || "公司未注明"}</span><span className="ml-auto text-[10px] tabular-nums text-[#bdc6b8]">{String(index + 1).padStart(2, "0")}</span></div><h2 className="text-[17px] font-semibold leading-7 tracking-tight"><Link href={href} className="transition-colors hover:text-[#388067]">{card.title}</Link></h2><p className="mb-4 mt-2 text-xs text-[#8a9285]">{card.role || "岗位未注明"}</p><p className="line-clamp-2 text-[13px] leading-6 text-[#7c8578]">{card.summary}</p>{searching && result && <div className="mt-3 rounded-lg border-l-2 border-[#9bb995] bg-[#f5f8f1] px-3 py-2"><span className="text-[10px] font-medium text-[#64815c]">命中原文</span><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-[#6f7b67]">{result.snippet}</p></div>}<div className="mb-5 mt-4 flex flex-wrap gap-1.5">{card.tags.slice(0,4).map(t => <span key={t} className="inline-flex items-center gap-0.5 rounded-md border border-[#eef0e9] px-2 py-1 text-[10px] text-[#89907f]"><Hash size={10}/>{t}</span>)}</div><div className="mt-auto flex items-center gap-3 border-t border-[#eff1ec] pt-4 text-[10px] text-stone-400"><span className="flex items-center gap-1"><CalendarDays size={12}/>{card.interview_date || "日期未注明"}</span><span className="flex items-center gap-1"><MessageSquareText size={12}/>{card.question_count} 道问题</span><Link href={href} aria-label={`阅读 ${card.title}`} className="ml-auto flex items-center gap-1 text-xs font-medium text-[#52714b]">阅读全文<ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5"/></Link></div></article>;
}
