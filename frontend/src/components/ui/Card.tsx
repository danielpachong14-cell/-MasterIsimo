import { cn } from "@/lib/utils"
import * as React from "react"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: 'elevated' | 'flat' | 'glass' }
>(({ className, variant = 'flat', ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl transition-all duration-300",
      variant === 'elevated' && "bg-surface-container-low shadow-ambient hover:shadow-float",
      variant === 'flat' && "bg-surface-container-low",
      variant === 'glass' && "glass-dark text-on-primary shadow-elevated",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
)
CardHeader.displayName = "CardHeader"

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-xl font-bold leading-none tracking-tight text-on-surface font-headline", className)} {...props} />
)
CardTitle.displayName = "CardTitle"

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-6 pt-0", className)} {...props} />
)
CardContent.displayName = "CardContent"

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardContent }
