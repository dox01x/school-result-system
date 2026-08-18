export const EXAM_TERMS = [
  { value: "1st_term", label: "1st Term" },
  { value: "2nd_term", label: "2nd Term" },
  { value: "final_term", label: "Final Term" },
  { value: "test", label: "Test Exam" },
] as const;

export const EXAM_STATUS_COLORS = {
  draft: "bg-slate-500/10 text-slate-600 border-slate-200",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-200",
  in_progress: "bg-amber-500/10 text-amber-600 border-amber-200",
  completed: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  published: "bg-primary/10 text-primary border-primary/20",
};
