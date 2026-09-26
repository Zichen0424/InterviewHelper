import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, validSession } from "@/lib/auth";
import { LoginForm } from "@/components/admin-auth";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "管理员登录" };
export default async function LoginPage() {
  if (await validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/manage");
  return <Shell><section className="mx-auto max-w-md rounded-2xl border border-[#dce5d5] bg-white p-8">
    <h1 className="text-2xl font-semibold text-[#294b35]">管理员登录</h1>
    <p className="mb-7 mt-3 text-sm leading-6 text-stone-500">阅读和搜索无需登录。管理资料请使用管理员账号。</p>
    <LoginForm/>
  </section></Shell>;
}
