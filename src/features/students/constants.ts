export const STUDENT_STATUSES = [
  { value: "active", label: "Active", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800" },
  { value: "inactive", label: "Inactive", color: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800" },
  { value: "graduated", label: "Graduated", color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800" },
  { value: "transferred", label: "Transferred", color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800" },
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export const GENDERS = ["male", "female", "other"] as const;
