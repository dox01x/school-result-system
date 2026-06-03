// Conflict detection logic for class routine module (pure functions)

interface RoutineEntry {
  id: string;
  teacher_id: string;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  class_id: string;
  section_id: string;
  subject_id: string;
  // Optional joined names for display
  teacher_name?: string;
  class_name?: string;
  section_name?: string;
  subject_name?: string;
  room_name?: string;
}

interface Conflict {
  type: "teacher" | "room";
  entity_name: string;
  day_of_week: number;
  entries: {
    id: string;
    class_name: string;
    section_name: string;
    subject_name: string;
    start_time: string;
    end_time: string;
  }[];
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function timesOverlap(
  s1: string,
  e1: string,
  s2: string,
  e2: string
): boolean {
  const a1 = timeToMinutes(s1),
    b1 = timeToMinutes(e1);
  const a2 = timeToMinutes(s2),
    b2 = timeToMinutes(e2);
  return a1 < b2 && a2 < b1;
}

/**
 * Detect all teacher and room conflicts in a set of routine entries.
 * Ignores an entry by its own id (so editing doesn't conflict with itself).
 */
export function detectConflicts(
  entries: RoutineEntry[],
  excludeId?: string
): Conflict[] {
  const conflicts: Conflict[] = [];
  const filtered = excludeId
    ? entries.filter((e) => e.id !== excludeId)
    : entries;

  // Group by teacher + day
  const teacherDayMap = new Map<string, RoutineEntry[]>();
  for (const entry of filtered) {
    const key = `${entry.teacher_id}__${entry.day_of_week}`;
    if (!teacherDayMap.has(key)) teacherDayMap.set(key, []);
    teacherDayMap.get(key)!.push(entry);
  }

  // Check teacher conflicts
  for (const [, group] of teacherDayMap) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (
          timesOverlap(
            group[i].start_time,
            group[i].end_time,
            group[j].start_time,
            group[j].end_time
          )
        ) {
          const existing = conflicts.find(
            (c) =>
              c.type === "teacher" &&
              c.entity_name === (group[i].teacher_name || group[i].teacher_id) &&
              c.day_of_week === group[i].day_of_week
          );
          if (existing) {
            if (!existing.entries.find((e) => e.id === group[j].id)) {
              existing.entries.push({
                id: group[j].id,
                class_name: group[j].class_name || "",
                section_name: group[j].section_name || "",
                subject_name: group[j].subject_name || "",
                start_time: group[j].start_time,
                end_time: group[j].end_time,
              });
            }
          } else {
            conflicts.push({
              type: "teacher",
              entity_name: group[i].teacher_name || group[i].teacher_id,
              day_of_week: group[i].day_of_week,
              entries: [
                {
                  id: group[i].id,
                  class_name: group[i].class_name || "",
                  section_name: group[i].section_name || "",
                  subject_name: group[i].subject_name || "",
                  start_time: group[i].start_time,
                  end_time: group[i].end_time,
                },
                {
                  id: group[j].id,
                  class_name: group[j].class_name || "",
                  section_name: group[j].section_name || "",
                  subject_name: group[j].subject_name || "",
                  start_time: group[j].start_time,
                  end_time: group[j].end_time,
                },
              ],
            });
          }
        }
      }
    }
  }

  // Group by room + day
  const roomDayMap = new Map<string, RoutineEntry[]>();
  for (const entry of filtered) {
    if (!entry.room_id) continue;
    const key = `${entry.room_id}__${entry.day_of_week}`;
    if (!roomDayMap.has(key)) roomDayMap.set(key, []);
    roomDayMap.get(key)!.push(entry);
  }

  // Check room conflicts
  for (const [, group] of roomDayMap) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (
          timesOverlap(
            group[i].start_time,
            group[i].end_time,
            group[j].start_time,
            group[j].end_time
          )
        ) {
          const existing = conflicts.find(
            (c) =>
              c.type === "room" &&
              c.entity_name === (group[i].room_name || group[i].room_id || "") &&
              c.day_of_week === group[i].day_of_week
          );
          if (existing) {
            if (!existing.entries.find((e) => e.id === group[j].id)) {
              existing.entries.push({
                id: group[j].id,
                class_name: group[j].class_name || "",
                section_name: group[j].section_name || "",
                subject_name: group[j].subject_name || "",
                start_time: group[j].start_time,
                end_time: group[j].end_time,
              });
            }
          } else {
            conflicts.push({
              type: "room",
              entity_name: group[i].room_name || group[i].room_id || "",
              day_of_week: group[i].day_of_week,
              entries: [
                {
                  id: group[i].id,
                  class_name: group[i].class_name || "",
                  section_name: group[i].section_name || "",
                  subject_name: group[i].subject_name || "",
                  start_time: group[i].start_time,
                  end_time: group[i].end_time,
                },
                {
                  id: group[j].id,
                  class_name: group[j].class_name || "",
                  section_name: group[j].section_name || "",
                  subject_name: group[j].subject_name || "",
                  start_time: group[j].start_time,
                  end_time: group[j].end_time,
                },
              ],
            });
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Quick single-entry conflict check: does the given entry conflict
 * with any entry in the existing list?
 */
export function checkSingleEntryConflict(
  newEntry: {
    teacher_id: string;
    room_id: string | null;
    day_of_week: number;
    start_time: string;
    end_time: string;
    id?: string;
  },
  existingEntries: RoutineEntry[]
): { teacherConflict: RoutineEntry | null; roomConflict: RoutineEntry | null } {
  let teacherConflict: RoutineEntry | null = null;
  let roomConflict: RoutineEntry | null = null;

  for (const entry of existingEntries) {
    if (newEntry.id && entry.id === newEntry.id) continue;
    if (entry.day_of_week !== newEntry.day_of_week) continue;

    if (
      entry.teacher_id === newEntry.teacher_id &&
      timesOverlap(
        newEntry.start_time,
        newEntry.end_time,
        entry.start_time,
        entry.end_time
      )
    ) {
      teacherConflict = entry;
    }

    if (
      newEntry.room_id &&
      entry.room_id === newEntry.room_id &&
      timesOverlap(
        newEntry.start_time,
        newEntry.end_time,
        entry.start_time,
        entry.end_time
      )
    ) {
      roomConflict = entry;
    }
  }

  return { teacherConflict, roomConflict };
}
