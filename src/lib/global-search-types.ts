export type GlobalSearchHit = {
    type: "student" | "teacher" | "class" | "subject" | "exam" | "notice";
    id: string;
    title: string;
    subtitle: string | null;
    href: string;
};
