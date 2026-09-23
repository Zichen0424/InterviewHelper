import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FilePlus2, Search, Sparkles, Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";

export const metadata = { title: "整理指南" };

const steps = [
  {
    icon: FilePlus2,
    title: "01 / 粘贴并保存原文",
    text: "在本机打开面经管理，把完整面经粘贴到输入框。提交后原文会保存在 data/raw/private，不要求固定模板，也不会加入版本管理。",
  },
  {
    icon: Sparkles,
    title: "02 / 自动整理",
    text: "保存时会运行离线处理流程，生成总结、技术标签、面试题和搜索索引。默认演示模式不调用云服务；接入真实 LLM 与 Embedding 后会使用你配置的模型。处理失败时原文仍保留，可在管理页重新整理。",
  },
  {
    icon: Search,
    title: "03 / 阅读与检索",
    text: "整理成功后刷新页面就能看到新面经。关键词适合精确查找公司与技术名词，语义搜索适合用自然语言描述问题；爱心清单可保留值得再读的资料。",
  },
  {
    icon: Trash2,
    title: "04 / 管理与删除",
    text: "在面经管理页可以删除自己粘贴的面经；删除后原文和搜索索引同步更新。内置示例受到保护。也可以直接维护 data/raw 中的本地文件，再运行数据构建命令。",
  },
];

export default function Guide() {
  return <Shell><div className="mx-auto max-w-3xl">
    <Link href="/" className="inline-flex items-center gap-2 text-xs text-stone-500"><ArrowLeft size={15}/>返回资料库</Link>
    <h1 className="mb-4 mt-8 text-3xl font-semibold">给经历一个归处</h1>
    <p className="mb-6 text-sm leading-7 text-stone-500">保留面试原文，让总结和搜索帮助你回顾关键问题。网页管理仅供本机使用。</p>
    <Link href="/manage" className="mb-10 inline-flex items-center gap-2 rounded-xl bg-[#3d6040] px-5 py-3 text-sm font-medium text-white hover:bg-[#315035]">打开面经管理<ArrowUpRight size={15}/></Link>
    <div className="space-y-5">{steps.map(({ icon: Icon, title, text }) => <section key={title} className="rounded-2xl border border-[#dfe6d8] bg-white p-7">
      <Icon size={22} className="mb-4 text-[#6b8a61]"/>
      <h2 className="mb-3 text-lg font-medium">{title}</h2>
      <p className="text-sm leading-8 text-stone-500">{text}</p>
    </section>)}</div>
    <p className="mt-7 text-xs leading-6 text-stone-400">AI 整理可能存在遗漏。题目附带原文依据，完整原文始终保留，方便核对。</p>
  </div></Shell>;
}
