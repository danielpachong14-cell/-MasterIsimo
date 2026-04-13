import { cn } from "@/lib/utils"
import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'error'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: "bg-kinetic-gradient text-on-primary shadow-elevated hover:opacity-90 active:scale-[0.98]",
      secondary: "bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed active:scale-[0.98]",
      tertiary: "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
      ghost: "bg-transparent text-primary hover:bg-primary-fixed/30",
      error: "bg-error text-on-error shadow-sm hover:bg-error/90"
    }

    const sizes = {
      sm: "h-9 px-3 text-xs rounded-md",
      md: "h-11 px-5 text-sm font-medium rounded-lg",
      lg: "h-14 px-8 text-base font-semibold rounded-xl",
      xl: "h-16 px-10 text-lg font-bold rounded-xl"
    }

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Procesando...
          </span>
        ) : children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
