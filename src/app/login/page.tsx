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
    Lock
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

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
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
            toast.error("Use a valid email and password (min 6 characters).");
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
            toast.success("Check your email to confirm your account, or sign in if already confirmed.");
        } catch {
            toast.error("An unexpected error occurred. Please try again.");
            setLoading(false);
        }
    }

    return (
        <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                    Email address
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
                    placeholder="admin@school.edu"
                    className="h-10 text-sm bg-background/90 border-border focus-visible:ring-1 focus-visible:ring-primary transition-all"
                />
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-foreground">
                    Password
                </Label>
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
                        className="h-10 text-sm pr-10 bg-background/90 border-border focus-visible:ring-1 focus-visible:ring-primary transition-all"
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
                className="w-full h-10 text-sm font-medium transition-all shadow-md group"
                disabled={loading}
            >
                {loading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Signing in...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <span>Sign in to Dashboard</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                )}
            </Button>

            {allowSignUp && (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 text-sm font-medium border-border hover:bg-muted/50 transition-all"
                    disabled={loading}
                    onClick={handleSignUp}
                >
                    Create account
                </Button>
            )}
        </form>
    );
}

export default function LoginPage() {
    return (
        <div className="relative min-h-screen w-full flex items-center justify-center bg-background text-foreground antialiased overflow-hidden selection:bg-primary/20 p-4 sm:p-6">
            
            {/* 🌌 Dynamic Ambient Corner Glow Orbs */}
            <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* 📐 CONTINUOUSLY ANIMATED INTELLECTUAL & SCIENTIFIC CANVAS BACKDROP */}
            <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
                
                {/* 1. Architectural Blueprint Grid Layer */}
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:32px_32px] opacity-60" />

                {/* 2. LIVE CONTINUOUS ANIMATED SVG VECTOR GEOMETRY & ATOM ENGINE */}
                <svg className="absolute inset-0 w-full h-full stroke-primary/20 dark:stroke-primary/30 fill-none" xmlns="http://www.w3.org/2000/svg">
                    
                    {/* ⚛️ ATOM MODEL WITH CONTINUOUSLY ORBITING ELECTRONS (Top Right) */}
                    <g transform="translate(1120, 80)">
                        {/* Orbital Ellipses */}
                        <ellipse cx="70" cy="70" rx="65" ry="24" strokeWidth="1.5" transform="rotate(0 70 70)" />
                        <ellipse cx="70" cy="70" rx="65" ry="24" strokeWidth="1.5" transform="rotate(60 70 70)" />
                        <ellipse cx="70" cy="70" rx="65" ry="24" strokeWidth="1.5" transform="rotate(120 70 70)" />
                        
                        {/* Orbiting Electron 1 (Horizontal Ring) */}
                        <g transform="translate(70, 70)" className="animate-[spin_3s_linear_infinite]">
                            <circle cx="65" cy="0" r="4.5" className="fill-emerald-500 stroke-emerald-300" />
                        </g>

                        {/* Orbiting Electron 2 (60deg Ring - Reverse) */}
                        <g transform="translate(70, 70)" className="animate-[spin_5s_linear_infinite_reverse]">
                            <circle cx="-32.5" cy="56.3" r="4.5" className="fill-indigo-500 stroke-indigo-300" />
                        </g>

                        {/* Orbiting Electron 3 (120deg Ring) */}
                        <g transform="translate(70, 70)" className="animate-[spin_7s_linear_infinite]">
                            <circle cx="-32.5" cy="-56.3" r="4.5" className="fill-purple-500 stroke-purple-300" />
                        </g>

                        {/* Pulsing Nucleus */}
                        <circle cx="70" cy="70" r="9" className="fill-primary/60 stroke-primary animate-pulse" />
                        <text x="25" y="160" className="fill-emerald-600 dark:fill-emerald-400 font-mono text-[10px]">⚛ Active Atom Orbit</text>
                    </g>

                    {/* 🔄 REVOLVING RADIAL POINT ON POLAR CIRCLE (Middle Right) */}
                    <g transform="translate(1140, 360)">
                        <circle cx="70" cy="70" r="55" strokeWidth="1.5" strokeDasharray="3 3" />
                        <circle cx="70" cy="70" r="30" strokeWidth="1" strokeDasharray="2 2" />
                        <line x1="15" y1="70" x2="125" y2="70" strokeWidth="1" opacity="0.4" />
                        <line x1="70" y1="15" x2="70" y2="125" strokeWidth="1" opacity="0.4" />
                        
                        {/* Revolving Radius Arm & Dot */}
                        <g transform="translate(70, 70)" className="animate-[spin_6s_linear_infinite]">
                            <line x1="0" y1="0" x2="55" y2="0" strokeWidth="1.5" className="stroke-primary" />
                            <circle cx="55" cy="0" r="5" className="fill-primary animate-ping" />
                            <circle cx="55" cy="0" r="5" className="fill-primary" />
                        </g>
                        <circle cx="70" cy="70" r="3" className="fill-foreground" />
                        <text x="20" y="148" className="fill-primary font-mono text-[10px]">r · e^(iθ) Orbiting</text>
                    </g>

                    {/* 🌀 FIBONACCI GOLDEN SPIRAL WITH PULSING CURVE (Top Left) */}
                    <g transform="translate(70, 80)">
                        <path d="M 0 160 A 160 160 0 0 1 160 0 A 100 100 0 0 1 260 100 A 60 60 0 0 1 200 160 A 40 40 0 0 1 160 120" strokeWidth="1.5" strokeDasharray="5 5" className="animate-pulse" />
                        <rect x="0" y="0" width="260" height="160" strokeWidth="1" opacity="0.3" />
                        <line x1="160" y1="0" x2="160" y2="160" strokeWidth="1" opacity="0.3" />
                        <line x1="160" y1="100" x2="260" y2="100" strokeWidth="1" opacity="0.3" />
                        
                        {/* Moving Point along Spiral Box */}
                        <g transform="translate(160, 100)" className="animate-[spin_8s_linear_infinite]">
                            <circle cx="40" cy="0" r="4" className="fill-amber-500 animate-pulse" />
                        </g>
                        <text x="15" y="30" className="fill-primary/80 font-mono text-[11px] font-bold">ϕ = 1.618033 (Golden Ratio)</text>
                    </g>

                    {/* 🧊 CONTINUOUSLY ROTATING 3D ISOMETRIC POLYHEDRON (Bottom Left) */}
                    <g transform="translate(90, 510)" className="origin-center animate-[spin_40s_linear_infinite]">
                        <polygon points="70,10 130,45 130,115 70,150 10,115 10,45" strokeWidth="1.5" />
                        <line x1="70" y1="10" x2="70" y2="150" strokeWidth="1" />
                        <line x1="10" y1="45" x2="130" y2="115" strokeWidth="1" />
                        <line x1="10" y1="115" x2="130" y2="45" strokeWidth="1" />
                        <polygon points="70,45 105,65 105,95 70,115 35,95 35,65" strokeWidth="1" strokeDasharray="2 2" />
                    </g>

                    {/* 〰️ FLOWING SINE WAVE FREQUENCY (Bottom Right) */}
                    <g transform="translate(1040, 530)">
                        <path d="M0,60 Q80,10 160,60 T320,60 T480,60" strokeWidth="1.5" strokeDasharray="6 6" className="animate-pulse" />
                        <path d="M0,60 Q80,110 160,60 T320,60 T480,60" strokeWidth="1" opacity="0.4" />
                        
                        {/* Wave pulse dot */}
                        <g className="animate-[bounce_2s_infinite]">
                            <circle cx="160" cy="60" r="4" className="fill-purple-500" />
                        </g>
                        <text x="10" y="25" className="fill-muted-foreground font-mono text-[10px]">f(x) = A · sin(ωt + ϕ)</text>
                    </g>
                </svg>

                {/* 3. 🏷️ ELEGANT INTELLECTUAL FORMULA BADGES WITH LIVE PULSES */}
                <div className="hidden lg:block">
                    {/* Equation 1: GPA Formula */}
                    <div className="absolute top-32 left-72 px-4 py-2 rounded-xl bg-card/85 border border-primary/25 shadow-sm backdrop-blur-md text-xs font-mono text-primary font-bold hover:scale-105 transition-all">
                        <span className="h-2 w-2 rounded-full bg-primary inline-block mr-2 animate-ping" />
                        GPA = ∑(GP × Cr) / ∑Cr
                    </div>

                    {/* Equation 2: Pythagorean */}
                    <div className="absolute top-48 right-72 px-4 py-2 rounded-xl bg-card/85 border border-border/80 shadow-sm backdrop-blur-md text-xs font-mono text-foreground font-semibold hover:scale-105 transition-all">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 inline-block mr-2 animate-pulse" />
                        a² + b² = c²
                    </div>

                    {/* Equation 3: Energy Equation */}
                    <div className="absolute bottom-40 left-80 px-4 py-2 rounded-xl bg-card/85 border border-emerald-500/30 shadow-sm backdrop-blur-md text-xs font-mono text-emerald-600 dark:text-emerald-400 font-medium hover:scale-105 transition-all">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block mr-2 animate-ping" />
                        E = mc² • Energy-Mass
                    </div>

                    {/* Equation 4: Calculus */}
                    <div className="absolute bottom-32 right-64 px-4 py-2 rounded-xl bg-card/85 border border-purple-500/30 shadow-sm backdrop-blur-md text-xs font-mono text-purple-600 dark:text-purple-400 font-bold hover:scale-105 transition-all">
                        <span className="h-2 w-2 rounded-full bg-purple-500 inline-block mr-2 animate-pulse" />
                        ∫ f(x) dx • Academic Matrix
                    </div>
                </div>
            </div>

            {/* 🔒 MAIN CENTERED ELEVATED GLASS LOGIN CARD */}
            <div className="relative z-10 w-full max-w-[400px] mx-auto my-auto">
                <div className="relative rounded-2xl border border-border/90 bg-card/95 backdrop-blur-xl p-7 sm:p-9 shadow-2xl space-y-6">

                    {/* Brand Header */}
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center shadow-lg shadow-primary/25">
                            <GraduationCap size={26} strokeWidth={2.2} className="text-primary-foreground" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">EduPulse Pro</h1>
                            <p className="text-xs text-muted-foreground mt-1">
                                Next-Gen School Result & Management System
                            </p>
                        </div>
                    </div>

                    {/* Login Form Component */}
                    <Suspense fallback={<div className="h-44 rounded-xl bg-muted animate-pulse" />}>
                        <LoginForm />
                    </Suspense>

                    {/* Footer Security Tag */}
                    <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5 text-emerald-500" />
                            <span>256-bit SSL Protected</span>
                        </div>
                        <span>EduPulse © {new Date().getFullYear()}</span>
                    </div>
                </div>
            </div>

        </div>
    );
}







