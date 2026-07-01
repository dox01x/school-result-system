import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

/**
 * POST /api/marks/batch
 *
 * Server-side validated batch upsert of student marks.
 * 1. Validates all required fields are present
 * 2. Fetches subject config + exam overrides to determine real max marks
 * 3. Validates every entry against server-known max values
 * 4. Performs a single Supabase upsert with composite onConflict key
 */
export async function POST(req: NextRequest) {
    try {
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

        const supabase = (await createServerSupabaseClient()) as any;

        // ── 2. Fetch subject to get base max marks ──
        const { data: subject, error: subjectErr } = await supabase
            .from("subjects")
            .select("full_marks,theory_marks,mcq_marks,practical_marks,has_theory,has_mcq,has_practical")
            .eq("id", subject_id)
            .single();

        if (subjectErr || !subject) {
            return NextResponse.json(
                { error: "Subject not found" },
                { status: 404 }
            );
        }

        // ── 3. Check exam-specific overrides ──
        const { data: examConfig } = await supabase
            .from("exam_subject_config")
            .select("full_marks")
            .eq("exam_id", exam_id)
            .eq("subject_id", subject_id)
            .maybeSingle();

        const effectiveFullMarks = examConfig?.full_marks ?? subject.full_marks;

        // Guard against misconfigured subjects with zero full_marks
        if (!subject.full_marks || subject.full_marks <= 0) {
            return NextResponse.json(
                { error: "Subject has invalid full_marks (0 or negative). Please fix the subject configuration." },
                { status: 400 }
            );
        }

        const scaleFactor = effectiveFullMarks / subject.full_marks;
        const maxTheory = Math.round(subject.theory_marks * scaleFactor);
        const maxMcq = Math.round(subject.mcq_marks * scaleFactor);
        const maxPractical = Math.round(subject.practical_marks * scaleFactor);

        // ── 4. Validate every entry ──
        const validationErrors: string[] = [];

        for (let i = 0; i < entries.length; i++) {
            const e = entries[i];

            if (!e.student_id) {
                validationErrors.push(`Entry ${i}: missing student_id`);
                continue;
            }

            // Validate total
            if (typeof e.total !== "number" || e.total < 0 || e.total > effectiveFullMarks) {
                validationErrors.push(
                    `Entry ${i} (${e.student_id}): total ${e.total} out of range [0, ${effectiveFullMarks}]`
                );
            }

            // Validate theory if present
            if (e.theory !== null) {
                if (typeof e.theory !== "number" || e.theory < 0 || e.theory > maxTheory) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): theory ${e.theory} out of range [0, ${maxTheory}]`
                    );
                }
            }

            // Validate mcq if present
            if (e.mcq !== null) {
                if (typeof e.mcq !== "number" || e.mcq < 0 || e.mcq > maxMcq) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): mcq ${e.mcq} out of range [0, ${maxMcq}]`
                    );
                }
            }

            // Validate practical if present
            if (e.practical !== null) {
                if (typeof e.practical !== "number" || e.practical < 0 || e.practical > maxPractical) {
                    validationErrors.push(
                        `Entry ${i} (${e.student_id}): practical ${e.practical} out of range [0, ${maxPractical}]`
                    );
                }
            }
        }

        if (validationErrors.length > 0) {
            return NextResponse.json(
                { error: "Validation failed", details: validationErrors },
                { status: 400 }
            );
        }

        // ── 5. Build upsert rows (no client-provided `id` — always use onConflict) ──
        const upsertRows = entries.map((e) => ({
            student_id: e.student_id,
            subject_id,
            exam_id,
            academic_year,
            theory: e.theory,
            mcq: e.mcq,
            practical: e.practical,
            total: e.total,
        }));

        const { error: upsertErr } = await supabase
            .from("marks")
            .upsert(upsertRows, {
                onConflict: "student_id,subject_id,exam_id,academic_year",
            });

        if (upsertErr) {
            return NextResponse.json(
                { error: upsertErr.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, count: upsertRows.length });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
