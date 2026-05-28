"use client";

import { useState, Suspense, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap, Loader2 } from "lucide-react";

const allowSignUp = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const next = searchParams.get("next") ?? "/dashboard";
    const authError = searchParams.get("error");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const supabase = useMemo(() => createClient(), []);
    const showedAuthError = useRef(false);

    useEffect(() => {
        if (authError === "auth" && !showedAuthError.current) {
            showedAuthError.current = true;
            toast.error("Sign-in link expired or is invalid. Try again.");
        }
    }, [authError]);

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) {
            toast.error("Enter email and password.");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
        });
        setLoading(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        router.push(next.startsWith("/") ? next : "/dashboard");
        router.refresh();
    }

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password || password.length < 6) {
            toast.error("Use a valid email and password (min 6 characters).");
            return;
        }
        setLoading(true);
        const origin = window.location.origin;
        const { error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        setLoading(false);
        if (error) {
            toast.error(error.message);
            return;
        }
        toast.success("Check your email to confirm your account, or sign in if already confirmed.");
    }

    return (
        <Card className="border-border/80 shadow-[var(--shadow-md)]">
            <CardHeader className="space-y-1 text-center pb-2">
                <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <GraduationCap className="h-8 w-8" strokeWidth={1.75} />
                </div>
                <CardTitle className="font-heading text-2xl tracking-tight">ResultPro</CardTitle>
                <CardDescription className="text-base">
                    Sign in to manage results, students, and school data.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11 text-base"
                            placeholder="you@school.edu"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 text-base"
                        />
                    </div>
                    <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                    </Button>
                    {allowSignUp && (
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 w-full text-base"
                            disabled={loading}
                            onClick={handleSignUp}
                        >
                            Create account
                        </Button>
                    )}
                </form>

            </CardContent>
        </Card>
    );
}

export default function LoginPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-md animate-fade-in">
                <Suspense fallback={<div className="h-48 rounded-xl bg-muted animate-pulse" />}>
                    <LoginForm />
                </Suspense>
            </div>
        </div>
    );
}
