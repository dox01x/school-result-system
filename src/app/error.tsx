"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-5 bg-card p-8 rounded-2xl border border-destructive/20 shadow-lg">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Something went wrong!</h2>
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred while processing your request."}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button onClick={reset} variant="outline" className="gap-1.5">
            <RotateCcw className="w-4 h-4" /> Try Again
          </Button>
          <Button asChild className="gap-1.5">
            <Link href="/dashboard">
              <Home className="w-4 h-4" /> Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
