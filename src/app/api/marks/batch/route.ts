import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

/** Shape of a single mark entry in the batch request body. */
interface MarkEntryPayload {
    student_id: string;
    theory: number | null;
    mcq: number | null;
    practical: number | null;
    total: number;
}

/** Expected JSON body for POST /api/marks/batch */
interface BatchMarksBody {
    subject_id: string;
    exam_id: string;
    academic_year: string;
    entries: MarkEntryPayload[];
}

interface SubjectRecord {
    full_marks: number;
    theory_marks: number;
    mcq_marks: number;
    practical_marks: number;
    has_theory: boolean;
    has_mcq: boolean;
    has_practical: boolean;
}

/**
 * POST /api/marks/batch
 *
 * Server-side validated batch upsert of student marks.
 * 1. Authenticates request using requireAuth guard
 * 2. Validates all required fields are present
 * 3. Fetches subject config + exam overrides to determine real max marks
 * 4. Validates every entry against component flags & max values
 * 5. Performs a deduplicated single Supabase upsert with composite onConflict key
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await requireAuth();
        if (auth instanceof NextResponse) return auth;
        const { supabase } = auth;

        const body = (await req.json()) as BatchMarksBody;
        const { subject_id, exam_id, academic_year, entries } = body;

        // ── 1. Basic field validation ──
        if (!subject_id || !exam_id || !academic_year) {
            return NextResponse.json(
                { error: "subject_id, exam_id, and academic_year are required" },
                { status: 400 }
            );
        }
        if (!Array.isArray(entries) || entries.length === 0) {
            return NextResponse.json(
                { error: "entries must be a non-empty array" },
                { status: 400 }
            );
        }

        // Deduplicate entries by student_id (keep last entry)
        const entriesMap = new Map<string, MarkEntryPayload>();
        for (const entry of entries) {
            if (entry && entry.student_id) {
                entriesMap.set(entry.student_id, entry);
            }
        }
        const uniqueEntries = Array.from(entriesMap.values());

        if (uniqueEntries.length === 0) {
            return NextResponse.json(
                { error: "No valid student entries found in request" },
                { status: 400 }
            );
        }

        // ── 2. Fetch subject to get base max marks ──
        const { data: rawSubject, error: subjectErr } = await supabase
            .from("subjects")
            .select("full_marks,theory_marks,mcq_marks,practical_marks,has_theory,has_mcq,has_practical")
            .eq("id", subject_id)
            .single();

        if (subjectErr || !rawSubject) {
            return NextResponse.json(
                { error: "Subject not found" },
                { status: 404 }
            );
        }

        const subject = rawSubject as SubjectRecord;

        // ── 3. Check exam-specific overrides ──
        const { data: examConfig } = await supabase
            .from("exam_subject_config")
            .select("full_marks")
            .eq("exam_id", exam_id)
            .eq("subject_id", subject_id)
            .maybeSingle();

        const effectiveFullMarks = (examConfig as { full_marks?: number } | null)?.full_marks ?? subject.full_marks;

        // Guard against misconfigured subjects with zero full_marks
        if (!subject.full_marks || subject.full_marks <= 0) {
            return NextResponse.json(
                { error: "Subject has invalid full_marks (0 or negative). Please fix the subject configuration." },
                { status: 400 }
            );
        }

        const scaleFactor = effectiveFullMarks / subject.full_marks;
        const maxTheory = subject.has_theory ? Math.round((subject.theory_marks || 0) * scaleFactor) : 0;
        const maxMcq = subject.has_mcq ? Math.round((subject.mcq_marks || 0) * scaleFactor) : 0;
        const maxPractical = subject.has_practical ? Math.round((subject.practical_marks || 0) * scaleFactor) : 0;

        // ── 4. Validate every entry ──
        const validationErrors: string[] = [];
        const validatedUpsertRows: {
            student_id: string;
            subject_id: string;
            exam_id: string;
            academic_year: string;
            theory: number | null;
            mcq: number | null;
            practical: number | null;
            total: number;
        }[] = [];

        for (let i = 0; i < uniqueEntries.length; i++) {
            const e = uniqueEntries[i];

            if (!e.student_id) {
                validationErrors.push(`Entry ${i}: missing student_id`);
                continue;
            }

            // Validate theory component flags and boundaries
            if (!subject.has_theory && e.theory !== null && e.theory !== undefined) {
                validationErrors.push(`Entry ${i} (${e.student_id}): theory marks provided for a subject that has no theory component`);
            } else if (e.theory !== null && e.theory !== undefined) {
                if (typeof e.theory !== "number" || e.theory < 0 || e.theory > maxTheory) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): theory ${e.theory} out of range [0, ${maxTheory}]`
                    );
                }
            }

            // Validate MCQ component flags and boundaries
            if (!subject.has_mcq && e.mcq !== null && e.mcq !== undefined) {
                validationErrors.push(`Entry ${i} (${e.student_id}): MCQ marks provided for a subject that has no MCQ component`);
            } else if (e.mcq !== null && e.mcq !== undefined) {
                if (typeof e.mcq !== "number" || e.mcq < 0 || e.mcq > maxMcq) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): mcq ${e.mcq} out of range [0, ${maxMcq}]`
                    );
                }
            }

            // Validate practical component flags and boundaries
            if (!subject.has_practical && e.practical !== null && e.practical !== undefined) {
                validationErrors.push(`Entry ${i} (${e.student_id}): practical marks provided for a subject that has no practical component`);
            } else if (e.practical !== null && e.practical !== undefined) {
                if (typeof e.practical !== "number" || e.practical < 0 || e.practical > maxPractical) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): practical ${e.practical} out of range [0, ${maxPractical}]`
                    );
                }
            }

            // Calculate & verify total sum consistency
            const computedTotal = (e.theory ?? 0) + (e.mcq ?? 0) + (e.practical ?? 0);
            const totalToUse = (e.theory !== null || e.mcq !== null || e.practical !== null)
                ? computedTotal
                : Number(e.total);

            if (typeof totalToUse !== "number" || isNaN(totalToUse) || totalToUse < 0 || totalToUse > effectiveFullMarks) {
                validationErrors.push(
                    `Entry ${i} (${e.student_id}): total ${totalToUse} out of range [0, ${effectiveFullMarks}]`
                );
            }

            validatedUpsertRows.push({
                student_id: e.student_id,
                subject_id,
                exam_id,
                academic_year,
                theory: subject.has_theory ? e.theory : null,
                mcq: subject.has_mcq ? e.mcq : null,
                practical: subject.has_practical ? e.practical : null,
                total: totalToUse,
            });
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                { error: "Validation failed", details: validationErrors },
                { status: 400 }
            );
        }

        // ── 5. Build upsert rows & execute ──
        const { error: upsertErr } = await supabase
            .from("marks")
            .upsert(validatedUpsertRows, {
                onConflict: "student_id,subject_id,exam_id,academic_year",
            });

        if (upsertErr) {
            return NextResponse.json(
                { error: upsertErr.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, count: validatedUpsertRows.length });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
