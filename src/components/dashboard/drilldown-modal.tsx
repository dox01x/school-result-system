"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, Banknote, Globe, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatTaka } from "@/lib/finance-utils";
import type { TransactionItem } from "./recent-transactions-widget";

interface Props {
  transaction: TransactionItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function DrilldownModal({ transaction, isOpen, onClose }: Props) {
  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-5 sm:p-6 rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Receipt size={16} strokeWidth={2} />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Payment Receipt Detail
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Receipt: #{transaction.receiptNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Student Name</span>
              <span className="font-semibold text-foreground">{transaction.studentName}</span>
            </div>
            {transaction.roll && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Roll Number</span>
                <span className="font-medium text-foreground">{transaction.roll}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Class</span>
              <span className="font-medium text-foreground">{transaction.className}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Fee Type</span>
              <span className="font-medium text-foreground capitalize">{transaction.feeType}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Payment Method</span>
              <Badge
                variant="outline"
                className={`text-[10.5px] uppercase font-bold tracking-wider px-1.5 py-0 ${
                  transaction.method === "ONLINE"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                }`}
              >
                {transaction.method === "ONLINE" ? (
                  <Globe size={10} className="inline mr-1" />
                ) : (
                  <Banknote size={10} className="inline mr-1" />
                )}
                {transaction.method}
              </Badge>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Date & Time</span>
              <span className="font-medium text-foreground">{transaction.formattedDate}</span>
            </div>
            <div className="pt-2 border-t border-border/60 flex justify-between items-baseline">
              <span className="text-xs font-semibold text-foreground">Total Paid</span>
              <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatTaka(transaction.amount)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
          <Button size="sm" asChild className="text-xs gap-1.5">
            <Link href={`/finance/tuition/collect`}>
              Collect Another <ArrowRight size={13} />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
