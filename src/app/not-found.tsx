import Link from "next/link";
import { Shell } from "@/components/shell";
export default function NotFound() { return <Shell><div className="py-20 text-center"><p className="mb-3 text-xs tracking-widest text-stone-400">404 / NOT FOUND</p><h1 className="mb-4 text-2xl font-semibold">这篇面经暂时找不到了</h1><p className="mb-8 text-sm text-stone-500">资料可能已移除，回到资料库看看吧。</p><Link href="/" className="rounded-xl bg-[#215e4e] px-5 py-3 text-sm text-white">返回资料库</Link></div></Shell>; }
