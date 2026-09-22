import { LibraryView } from "@/components/library-view";
import { Shell } from "@/components/shell";
import { getSnapshot } from "@/lib/data";
import { toCard } from "@/lib/schema";
export default function Home() {
  const data = getSnapshot();
  return <Shell><LibraryView cards={data.interviews.map(toCard).sort((a, b) => (b.interview_date || b.updated_at).localeCompare(a.interview_date || a.updated_at))} buildId={data.build_id} demo={data.demo} embeddingDemo={data.embedding_provider === "mock"} /></Shell>;
}
