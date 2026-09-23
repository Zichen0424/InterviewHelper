import { LibraryView } from "@/components/library-view";
import { Shell } from "@/components/shell";
import { getSnapshot } from "@/lib/data";
import { toCard } from "@/lib/schema";
import { Suspense } from "react";
export const dynamic = "force-dynamic";
export default function Home() {
  const data = getSnapshot();
  return <Shell><Suspense fallback={<div className="library-loading" role="status">正在翻开你的面经札记…</div>}><LibraryView cards={data.interviews.map(toCard)} buildId={data.build_id} demo={data.demo} embeddingDemo={data.embedding_provider === "mock"} /></Suspense></Shell>;
}
