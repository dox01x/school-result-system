export default function DashboardLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Welcome Banner Skeleton */}
            <div className="rounded-2xl bg-muted h-28 w-full" />

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div className="h-10 w-10 rounded-xl bg-muted" />
                            <div className="h-4 w-4 rounded bg-muted" />
                        </div>
                        <div className="h-8 w-14 rounded bg-muted mb-1" />
                        <div className="h-3 w-20 rounded bg-muted mt-2" />
                    </div>
                ))}
            </div>

            {/* Middle Row Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card rounded-2xl p-5 border border-border shadow-sm">
                    <div className="h-4 w-32 rounded bg-muted mb-4" />
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="h-10 w-full rounded bg-muted/50" />
                        ))}
                    </div>
                </div>
                <div className="bg-card rounded-2xl p-5 border border-border shadow-sm">
                    <div className="h-4 w-24 rounded bg-muted mb-4" />
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-12 w-full rounded bg-muted/50" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
