"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface FormWrapperProps extends React.FormHTMLAttributes<HTMLFormElement> {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
}

export function FormWrapper({
  title,
  description,
  footer,
  children,
  className,
  ...props
}: FormWrapperProps) {
  return (
    <form className={cn("space-y-6", className)} {...props}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold tracking-tight">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="space-y-4">{children}</div>
      {footer && <div className="pt-4 flex items-center justify-end gap-3">{footer}</div>}
    </form>
  );
}
