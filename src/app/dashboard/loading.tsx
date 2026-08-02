export default function DashboardLoading() {
    return (
        <div className="flex flex-col gap-6 animate-pulse">
            {/* Welcome area */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-6 w-48 rounded-lg bg-muted" />
                    <div className="h-4 w-32 rounded-md bg-muted" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card rounded-xl p-5 border border-border">
                        <div className="h-4 w-20 rounded-md bg-muted mb-3" />
                        <div className="h-7 w-14 rounded-md bg-muted" />
                    </div>
                ))}
            </div>

            {/* Content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 bg-card rounded-xl p-5 border border-border">
                    <div className="h-5 w-36 rounded-md bg-muted mb-6" />
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="h-4 w-24 rounded-md bg-muted" />
                                <div className="h-3 flex-1 rounded-full bg-muted" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="lg:col-span-4 bg-card rounded-xl p-5 border border-border">
                    <div className="h-5 w-28 rounded-md bg-muted mb-6" />
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-lg bg-muted" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
