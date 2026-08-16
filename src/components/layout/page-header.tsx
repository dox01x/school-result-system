import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
    icon: LucideIcon;
    iconBg?: string;
    iconColor?: string;
    title: string;
    subtitle?: string;
    badge?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
};

export function PageHeader({
    icon: Icon,
    iconBg = "bg-primary/10 border-primary/20 text-primary",
    iconColor,
    title,
    subtitle,
    badge,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2 border-b border-border/40", className)}>
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div className={cn("p-2 sm:p-2.5 rounded-xl border shrink-0 shadow-xs flex items-center justify-center", iconBg)}>
                    <Icon className={cn("h-5 w-5", iconColor)} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                            {title}
                        </h1>
                        {badge}
                    </div>
                    {subtitle && (
                        <p className="text-muted-foreground text-xs sm:text-[13px] mt-0.5 leading-normal">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap pt-1 sm:pt-0">
                    {actions}
                </div>
            )}
        </div>
    );
}
