"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
    GraduationCap,
    Loader2,
    Eye,
    EyeOff,
    ArrowRight,
    Lock,
    ShieldCheck,
} from "lucide-react";

const allowSignUp = process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawNext = searchParams.get("next") ?? "/dashboard";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
        ? rawNext
        : "/dashboard";
    const authError = searchParams.get("error");
    const reason = searchParams.get("reason");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const showedAuthError = useRef(false);

    useEffect(() => {
        if (authError === "auth" && !showedAuthError.current) {
            showedAuthError.current = true;
            toast.error("Sign-in link expired or is invalid. Please try again.");
        } else if (reason === "session_expired" && !showedAuthError.current) {
            showedAuthError.current = true;
            toast.info("Security session expired. Please sign in to continue.");
        }
    }, [authError, reason]);

    async function handleSignIn(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) {
            toast.error("Please enter both email and password.");
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });
            if (error) {
                toast.error(error.message);
                setLoading(false);
                return;
            }
            sessionStorage.setItem("edu_session_active", "true");
            toast.success("Signed in successfully");
            router.push(next);
            router.refresh();
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    }

    async function handleSignUp(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password || password.length < 6) {
            toast.error("Please use a valid email and password (minimum 6 characters).");
            return;
        }
        setLoading(true);
        try {
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
            toast.success("Verification link sent. Please check your email inbox.");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-foreground">
                    Email Address
                </Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@school.edu"
                    className="h-11 text-sm bg-muted/40 border-border focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                />
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-semibold text-foreground">
                        Password
                    </Label>
                </div>
                <div className="relative">
                    <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        disabled={loading}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 text-sm pr-10 bg-muted/40 border-border focus-visible:ring-1 focus-visible:ring-primary rounded-xl"
                        placeholder="••••••••"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={loading}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm group"
                disabled={loading}
            >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Authenticating...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <span>Sign In to Dashboard</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                )}
            </Button>

            {allowSignUp && (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 text-sm font-semibold border-border hover:bg-muted/50 rounded-xl transition-all"
                    disabled={loading}
                    onClick={handleSignUp}
                >
                    Create Account
                </Button>
            )}
        </form>
    );
}

export default function LoginPage() {
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-foreground antialiased p-4 sm:p-6">
            {/* Subtle institutional ambient background */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            {/* Login Card */}
            <div className="relative z-10 w-full max-w-[420px] mx-auto">
                <div className="rounded-2xl border border-border bg-card p-8 sm:p-10 shadow-lg space-y-6">
                    {/* Brand Header */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <GraduationCap size={28} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">EduPulse Pro</h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                School Management & Examination System
                            </p>
                        </div>
                    </div>

                    {/* Form Component */}
                    <Suspense fallback={<div className="h-44 rounded-xl bg-muted animate-pulse" />}>
                        <LoginForm />
                    </Suspense>

                    {/* Footer Security Tag */}
                    <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Enterprise Security</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            <span>SSL Encrypted</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
