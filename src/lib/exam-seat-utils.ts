export interface RoomCapacity {
    id: string;
    name: string;
    tables_count: number;
    seats_per_table: number;
    order_index: number;
    capacity: number; // calculated as tables_count * seats_per_table
}

export interface SectionDemand {
    class_id: string;
    section_id: string;
    student_count: number;
}

export interface SeatAllocation {
    room_id: string;
    class_id: string;
    section_id: string;
    allocated_students: number;
}

/**
 * Automatically allocates students to rooms based on capacity.
 * Attempts to keep students from the same section in the same or adjacent rooms.
 */
export function autoAllocateSeats(
    demands: SectionDemand[],
    rooms: RoomCapacity[]
): SeatAllocation[] {
    const allocations: SeatAllocation[] = [];
    
    // Sort rooms by order_index to try to keep them adjacent
    const sortedRooms = [...rooms].sort((a, b) => a.order_index - b.order_index);
    
    // Keep track of remaining capacity in each room
    const roomRemaining = new Map<string, number>();
    sortedRooms.forEach(r => roomRemaining.set(r.id, r.capacity));

    for (const demand of demands) {
        let studentsToPlace = demand.student_count;

        for (const room of sortedRooms) {
            if (studentsToPlace <= 0) break;

            const available = roomRemaining.get(room.id) || 0;
            if (available > 0) {
                const placed = Math.min(studentsToPlace, available);
                
                allocations.push({
                    room_id: room.id,
                    class_id: demand.class_id,
                    section_id: demand.section_id,
                    allocated_students: placed
                });

                roomRemaining.set(room.id, available - placed);
                studentsToPlace -= placed;
            }
        }
    }

    return allocations;
}
