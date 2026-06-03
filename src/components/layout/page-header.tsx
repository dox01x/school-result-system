import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
    icon: LucideIcon;
    iconBg?: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
};

export function PageHeader({
    icon: Icon,
    iconBg = "bg-muted",
    iconColor = "text-foreground",
    title,
    subtitle,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("flex items-start justify-between gap-4", className)}>
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading flex items-center gap-2.5">
                    <div className={cn("h-9 w-9 rounded-xl border border-border/50 flex items-center justify-center shrink-0", iconBg)}>
                        <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={1.2} />
                    </div>
                    {title}
                </h1>
                {subtitle && (
                    <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
                )}
            </div>
            {actions && (
                <div className="flex items-center gap-2 shrink-0">{actions}</div>
            )}
        </div>
    );
}
