import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpen, Building2, CalendarDays, FileText, MessageSquareText, Sparkles } from "lucide-react";
import { HeartButton } from "@/components/heart-button";
import { Shell } from "@/components/shell";
import { getSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: getSnapshot().interviews.find(i => i.id === id)?.title || "面经未找到" };
}

export default async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = getSnapshot();
  const interview = data.interviews.find(i => i.id === id);
  if (!interview) notFound();
  const parts = data.chunks.filter(c => c.interview_id === id).sort((a, b) => a.start - b.start);
  const raw = Array.from(interview.raw);

  return <Shell><div className="mx-auto max-w-4xl reveal">
    <div className="detail-topline">
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#78876b] hover:text-[#294b35]"><ArrowLeft size={15}/>返回面经资料库</Link>
      <HeartButton id={interview.id} title={interview.title} expanded/>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-medium tracking-widest text-[#81946d]"><BookOpen size={14}/> INTERVIEW FIELD NOTE {data.demo && <span className="ml-3 rounded bg-[#eeeddf] px-2 py-1 tracking-normal text-[#908c70]">含演示处理</span>}</div>
    <h1 className="text-balance text-3xl font-semibold leading-snug tracking-tight text-[#283b2a] sm:text-4xl">{interview.title}</h1>
    <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#78876f]"><span className="flex items-center gap-1.5"><Building2 size={14}/>{interview.company || "公司未注明"}</span><span>{interview.role || "岗位未注明"}</span><span className="flex items-center gap-1.5"><CalendarDays size={14}/>{interview.interview_date || "面试日期未注明"}</span></div>
    <div className="mt-5 flex flex-wrap gap-2">{interview.tags.map(t => <Link key={t} href={`/?tag=${encodeURIComponent(t)}`} className="rounded-md border border-[#dfe6d6] bg-[#f5f7ef] px-3 py-1.5 text-[11px] text-[#6b8253] hover:bg-[#e8efdb]">{t}<ArrowUpRight size={10} className="ml-1 inline"/></Link>)}</div>

    <section className="my-10 rounded-2xl border border-[#d9e5d1] bg-[#eef4e7] p-6 sm:p-8"><h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#365b3b]"><Sparkles size={17}/>{data.llm_provider === "mock" ? "整理摘要 · 演示规则" : "AI 总结"}</h2><p className="text-sm leading-8 text-[#536d50]">{interview.summary}</p><p className="mt-4 text-[10px] text-[#91a089]">整理内容仅供快速回顾，请以完整原文为准。</p></section>
    <section className="mb-10"><h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-[#344936]"><MessageSquareText size={19} className="text-[#748e5f]"/>面试问题<span className="ml-1 rounded-md bg-[#e7ecd9] px-2 py-0.5 text-xs text-[#718760]">{interview.questions.length}</span></h2>
      {interview.questions.length ? <ol className="space-y-3">{interview.questions.map((q, index) => <li key={index} className="rounded-xl border border-[#e0e6d9] bg-white px-5 py-4"><div className="flex gap-3"><span className="mt-0.5 text-xs tabular-nums text-[#93a381]">{String(index + 1).padStart(2, "0")}</span><p className="text-sm leading-7 text-[#405441]">{q.text}</p></div><details className="ml-7 mt-2 text-xs text-[#78866c]"><summary className="cursor-pointer hover:text-[#406238]">查看原文依据</summary><blockquote className="mt-2 border-l-2 border-[#cfdebd] pl-3 leading-6">{q.evidence}</blockquote></details></li>)}</ol> : <p className="text-sm text-[#7c8875]">原文未提取到明确的面试题。</p>}
    </section>
    <section className="rounded-2xl border border-[#dfe6d9] bg-white p-6 sm:p-8"><h2 className="mb-6 flex items-center gap-2 border-b border-[#e9eee3] pb-5 text-lg font-semibold text-[#344936]"><FileText size={19} className="text-[#748e5f]"/>完整原文<span className="ml-auto text-[10px] font-normal text-[#9da994]">保留原始内容</span></h2><div className="whitespace-pre-wrap break-words text-[14px] leading-8 text-[#62735e]">{parts.length ? <>{raw.slice(0, parts[0].start).join("")}{parts.map((part, index) => <span key={part.id} id={part.id}>{raw.slice(part.start, parts[index + 1]?.start ?? raw.length).join("")}</span>)}</> : interview.raw}</div></section>
    <div className="mt-9 flex justify-end"><Link href="/?view=liked" className="inline-flex items-center gap-1 text-xs text-[#6d815e]">查看爱心清单<ArrowUpRight size={13}/></Link></div>
  </div></Shell>;
}
