"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { toggleHeart, useHearts } from "@/lib/hearts";
import { cn } from "@/lib/utils";

export function HeartButton({ id, title, expanded = false }: { id: string; title: string; expanded?: boolean }) {
  const liked = useHearts().has(id);
  const [notice, setNotice] = useState("");
  return <div className="relative shrink-0">
    <button type="button" aria-label={`${liked ? "取消爱心" : "点亮爱心"}：${title}`} aria-pressed={liked}
      title={liked ? "取消爱心" : "值得再看，点亮爱心"}
      onClick={() => setNotice(toggleHeart(id) ? "" : "浏览器无法保存，爱心仅在本次访问中保留。")}
      className={cn("heart-button", liked && "is-liked", expanded && "heart-button-expanded")}>
      <Heart size={17} strokeWidth={1.7} fill={liked ? "currentColor" : "none"}/>
      {expanded ? <span>{liked ? "已点亮爱心" : "加入爱心清单"}</span> : <span className="tabular-nums">{liked ? 1 : 0}</span>}
    </button>
    {notice && <p role="status" className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">{notice}</p>}
  </div>;
}
