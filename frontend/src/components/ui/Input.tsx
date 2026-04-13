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
          <label className="text-sm font-semibold text-on-surface-variant px-1 flex items-center gap-2">
            {icon && <span className="material-symbols-outlined text-[18px]">{icon}</span>}
            {label}
          </label>
        )}
        <div className="relative group">
          <input
            className={cn(
              "flex h-14 w-full rounded-xl bg-surface-container-low px-4 py-2 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-on-surface-variant/40 focus-visible:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 border-none",
              error && "ring-2 ring-error/20 bg-error-container/10",
              className
            )}
            ref={ref}
            {...props}
          />
          <div className="absolute inset-0 rounded-xl pointer-events-none ring-1 ring-inset ring-outline-variant/30 group-focus-within:ring-primary/30 transition-all duration-200" />
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
