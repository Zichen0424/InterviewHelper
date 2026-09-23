"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Command, Heart, Layers3, LoaderCircle, Search, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { HeartButton } from "./heart-button";
import { useHearts } from "@/lib/hearts";
import { aiFirstStacks, hasTag, parseSort, popularStacks, sortInterviews, sortLabels, type SortOrder } from "@/lib/library";
import type { InterviewCard, SearchItem } from "@/lib/schema";

export function LibraryView({ cards, buildId, demo, embeddingDemo }: {
  cards: InterviewCard[]; buildId: string; demo: boolean; embeddingDemo: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.get("q") || "";
  const mode = params.get("mode") === "semantic" ? "semantic" : "keyword";
  const company = params.get("company") || "";
  const tag = params.get("tag") || "";
  const onlyLiked = params.get("view") === "liked";
  const order = parseSort(params.get("sort"));
  const [draft, setDraft] = useState(query);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [expandedStacks, setExpandedStacks] = useState(false);
  const [revision, setRevision] = useState(0);
  const liked = useHearts();
  const likedCards = useMemo(() => cards.filter(card => liked.has(card.id)), [cards, liked]);
  const scopedIds = onlyLiked ? JSON.stringify(likedCards.map(card => card.id).sort()) : "";
  const stacks = useMemo(() => aiFirstStacks(popularStacks(cards)), [cards]);
  const companies = useMemo(() => [...new Set(cards.map(c => c.company).filter((s): s is string => !!s))], [cards]);

  function update(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("category");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    router.replace(next.size ? `/?${next}` : "/", { scroll: false });
  }
  useEffect(() => setDraft(query), [query]);
  useEffect(() => setPage(1), [query, company, tag, order, onlyLiked]);
  useEffect(() => {
    setError("");
    if (!query) { setResults([]); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setResults([]);
    const filters = { company, tag, ...(scopedIds ? { ids: JSON.parse(scopedIds) as string[] } : {}) };
    fetch("/api/search", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode, filters, build_id: buildId }), signal: controller.signal,
    }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "搜索失败，请稍后重试");
      return body;
    }).then(body => { if (!controller.signal.aborted) setResults(body.items); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, mode, company, tag, scopedIds, revision, buildId]);

  const visible = useMemo(() => sortInterviews(
    (query ? results : cards).filter(c => (!company || c.company === company) && (!tag || hasTag(c.tags, tag)) && (!onlyLiked || liked.has(c.id))),
    order, liked,
  ), [cards, results, query, company, tag, onlyLiked, order, liked]);
  const totalPages = Math.max(1, Math.ceil(visible.length / 12));
  const activePage = Math.min(page, totalPages);
  const current = visible.slice((activePage - 1) * 12, activePage * 12);
  const questionCount = cards.reduce((total, card) => total + card.question_count, 0);
  const shownStacks = expandedStacks ? stacks : stacks.slice(0, 8);
  const maxStackCount = stacks.reduce((max, stack) => Math.max(max, stack.count), 1);

  return <div className="library-page reveal">
    <section className="library-hero">
      <div>
        <p className="eyebrow"><span/> A PERSONAL FIELD GUIDE</p>
        <h1>积累面试经验，<br/><span>下一场，更有准备。</span></h1>
        <p className="hero-description">从 RAG 到 Agent，从原理到工程。<br className="sm:hidden"/>沿着技术栈，找到值得反复读的面经。</p>
        <div className="hero-stats">
          <span><strong>{cards.length}</strong>篇面经</span><i/>
          <span><strong>{stacks.length}</strong>个技术标签</span><i/>
          <span><strong>{questionCount}</strong>道问题</span>
        </div>
      </div>
      <div className="hero-note" aria-label="AI 开发面试准备">
        <div className="note-top"><span><span className="status-dot"/> LEARNING IN PROGRESS</span><Command size={18}/></div>
        <div className="note-orbits" aria-hidden="true"><span/><span/><span/><Sparkles size={32}/></div>
        <div className="note-bottom"><p>不止记住答案，<br/>更要理解怎么构建。</p><span>AI ENGINEERING<br/>INTERVIEW NOTES / 01</span></div>
      </div>
    </section>

    <section className="search-panel" aria-label="搜索面经">
      <div className="search-panel-top">
        <div className="search-mode">{(["keyword", "semantic"] as const).map(m =>
          <button key={m} onClick={() => update({ mode: m === "keyword" ? "" : m })} aria-pressed={mode === m}>
            {m === "keyword" ? <Search size={14}/> : <Sparkles size={14}/>}{m === "keyword" ? "关键词搜索" : "语义搜索"}
          </button>)}
        </div>
        <span className="search-caption">{mode === "keyword" ? "把你关心的技术，变成下一步的准备方向。" : "描述你想解决的问题，寻找相关的面试经历。"}</span>
      </div>
      <form className="search-form" onSubmit={e => {
        e.preventDefault();
        if (draft.trim()) { if (draft.trim() === query) setRevision(n => n + 1); else update({ q: draft.trim() }); }
      }}>
        <Search className="search-leading" size={21}/>
        <input aria-label="搜索面经" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)}
          placeholder={mode === "keyword" ? "搜索技术栈、公司或面试问题…" : "例如：RAG 检索不准时，应该怎样排查？"}/>
        {draft && <button type="button" className="clear-search" aria-label="清空搜索" onClick={() => { setDraft(""); update({ q: "" }); }}><X size={16}/></button>}
        <Button type="submit" aria-label="搜索面经" disabled={loading || !draft.trim()}>
          {loading ? <LoaderCircle size={16} className="animate-spin"/> : <ArrowRight size={17}/>}<span className="hidden sm:inline">开始搜索</span>
        </Button>
      </form>
      <div className="search-footnote">
        {mode === "keyword" ? <><span>试试</span>{stacks.slice(0, 4).map(stack => <button key={stack.name} onClick={() => { setDraft(stack.name); update({ q: stack.name }); }}>{stack.name}<ArrowUpRight size={11}/></button>)}</> : <><Sparkles size={12}/>{embeddingDemo ? "演示语义检索；接入真实模型后可验证效果。" : "用自己的话提问，最多返回 20 篇相关面经。"}</>}
      </div>
    </section>

    <div className="library-body">
      <section className="results-section" aria-label="面经列表">
        <div className="results-heading"><div className="view-tabs">
          <button aria-pressed={!onlyLiked} onClick={() => update({ view: "" })}>全部面经<span>{cards.length}</span></button>
          <button aria-pressed={onlyLiked} onClick={() => update({ view: "liked" })}><Heart size={14}/>爱心清单<span>{likedCards.length}</span></button>
        </div><span className="results-count" role="status">{loading ? "搜索中…" : `${visible.length} 篇${query ? "结果" : "面经"}`}</span></div>
        <div className="filter-toolbar">
          <label className="select-control"><span className="sr-only">按公司筛选</span><select aria-label="按公司筛选" value={company} onChange={e => update({ company: e.target.value })}><option value="">所有公司</option>{companies.map(c => <option key={c}>{c}</option>)}</select><ChevronDown size={13}/></label>
          <label className="select-control mobile-stack-select"><span className="sr-only">按技术栈筛选</span><select aria-label="按技术栈筛选" value={tag} onChange={e => update({ tag: e.target.value })}><option value="">所有技术栈</option>{stacks.map(s => <option key={s.name} value={s.name}>{s.name} · {s.count}</option>)}</select><ChevronDown size={13}/></label>
          <label className="select-control sort-control"><ArrowDownUp size={13}/><span className="sr-only">排序方式</span><select aria-label="排序方式" value={order} onChange={e => update({ sort: e.target.value === "newest" ? "" : e.target.value })}>{(Object.keys(sortLabels) as SortOrder[]).map(s => <option key={s} value={s}>{sortLabels[s]}</option>)}</select><ChevronDown size={13}/></label>
        </div>
        {(query || tag || company) && <div className="active-filters">
          {tag && <button onClick={() => update({ tag: "" })}><Layers3 size={12}/>{tag}<X size={12}/></button>}
          {query && <span>“{query}” 的搜索结果</span>}
          <button className="reset-filters" onClick={() => { setDraft(""); update({ q: "", tag: "", company: "" }); }}>清除筛选</button>
        </div>}
        {order === "popular" && <p className="sort-note">已点爱心的面经优先，同分按时间倒序。</p>}
        {query && mode === "semantic" && <p className="sort-note">最相关的至多 20 篇面经，按当前排序展示。</p>}

        {error ? <div role="alert" className="empty-state error-state"><p>{error}</p><Button variant="outline" onClick={() => { update({ mode: "" }); setRevision(n => n + 1); }}>使用关键词搜索</Button></div> : loading ?
          <div className="article-grid">{[1, 2, 3, 4].map(n => <div key={n} className="card-skeleton"/>)}</div> : current.length ?
          <div className="article-grid">{current.map(card => <ArticleCard key={card.id} card={card} onTag={name => update({ tag: name })}/>)}</div> :
          <div className="empty-state">{onlyLiked ? <Heart size={30}/> : <Search size={30}/>}<h2>{onlyLiked ? "把值得再读的面经，留在这里" : "暂时没有找到相关面经"}</h2><p>{onlyLiked ? "点击面经右上角的爱心，再回到这里复习。" : "试试另一个关键词，或放宽技术栈和公司筛选。"}</p><Button variant="outline" onClick={() => { setDraft(""); update({ q: "", tag: "", company: "", view: "" }); }}>浏览全部面经</Button></div>}
        {totalPages > 1 && <nav aria-label="分页" className="pagination"><Button variant="outline" size="sm" disabled={activePage === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={15}/>上一页</Button><span>{activePage} / {totalPages}</span><Button variant="outline" size="sm" disabled={activePage === totalPages} onClick={() => setPage(p => p + 1)}>下一页<ChevronRight size={15}/></Button></nav>}
        {demo && <p className="demo-note"><span>演示模式</span>当前部分能力使用模拟结果。<Link href="/guide">导入自己的面经<ArrowUpRight size={11}/></Link></p>}
      </section>

      <aside className="stack-sidebar">
        <section className="stack-panel">
          <div className="stack-panel-title"><div><p className="eyebrow">EXPLORE BY STACK</p><h2>热门技术栈</h2></div><Layers3 size={20}/></div>
          <p className="stack-description">优先展示 AI 开发技术，数字为收录篇数</p>
          <button className={`stack-row all-stacks ${!tag ? "selected" : ""}`} onClick={() => update({ tag: "" })}><span>全部技术栈</span><span>{cards.length}{!tag && <Check size={12}/>}</span></button>
          {shownStacks.map((stack, index) => <button key={stack.name} className={`stack-row ${tag === stack.name ? "selected" : ""}`} aria-label={`筛选技术栈 ${stack.name}`} aria-pressed={tag === stack.name} onClick={() => update({ tag: tag === stack.name ? "" : stack.name })}>
            <span className="stack-rank">{String(index + 1).padStart(2, "0")}</span><span className="stack-name">{stack.name}<span className="stack-meter"><i style={{ width: `${stack.count / maxStackCount * 100}%` }}/></span></span><span className="stack-count">{stack.count}</span>
          </button>)}
          {stacks.length > 8 && <button className="expand-stacks" onClick={() => setExpandedStacks(v => !v)}>{expandedStacks ? "收起技术栈" : `查看全部 ${stacks.length} 个技术标签`}<ChevronDown size={13} className={expandedStacks ? "rotate-180" : ""}/></button>}
        </section>
        <div className="reading-note"><BookOpen size={20}/><h3>让收藏，成为下一次复习。</h3><p>点亮一颗爱心，留住一个好问题。<br/>回到爱心清单，继续上次的思考。</p><span>爱心保存在当前浏览器</span></div>
      </aside>
    </div>
  </div>;
}

function ArticleCard({ card, onTag }: { card: InterviewCard | SearchItem; onTag: (tag: string) => void }) {
  const result = "snippet" in card ? card : null;
  const href = `/interviews/${card.id}${result?.chunk_id ? `#${result.chunk_id}` : ""}`;
  return <article className="interview-card" data-interview-id={card.id} data-date={card.interview_date || card.updated_at}>
    <div className="card-top"><div className="company-mark" aria-hidden="true">{(card.company || "面经").slice(0, 1)}</div><div className="card-identity"><span>{card.company || "公司未注明"}</span><p>{card.role || "岗位未注明"}</p></div><HeartButton id={card.id} title={card.title}/></div>
    <h2><Link href={href}>{card.title}</Link></h2>
    <p className="card-summary">{card.summary}</p>
    {result && <div className="match-excerpt"><span>命中原文</span><p>{result.snippet}</p></div>}
    <div className="card-tags">{card.tags.slice(0, 4).map(t => <button key={t} onClick={() => onTag(t)} title={`筛选 ${t}`}>{t}</button>)}</div>
    <div className="card-footer"><span><CalendarDays size={12}/>{card.interview_date || "日期未注明"}</span><span>{card.question_count} 道问题</span><Link href={href} aria-label={`阅读 ${card.title}`}><ArrowUpRight size={16}/></Link></div>
  </article>;
}
