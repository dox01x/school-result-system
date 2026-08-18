import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({ className, text }: { className?: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-2">
      <Loader2 className={cn("w-6 h-6 animate-spin text-primary", className)} />
      {text && <p className="text-xs text-muted-foreground">{text}</p>}
    </div>
  );
}
