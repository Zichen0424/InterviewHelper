import { ManageView } from "@/components/manage-view";
import { Shell } from "@/components/shell";
import { getSnapshot } from "@/lib/data";
import { isLoopbackHost, isPrivateInterview } from "@/lib/management";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理面经 | 面经札记" };

export default async function ManagePage() {
  if (!isLoopbackHost((await headers()).get("host"))) notFound();
  const data = getSnapshot();
  const records = data.interviews.filter(isPrivateInterview).map(({ id, title, company, role, updated_at }) => ({ id, title, company, role, updated_at }));
  return <Shell><ManageView records={records} demo={data.demo}/></Shell>;
}
