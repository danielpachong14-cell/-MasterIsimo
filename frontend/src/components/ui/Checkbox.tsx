import { cn } from "@/lib/utils"
import * as React from "react"

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className="flex items-center gap-3 cursor-pointer group select-none">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            className="peer sr-only"
            ref={ref}
            {...props}
          />
          <div className="h-5 w-5 rounded border border-outline-variant/50 bg-white transition-all duration-200 peer-checked:bg-primary peer-checked:border-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20" />
          <span className="material-symbols-outlined absolute text-[16px] text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100 font-bold">
            check
          </span>
        </div>
        {label && (
          <span className="text-sm font-medium text-on-surface-variant/80 group-hover:text-on-surface transition-colors">
            {label}
          </span>
        )}
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
