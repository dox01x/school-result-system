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
    iconColor = "text-muted-foreground",
    title,
    subtitle,
    badge,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6", className)}>
            <div className="flex items-center gap-3 min-w-0">
                <Icon className={cn("h-5 w-5 shrink-0", iconColor)} strokeWidth={1.5} />
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
                            {title}
                        </h1>
                        {badge}
                    </div>
                    {subtitle && (
                        <p className="text-muted-foreground text-sm mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            {actions && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {actions}
                </div>
            )}
        </div>
    );
}
