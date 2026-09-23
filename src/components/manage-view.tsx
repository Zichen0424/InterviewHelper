"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, FilePlus2, FileText, RotateCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";

type ManagedInterview = { id: string; title: string; company: string | null; role: string | null; updated_at: string };
type Notice = { kind: "success" | "error"; text: string; link?: string };

async function readResponse(response: Response): Promise<{ error?: string; code?: string; saved?: boolean; id?: string; title?: string }> {
  try { return await response.json(); } catch { return { error: "服务器没有返回有效结果，请稍后重试。" }; }
}

export function ManageView({ records, demo }: { records: ManagedInterview[]; demo: boolean }) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState<"save" | "retry" | string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!raw.trim() || busy) return;
    setBusy("save");
    setNotice(null);
    try {
      const response = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw }) });
      const result = await readResponse(response);
      if (!response.ok) {
        const source = (result as { source?: string }).source;
        setNotice({ kind: "error", text: `${result.error || "整理失败，请稍后重试。"}${result.saved && source ? ` 原文文件：data/raw/${source}` : ""}` });
        return;
      }
      setRaw("");
      setNotice({ kind: "success", text: "原文已保存，摘要、标签和搜索索引已更新。", link: `/interviews/${result.id}` });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "连接中断，请检查服务状态。若原文已保存，可点击“重新整理”。" });
    } finally { setBusy(null); }
  }

  async function retry() {
    if (busy) return;
    setBusy("retry");
    setNotice(null);
    try {
      const response = await fetch("/api/interviews", { method: "PATCH" });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || "整理失败，请检查模型配置。 ");
      setNotice({ kind: "success", text: "资料重新整理完成，请在下方查看。" });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "整理失败，请稍后重试。" });
    } finally { setBusy(null); }
  }

  async function remove(record: ManagedInterview) {
    if (busy || !window.confirm(`删除“${record.title}”及其原文？此操作无法撤销。`)) return;
    setBusy(record.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/interviews/${record.id}`, { method: "DELETE" });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || "删除失败，请稍后重试。");
      setNotice({ kind: "success", text: `已删除“${record.title}”，搜索索引也已更新。` });
      router.refresh();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "删除失败，请稍后重试。" });
    } finally { setBusy(null); }
  }

  return <div className="reveal mx-auto max-w-[1130px]">
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b border-[#dde5d7] pb-8">
      <div><p className="eyebrow"><span/> YOUR PRIVATE ARCHIVE / 资料管理</p><h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#263b2d] sm:text-[39px]">把新的面试经历，<br className="sm:hidden"/><span className="text-[#738b62]">放进这里。</span></h1><p className="mt-3 max-w-2xl text-[13px] leading-7 text-[#7a8875]">粘贴原文后，系统会保存原文、提取面试题与技术标签，并更新搜索索引。你可以随时回看或删除自己添加的资料。</p></div>
      <Link href="/" className="inline-flex items-center gap-2 text-xs text-[#5d784e] hover:text-[#294b35]">返回资料库<ArrowRight size={15}/></Link>
    </div>
    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
      <section className="rounded-2xl border border-[#dce5d5] bg-white p-5 shadow-[0_3px_0_#e9ede1] sm:p-7">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8efde] text-[#617e4b]"><FilePlus2 size={20}/></span><div><h2 className="text-base font-semibold text-[#314732]">粘贴面经原文</h2><p className="mt-1 text-[11px] text-[#8a9682]">保留完整内容，不需要固定格式</p></div></div>
        <form onSubmit={save}>
          <label htmlFor="interview-raw" className="mb-2 block text-xs font-medium text-[#5d6e58]">面经原文</label>
          <textarea id="interview-raw" aria-label="面经原文" value={raw} onChange={event => setRaw(event.target.value)} maxLength={100000} rows={14} placeholder={"例如：\n# RAG 应用开发面试\n公司：某科技公司\n日期：2026-09-23\n\n面试官问：如何评估检索召回率？\n我介绍了自己的向量检索与重排项目……"} className="w-full resize-y rounded-xl border border-[#dfe7d9] bg-[#fbfcf8] px-4 py-4 text-sm leading-7 text-[#364839] outline-none placeholder:text-[#a2ad99] focus:border-[#819f70] focus:ring-2 focus:ring-[#e8f0df]"/>
          <div className="mt-2 flex justify-between text-[10px] text-[#97a28f]"><span>原文只保存在本机的私人资料目录</span><span>{raw.length.toLocaleString()} / 100,000</span></div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><p className="flex max-w-sm items-center gap-2 text-[11px] leading-5 text-[#8a987e]"><ShieldCheck size={16} className="shrink-0"/>内置演示资料受到保护；删除只作用于你添加的原文。</p><button type="submit" disabled={!raw.trim() || busy !== null} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#294b35] px-5 py-3 text-xs font-medium text-white hover:bg-[#1f3d2b] disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={16}/>{busy === "save" ? "正在保存并整理…" : "保存并整理"}</button></div>
        </form>
        {notice && <div role="status" aria-live="polite" className={`mt-6 rounded-lg border px-4 py-3 text-xs leading-6 ${notice.kind === "success" ? "border-[#c6d9b9] bg-[#f1f7eb] text-[#4d6941]" : "border-[#e1cfad] bg-[#fcf8ee] text-[#8d6e42]"}`}>{notice.text}{notice.link && <Link href={notice.link} className="ml-2 underline underline-offset-2">查看完整面经</Link>}</div>}
      </section>
      <aside className="space-y-5">
        <div className="rounded-2xl border border-[#dce5d5] bg-[#eef2e8] p-6"><p className="eyebrow"><span/> HOW IT WORKS</p><h2 className="mt-4 text-base font-semibold text-[#3d5738]">从原文到可检索的札记</h2><ol className="mt-5 space-y-4 text-xs leading-6 text-[#75866c]"><li><strong className="mr-3 text-[#98aa83]">01</strong> 原文保存到私人目录</li><li><strong className="mr-3 text-[#98aa83]">02</strong> {demo ? "演示规则" : "AI 模型"}提取摘要、标签与题目</li><li><strong className="mr-3 text-[#98aa83]">03</strong> 切分内容，生成搜索向量</li></ol><p className="mt-5 border-t border-[#dbe5d5] pt-4 text-[10px] leading-5 text-[#94a18b]">{demo ? "当前使用演示处理。配置真实模型后可获得 AI 分析与语义向量。" : "整理可能需要一些时间；原文会一直保留，供你核对分析结果。"}</p></div>
        <button type="button" onClick={retry} disabled={busy !== null} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dce5d5] bg-white px-4 py-3 text-xs text-[#5d7953] hover:bg-[#f8faf4] disabled:opacity-50"><RotateCw size={15} className={busy === "retry" ? "animate-spin" : ""}/>{busy === "retry" ? "正在重新整理…" : "重新整理已保存的原文"}</button>
      </aside>
    </div>
    <section className="mt-10"><div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-[#dce3d5] pb-4"><div><p className="eyebrow"><span/> MY ENTRIES</p><h2 className="mt-2 text-xl font-semibold text-[#304731]">我添加的面经</h2></div><span className="text-xs text-[#8a9781]">共 {records.length} 篇</span></div>
      {records.length ? <div className="grid gap-3 md:grid-cols-2">{records.map(record => <article key={record.id} className="flex gap-4 rounded-xl border border-[#e0e6d9] bg-white p-5"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#eef2e8] text-[#82976b]"><FileText size={19}/></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold text-[#344b36]"><Link href={`/interviews/${record.id}`} className="hover:text-[#688653]">{record.title}</Link></h3><p className="mt-2 truncate text-[11px] text-[#8b9782]">{[record.company, record.role].filter(Boolean).join(" · ") || "未注明公司与岗位"}</p><p className="mt-3 text-[10px] text-[#a2ac98]">保存于 {new Date(record.updated_at).toLocaleDateString("zh-CN")}</p></div><button type="button" aria-label={`删除 ${record.title}`} title="删除面经" onClick={() => remove(record)} disabled={busy !== null} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#a4ae9b] hover:bg-[#fbefeb] hover:text-[#b96f61] disabled:opacity-50"><Trash2 size={17}/></button></article>)}</div> : <div className="rounded-xl border border-dashed border-[#cfdbc5] bg-[#fbfcf8] px-6 py-12 text-center text-xs leading-7 text-[#899984]">这里还没有你添加的面经。把第一篇原文粘贴到上方即可。</div>}
    </section>
  </div>;
}
