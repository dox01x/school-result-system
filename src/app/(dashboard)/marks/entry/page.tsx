"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarksEntryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/marks");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-muted-foreground">Redirecting to Marks Entry…</p>
    </div>
  );
}
