import { ManageView } from "@/components/manage-view";
import { Shell } from "@/components/shell";
import { getSnapshot } from "@/lib/data";
import { isPrivateInterview } from "@/lib/management";
import { SESSION_COOKIE, validSession } from "@/lib/auth";
import { LogoutButton } from "@/components/admin-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理面经 | 面经札记" };

export default async function ManagePage() {
  if (!await validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/login");
  const data = getSnapshot();
  const records = data.interviews.filter(isPrivateInterview).map(({ id, title, company, role, updated_at }) => ({ id, title, company, role, updated_at }));
  return <Shell><LogoutButton/><ManageView records={records} demo={data.demo}/></Shell>;
}
