import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] transition-colors overflow-hidden leading-tight",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border-primary/20",
        secondary:
          "bg-secondary text-secondary-foreground border-border/80",
        destructive:
          "bg-destructive/10 text-destructive border-destructive/20",
        outline:
          "border-border text-foreground bg-background",
        ghost: "text-muted-foreground border-transparent",
        link: "text-primary underline-offset-4 [a&]:hover:underline border-transparent",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
        info: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
