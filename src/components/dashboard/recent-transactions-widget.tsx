"use client";

import Link from "next/link";
import { Receipt, ArrowRight, Banknote, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTaka } from "@/lib/finance-utils";

export interface TransactionItem {
  id: string;
  receiptNumber: string;
  studentName: string;
  roll?: string | null;
  className: string;
  feeType: string;
  amount: number;
  method: "CASH" | "ONLINE";
  rawMethod?: string;
  status: string;
  date: string;
  formattedDate: string;
}

interface Props {
  transactions: TransactionItem[];
  onSelectTransaction?: (tx: TransactionItem) => void;
}

export function RecentTransactionsWidget({
  transactions,
  onSelectTransaction,
}: Props) {
  return (
    <div className="bg-card rounded-2xl border border-border/80 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <Receipt size={16} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">Recent Collections</h3>
              <p className="text-xs text-muted-foreground">Real-time payment receipts</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs">
            <Link href="/finance/tuition/collect">
              Collect Fees <ArrowRight size={12} />
            </Link>
          </Button>
        </div>

        <div className="space-y-2.5">
          {transactions.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No recent collection receipts recorded
            </div>
          ) : (
            transactions.slice(0, 6).map((tx) => (
              <div
                key={tx.id}
                onClick={() => onSelectTransaction && onSelectTransaction(tx)}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/50 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[13px] font-semibold text-foreground truncate">{tx.studentName}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0 ${
                        tx.method === "ONLINE"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {tx.method === "ONLINE" ? (
                        <Globe size={10} className="inline mr-1" />
                      ) : (
                        <Banknote size={10} className="inline mr-1" />
                      )}
                      {tx.method}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {tx.className}{tx.roll ? ` · Roll ${tx.roll}` : ""} · Rec: {tx.receiptNumber} · {tx.formattedDate}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    +{formatTaka(tx.amount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
        <Link href="/finance/daily-closing" className="text-muted-foreground hover:text-foreground font-medium">
          Daily Reconciliation
        </Link>
        <Link href="/finance/report" className="text-primary font-semibold hover:underline flex items-center gap-0.5">
          All Receipts <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
