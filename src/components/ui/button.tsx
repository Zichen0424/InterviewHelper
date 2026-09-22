import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const variants = cva("inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700", {
  variants: { variant: { default: "bg-[#215e4e] text-white hover:bg-[#174b3d]", outline: "border border-stone-200 bg-white hover:bg-stone-50", ghost: "hover:bg-stone-100 text-stone-600" }, size: { default: "px-5 py-3", sm: "px-3 py-2", icon: "h-10 w-10" } }, defaultVariants: { variant: "default", size: "default" },
});
export function Button({ className, variant, size, asChild = false, ...props }: React.ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(variants({ variant, size }), className)} {...props} />;
}
