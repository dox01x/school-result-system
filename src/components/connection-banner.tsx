"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function ConnectionBanner() {
    const [status, setStatus] = useState<"loading" | "connected" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        (async () => {
            try {
                const { error } = await supabase.from("classes").select("id", { count: "exact", head: true });
                if (error) {
                    setStatus("error");
                    setErrorMsg(error.message);
                } else {
                    setStatus("connected");
                }
            } catch (err: unknown) {
                setStatus("error");
                setErrorMsg(err instanceof Error ? err.message : "Connection failed");
            }
        })();
    }, [supabase]);

    if (status === "loading") return null;
    if (status === "connected") return null;

    return (
        <Card className="border-destructive bg-destructive/5" role="alert">
            <CardContent className="flex items-start gap-3 py-4">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                    <p className="text-sm font-medium text-destructive">Supabase not connected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        To use this app, you need to:
                    </p>
                    <ol className="text-xs text-muted-foreground mt-1 list-decimal ml-4 space-y-0.5">
                        <li>Create a free project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a></li>
                        <li>Run <code className="bg-muted px-1 rounded">src/lib/schema.sql</code> in your Supabase SQL Editor</li>
                        <li>Copy your Project URL and anon key into <code className="bg-muted px-1 rounded">.env.local</code></li>
                        <li>Restart the dev server (<code className="bg-muted px-1 rounded">npm run dev</code>)</li>
                    </ol>
                    {errorMsg && (
                        <p className="text-xs text-destructive/70 mt-2 font-mono">{errorMsg}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
