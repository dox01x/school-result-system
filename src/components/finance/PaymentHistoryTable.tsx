"use client";

import React, { useState } from "react";
import { formatTaka } from "@/lib/finance-utils";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Search, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PaymentHistoryItem {
  id: string;
  receipt_number: string;
  student_name?: string;
  class_name: string;
  section?: string;
  roll?: string;
  fee_type: string;
  amount_due: number;
  amount_paid: number;
  discount?: number;
  fine?: number;
  payment_method: string;
  payment_date: string;
  status: string;
  void_reason?: string;
  note?: string;
}

interface PaymentHistoryTableProps {
  payments: PaymentHistoryItem[];
  onViewReceipt: (payment: PaymentHistoryItem) => void;
  onVoidPayment?: (payment: PaymentHistoryItem) => void;
  showActions?: boolean;
}

export function PaymentHistoryTable({
  payments,
  onViewReceipt,
  onVoidPayment,
  showActions = true,
}: PaymentHistoryTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = payments.filter((p) => {
    const matchesSearch =
      !search ||
      p.receipt_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.student_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.roll || "").toLowerCase().includes(search.toLowerCase()) ||
      p.class_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "completed" && p.status === "completed") ||
      (statusFilter === "void" && (p.status === "void" || p.status === "refunded"));

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4 font-sans">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by receipt no, student, roll..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl bg-card"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44 rounded-xl bg-card">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="void">Void / Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Receipt No</th>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Fee Category</th>
                <th className="px-4 py-3 font-semibold text-right">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-center">Status</th>
                {showActions && <th className="px-4 py-3 font-semibold text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No payment records found.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const isVoid = p.status === "void" || p.status === "refunded";
                  return (
                    <tr
                      key={p.id || p.receipt_number}
                      className={`hover:bg-muted/30 transition-colors ${
                        isVoid ? "opacity-60 bg-muted/10" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {p.receipt_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{p.student_name || "N/A"}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.class_name} {p.section ? `(${p.section})` : ""} {p.roll ? `• Roll: ${p.roll}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-muted-foreground">
                        {p.fee_type.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {formatTaka(p.amount_paid)}
                      </td>
                      <td className="px-4 py-3 capitalize text-xs text-muted-foreground">
                        {p.payment_method.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {p.payment_date
                          ? new Date(p.payment_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PaymentStatusBadge status={isVoid ? "FAILED" : "SUCCESS"} />
                      </td>
                      {showActions && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 rounded-lg text-xs gap-1.5"
                              onClick={() => onViewReceipt(p)}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Receipt
                            </Button>
                            {!isVoid && onVoidPayment && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                                onClick={() => onVoidPayment(p)}
                                title="Void / Cancel Payment"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground bg-card rounded-2xl border border-border p-6">
            No payment records found.
          </div>
        ) : (
          filtered.map((p) => {
            const isVoid = p.status === "void" || p.status === "refunded";
            return (
              <Card
                key={p.id || p.receipt_number}
                className={`rounded-2xl border-border ${isVoid ? "opacity-60" : ""}`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-mono text-xs font-semibold text-primary">
                        {p.receipt_number}
                      </div>
                      <div className="font-semibold text-sm text-foreground">
                        {p.student_name || "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.class_name} {p.section ? `(${p.section})` : ""} {p.roll ? `• Roll: ${p.roll}` : ""}
                      </div>
                    </div>
                    <PaymentStatusBadge status={isVoid ? "FAILED" : "SUCCESS"} />
                  </div>

                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                    <span className="text-xs text-muted-foreground capitalize">
                      {p.fee_type.replace(/_/g, " ")} • {p.payment_method}
                    </span>
                    <span className="font-bold text-foreground">
                      {formatTaka(p.amount_paid)}
                    </span>
                  </div>

                  {showActions && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full rounded-xl text-xs gap-1.5"
                        onClick={() => onViewReceipt(p)}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        View Receipt
                      </Button>
                      {!isVoid && onVoidPayment && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-xl text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => onVoidPayment(p)}
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export default PaymentHistoryTable;
