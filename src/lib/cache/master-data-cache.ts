import { createClient } from "@/lib/supabase/client";
import {
    CLASS_COLUMNS,
    EXAM_COLUMNS,
    EXAM_SUBJECT_CONFIG_COLUMNS,
    GRADING_RULE_COLUMNS,
    SCHOOL_INFO_COLUMNS,
    SECTION_COLUMNS,
    SUBJECT_COLUMNS,
} from "@/lib/supabase/select-columns";
import type { Class, Section, Subject, Exam, GradingRule, SchoolInfo, ExamSubjectConfig } from "@/lib/database.types";
import { ALL_DEFAULT_GRADING } from "@/lib/constants/exam-defaults";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheStore {
    classes: { data: Class[]; timestamp: number } | null;
    sections: { data: Section[]; timestamp: number } | null;
    subjects: { data: Subject[]; timestamp: number } | null;
    exams: { data: Exam[]; timestamp: number } | null;
    schoolInfo: { data: SchoolInfo | null; timestamp: number } | null;
    gradingRules: { data: GradingRule[]; timestamp: number } | null;
    examConfigs: { data: ExamSubjectConfig[]; timestamp: number } | null;
}

const memoryCache: CacheStore = {
    classes: null,
    sections: null,
    subjects: null,
    exams: null,
    schoolInfo: null,
    gradingRules: null,
    examConfigs: null,
};

function isFresh<T>(item: { data: T; timestamp: number } | null): boolean {
    return !!item && (Date.now() - item.timestamp) < CACHE_TTL;
}

export async function getCachedClasses(): Promise<Class[]> {
    if (isFresh(memoryCache.classes)) {
        return memoryCache.classes!.data;
    }
    const supabase = createClient();
    const { data } = await supabase.from("classes").select(CLASS_COLUMNS).order("numeric_value");
    const result = data || [];
    memoryCache.classes = { data: result, timestamp: Date.now() };
    return result;
}

export async function getCachedSections(classId?: string): Promise<Section[]> {
    if (!isFresh(memoryCache.sections)) {
        const supabase = createClient();
        const { data } = await supabase.from("sections").select(SECTION_COLUMNS).order("name");
        memoryCache.sections = { data: data || [], timestamp: Date.now() };
    }
    const allSections = memoryCache.sections!.data;
    if (classId) {
        return allSections.filter((s) => s.class_id === classId);
    }
    return allSections;
}

export async function getCachedSubjects(classId?: string): Promise<Subject[]> {
    if (!isFresh(memoryCache.subjects)) {
        const supabase = createClient();
        const { data } = await supabase.from("subjects").select(SUBJECT_COLUMNS).order("name");
        memoryCache.subjects = { data: data || [], timestamp: Date.now() };
    }
    const allSubjects = memoryCache.subjects!.data;
    if (classId) {
        return allSubjects.filter((s) => s.class_id === classId);
    }
    return allSubjects;
}

export async function getCachedExams(): Promise<Exam[]> {
    if (isFresh(memoryCache.exams)) {
        return memoryCache.exams!.data;
    }
    const supabase = createClient();
    const { data } = await supabase.from("exams").select(EXAM_COLUMNS).order("term").order("exam_type");
    const result = data || [];
    memoryCache.exams = { data: result, timestamp: Date.now() };
    return result;
}

export async function getCachedSchoolInfo(): Promise<SchoolInfo | null> {
    if (isFresh(memoryCache.schoolInfo)) {
        return memoryCache.schoolInfo!.data;
    }
    const supabase = createClient();
    const { data } = await supabase.from("school_info").select(SCHOOL_INFO_COLUMNS).limit(1).maybeSingle();
    memoryCache.schoolInfo = { data: data || null, timestamp: Date.now() };
    return data || null;
}

export async function getCachedGradingRules(): Promise<GradingRule[]> {
    if (isFresh(memoryCache.gradingRules)) {
        return memoryCache.gradingRules!.data;
    }
    const supabase = createClient();
    const { data } = await supabase.from("grading_rules").select(GRADING_RULE_COLUMNS).order("min_marks", { ascending: false });
    const rawRules = (data || []) as GradingRule[];
    const ruleMap = new Map<string, GradingRule>();
    rawRules.forEach((rule) => {
        const key = `${rule.marks_category}_${rule.grade}`;
        if (!ruleMap.has(key)) ruleMap.set(key, rule);
    });
    const dedupedRules = Array.from(ruleMap.values());
    const result = dedupedRules.length > 0 ? dedupedRules : (ALL_DEFAULT_GRADING as unknown as GradingRule[]);
    memoryCache.gradingRules = { data: result, timestamp: Date.now() };
    return result;
}

export async function getCachedExamConfigs(): Promise<ExamSubjectConfig[]> {
    if (isFresh(memoryCache.examConfigs)) {
        return memoryCache.examConfigs!.data;
    }
    const supabase = createClient();
    const { data } = await supabase.from("exam_subject_config").select(EXAM_SUBJECT_CONFIG_COLUMNS);
    const result = data || [];
    memoryCache.examConfigs = { data: result, timestamp: Date.now() };
    return result;
}

export function invalidateMasterCache(key?: keyof CacheStore) {
    if (key) {
        memoryCache[key] = null;
    } else {
        Object.keys(memoryCache).forEach((k) => {
            memoryCache[k as keyof CacheStore] = null;
        });
    }
}
