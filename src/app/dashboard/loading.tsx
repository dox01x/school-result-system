export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            {/* Welcome Banner Skeleton */}
            <div className="bg-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-border/50 shadow-none h-auto md:h-[136px]">
                <div className="space-y-3">
                    <div className="h-8 w-64 rounded-lg bg-muted" />
                    <div className="h-4 w-40 rounded-md bg-muted" />
                    <div className="h-6 w-48 rounded-md bg-muted mt-2" />
                </div>
                <div className="flex gap-2">
                    <div className="h-[72px] w-[120px] rounded-xl bg-muted" />
                    <div className="h-[72px] w-[120px] rounded-xl bg-muted" />
                </div>
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-2xl p-6 border border-border/50 shadow-none">
                        <div className="flex items-start justify-between mb-4">
                            <div className="h-12 w-12 rounded-xl bg-muted" />
                            <div className="h-4 w-4 rounded-md bg-muted" />
                        </div>
                        <div className="h-8 w-16 rounded-md bg-muted mb-2" />
                        <div className="h-3 w-24 rounded-md bg-muted" />
                    </div>
                ))}
            </div>

            {/* Middle Row Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-card rounded-2xl p-6 border border-border/50 shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-5 w-40 rounded-md bg-muted" />
                        <div className="h-6 w-16 rounded-full bg-muted" />
                    </div>
                    <div className="space-y-4 mt-6">
                        <div className="flex justify-between border-b border-border/50 pb-2">
                            <div className="h-3 w-12 rounded-md bg-muted" />
                            <div className="h-3 w-16 rounded-md bg-muted" />
                            <div className="h-3 w-16 rounded-md bg-muted" />
                        </div>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex justify-between items-center py-2">
                                <div className="flex items-center gap-3 w-1/3">
                                    <div className="h-8 w-8 rounded-full bg-muted" />
                                    <div className="space-y-1">
                                        <div className="h-4 w-20 rounded-md bg-muted" />
                                        <div className="h-3 w-12 rounded-md bg-muted" />
                                    </div>
                                </div>
                                <div className="h-4 w-12 rounded-md bg-muted" />
                                <div className="h-4 w-24 rounded-full bg-muted" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-4 bg-card rounded-2xl p-6 border border-border/50 shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-5 w-32 rounded-md bg-muted" />
                        <div className="h-4 w-12 rounded-md bg-muted" />
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center py-12">
                        <div className="h-32 w-32 rounded-xl bg-muted" />
                    </div>
                </div>
            </div>
        </div>
    );
}
