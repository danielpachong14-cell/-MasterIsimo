import { cn } from "@/lib/utils"
import * as React from "react"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 focus-within:translate-y-[-1px] transition-all duration-200">
        {label && (
          <label className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant/70 px-1">
            {label}
          </label>
        )}
        <div className="relative group">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors z-10">
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
          )}
          <input
            className={cn(
              "flex h-14 w-full rounded-xl bg-surface-container-low py-2 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-on-surface-variant/30 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 border-none",
              icon ? "pl-12 pr-4" : "px-4",
              error && "ring-2 ring-error/20 bg-error-container/10",
              className
            )}
            ref={ref}
            {...props}
          />
          <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-inset ring-outline-variant/20 group-focus-within:ring-primary/30 transition-all duration-200" />
        </div>
        {error && (
          <p className="text-xs font-medium text-error flex items-center gap-1.5 px-1 animate-in fade-in slide-in-from-top-1">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
