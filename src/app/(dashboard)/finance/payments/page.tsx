'use client';

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaymentHistoryTable } from "@/components/finance/PaymentHistoryTable";
import PrintReceipt from "@/components/finance/PrintReceipt";
import { createClient } from "@/lib/supabase/client";
import { formatTaka, getMonthName, roundCurrency } from "@/lib/finance-utils";
import { ReceiptFormat, generateTuitionReceiptHtml } from "@/lib/finance-receipt-template";
import { printHtml } from "@/lib/print-utils";
import {
  CreditCard,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  PlusCircle,
  Receipt,
  FileText,
  Loader2,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function PaymentsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<any[]>([]);
  const [unsettledOrders, setUnsettledOrders] = useState<any[]>([]);
  const [schoolInfo, setSchoolInfo] = useState<any>(null);

  // Statistics
  const [stats, setStats] = useState({
    totalCollected: 0,
    totalCompletedCount: 0,
    totalVoidCount: 0,
    totalPendingCount: 0,
  });

  // Receipt Modal State
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptFormat, setReceiptFormat] = useState<ReceiptFormat>("standard");

  // Voiding Dialog State
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<any>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);

  // Reconciliation Scan State
  const [reconciling, setReconciling] = useState(false);

  // Load Payments & Orders
  const loadData = async () => {
    try {
      setLoading(true);
      const [paymentsRes, ordersRes, schoolRes] = await Promise.all([
        supabase
          .from("tuition_payments")
          .select("*, students(name, roll, classes(name), sections(name))")
          .order("payment_date", { ascending: false })
          .limit(100),
        (supabase as any)
          .from("payment_orders")
          .select("*")
          .in("status", ["PENDING", "PROCESSING", "VERIFICATION_REQUIRED", "INITIATED"])
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("school_info")
          .select("name, address, phone, logo_url")
          .limit(1)
          .maybeSingle(),
      ]);

      const rawPayments = paymentsRes.data || [];
      const formattedPayments = rawPayments.map((p: any) => ({
        ...p,
        student_name: p.student_name || p.students?.name || "Student",
        class_name: p.class_name || p.students?.classes?.name || "N/A",
        section: p.section || p.students?.sections?.name || "",
        roll: p.roll || p.students?.roll || "",
      }));

      setPayments(formattedPayments);
      setUnsettledOrders(ordersRes.data || []);
      if (schoolRes.data) setSchoolInfo(schoolRes.data);

      // Compute statistics
      let collected = 0;
      let completedCount = 0;
      let voidCount = 0;

      formattedPayments.forEach((p: any) => {
        const isVoid = p.status === "void" || p.status === "refunded";
        if (isVoid) {
          voidCount++;
        } else {
          completedCount++;
          collected = roundCurrency(collected + Number(p.amount_paid || 0));
        }
      });

      setStats({
        totalCollected: collected,
        totalCompletedCount: completedCount,
        totalVoidCount: voidCount,
        totalPendingCount: (ordersRes.data || []).length,
      });
    } catch (err: any) {
      console.error("Error loading payments:", err);
      toast.error("Failed to load payment records.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // View Receipt
  const handleViewReceipt = (p: any) => {
    const isVoid = p.status === "void" || p.status === "refunded";
    const receiptData = {
      school: schoolInfo || { name: "School Name", address: "Address", phone: "Phone" },
      receipt_number: p.receipt_number,
      student: {
        name: p.student_name,
        class_name: p.class_name,
        section: p.section,
        roll: p.roll,
      },
      fee_type: p.fee_type,
      fee_details: p.fee_details,
      month_name: p.month ? getMonthName(p.month) : undefined,
      year: p.year,
      amount_due: p.amount_due,
      discount: p.discount || 0,
      fine: p.fine || 0,
      amount_paid: p.amount_paid,
      payment_method: p.payment_method || "cash",
      payment_date: p.payment_date || "",
      status: isVoid ? "void" : "completed",
      note: p.note,
      is_computer_generated: true,
    };

    setSelectedReceipt(receiptData);
    setShowReceiptModal(true);
  };

  // Void / Refund Action
  const handleOpenVoidDialog = (payment: any) => {
    setPaymentToVoid(payment);
    setVoidReason("");
    setVoidDialogOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!paymentToVoid || !voidReason.trim() || voidReason.trim().length < 3) {
      toast.error("Please provide a reason for voiding (minimum 3 characters).");
      return;
    }

    setVoiding(true);
    try {
      const res = await fetch("/api/finance/tuition/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentToVoid.id,
          reason: voidReason.trim(),
        }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success("Payment voided successfully.");
        setVoidDialogOpen(false);
        setPaymentToVoid(null);
        loadData();
      } else {
        toast.error(result.error || "Failed to void payment.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Network error occurred.");
    } finally {
      setVoiding(false);
    }
  };

  // Reconciliation Scan
  const handleRunReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await fetch("/api/finance/payment/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ older_than_minutes: 0 }),
      });
      const result = await res.json();

      if (result.success) {
        toast.success(result.message || "Reconciliation completed successfully.");
        loadData();
      } else {
        toast.error(result.error || "Reconciliation failed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Reconciliation request failed.");
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        icon={CreditCard}
        title="Payments & Collections"
        subtitle="Manage online and counter school fee collections, receipts, and financial reconciliation"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5"
              onClick={handleRunReconciliation}
              disabled={reconciling}
            >
              {reconciling ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="w-4 h-4 text-primary" />
              )}
              Reconciliation Scan
            </Button>
            <Link href="/finance/tuition/collect">
              <Button size="sm" className="rounded-xl gap-1.5 bg-primary text-primary-foreground">
                <PlusCircle className="w-4 h-4" />
                Collect Fees
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Collected</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
                {formatTaka(stats.totalCollected)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Receipt size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Successful Receipts</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
                {stats.totalCompletedCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Clock size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Orders</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
                {stats.totalPendingCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl p-4 border-border bg-card shadow-xs">
          <CardContent className="p-0 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <RotateCcw size={22} strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Voided / Refunded</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">
                {stats.totalVoidCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unsettled Orders Banner (if any) */}
      {unsettledOrders.length > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-300">
                  {unsettledOrders.length} online payment orders are pending verification
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Run a reconciliation scan to resolve and finalize pending payments with the gateway.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10"
              onClick={handleRunReconciliation}
              disabled={reconciling}
            >
              Reconcile Now
            </Button>
          </div>
        </Card>
      )}

      {/* Payment History Section */}
      <Card className="rounded-2xl border-border bg-card shadow-xs">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Payment History & Receipts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm">Loading payment history...</p>
            </div>
          ) : (
            <PaymentHistoryTable
              payments={payments}
              onViewReceipt={handleViewReceipt}
              onVoidPayment={handleOpenVoidDialog}
            />
          )}
        </CardContent>
      </Card>

      {/* Print Receipt Dialog */}
      <Dialog open={showReceiptModal} onOpenChange={setShowReceiptModal}>
        <DialogContent className="max-w-2xl p-6 rounded-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Payment Receipt Preview</DialogTitle>
          </DialogHeader>
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="border border-border rounded-xl p-3 bg-white text-slate-800">
                <PrintReceipt data={selectedReceipt} format={receiptFormat} />
              </div>
              <DialogFooter className="flex gap-2 sm:justify-end">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowReceiptModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    const html = generateTuitionReceiptHtml(selectedReceipt, { format: receiptFormat });
                    printHtml(html);
                  }}
                  className="rounded-xl gap-1.5 bg-primary text-primary-foreground"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Voiding / Refund Confirmation Dialog */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6 border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">
              Void Payment Confirmation
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Receipt No: {paymentToVoid?.receipt_number} ({formatTaka(paymentToVoid?.amount_paid)})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reason for Voiding *</Label>
              <Input
                placeholder="e.g. Duplicate entry / Incorrect student selected"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <p className="text-xs text-muted-foreground bg-muted/50 p-2.5 rounded-lg border">
              Warning: Voiding this payment will mark the receipt as void and automatically reverse the corresponding income entry.
            </p>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setVoidDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              onClick={handleConfirmVoid}
              disabled={voiding || voidReason.trim().length < 3}
            >
              {voiding ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Confirm Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
