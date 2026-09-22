"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="mx-auto max-w-xl p-12"><h1 className="text-2xl font-semibold">资料暂时无法读取</h1><p className="my-5 text-sm leading-7 text-stone-500">请确认已完成资料生成，并重新构建、启动网站。</p><button onClick={reset} className="rounded-xl bg-[#215e4e] px-5 py-3 text-sm text-white">重新尝试</button></main>; }
