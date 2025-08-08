import * as React from "react";
import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
    const map = {
      default: "bg-emerald-500/90 hover:bg-emerald-500 text-white focus:ring-emerald-400 ring-offset-neutral-900",
      secondary: "bg-white/10 hover:bg-white/20 text-white ring-offset-neutral-900"
    } as const;
    return <button ref={ref} className={cn(base, map[variant], className)} {...props} />;
  }
);
Button.displayName = "Button";