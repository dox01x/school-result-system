import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6 bg-card p-8 rounded-2xl border border-border shadow-lg">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-4xl font-extrabold text-primary tracking-tight">404</span>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Page Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4" /> Return Back
            </Link>
          </Button>
          <Button asChild className="gap-1.5">
            <Link href="/dashboard">
              <Home className="w-4 h-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
