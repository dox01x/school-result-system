"use client";

import Link from "next/link";
import { User, Phone, Hash, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/types/student";

export function StudentCard({ student }: { student: Student }) {
  return (
    <Card className="hover:shadow-md transition-all border-border/60 hover:border-primary/40 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg border border-primary/20">
              {student.name ? student.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <Link href={`/students/${student.id}`} className="font-semibold text-base hover:text-primary transition-colors line-clamp-1">
                {student.name}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3 text-primary" /> Roll: {student.roll || student.roll_number}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-muted-foreground" /> {student.classes?.name || "Class"}
                </span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] capitalize">
            {student.status || "Active"}
          </Badge>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          {(student.phone || student.guardian_phone) && (
            <div className="flex items-center gap-1.5 truncate">
              <Phone className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
              <span className="truncate">{student.phone || student.guardian_phone}</span>
            </div>
          )}
          {student.blood_group && (
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-destructive">Blood:</span> {student.blood_group}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
