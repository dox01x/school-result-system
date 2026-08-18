"use client";

import { FolderOpen } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";

interface EmptyTableStateProps {
  colSpan: number;
  message?: string;
  description?: string;
}

export function EmptyTableState({
  colSpan,
  message = "No records found",
  description = "Try adjusting your filters or search terms.",
}: EmptyTableStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-44 text-center">
        <div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
          <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
            <FolderOpen className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-sm font-medium text-foreground/80">{message}</p>
          {description && <p className="text-xs max-w-sm text-muted-foreground">{description}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}
