"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "登录失败"); }
      window.location.assign("/manage");
    } catch (error) { setError(error instanceof Error ? error.message : "登录失败，请稍后重试。"); }
    finally { setBusy(false); }
  }
  return <form onSubmit={login} className="space-y-5">
    <label className="block text-sm">管理员账号<input name="username" autoComplete="username" required maxLength={200} className="mt-2 block w-full rounded-lg border border-[#dce5d5] p-3"/></label>
    <label className="block text-sm">密码<input name="password" type="password" autoComplete="current-password" required maxLength={1024} className="mt-2 block w-full rounded-lg border border-[#dce5d5] p-3"/></label>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="w-full rounded-lg bg-[#294b35] p-3 text-sm text-white disabled:opacity-50">{busy ? "正在登录…" : "登录"}</button>
  </form>;
}

export function LogoutButton() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("退出失败，请重试。");
      window.location.assign("/login");
    } catch { setError("退出失败，请重试。"); }
    finally { setBusy(false); }
  }
  return <div className="mb-5 text-right"><button onClick={logout} disabled={busy} className="text-sm text-[#5d784e] underline disabled:opacity-50">退出登录</button>{error && <p role="alert">{error}</p>}</div>;
}
