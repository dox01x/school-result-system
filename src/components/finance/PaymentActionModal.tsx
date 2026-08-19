"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "./PaymentStatusBadge";
import { PaymentStatus } from "@/lib/payment/types";
import { getStatusDetails } from "@/lib/payment/state-machine";
import { formatTaka } from "@/lib/finance-utils";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
  amount: number;
  gateway: string;
  studentName?: string;
  className?: string;
  status: PaymentStatus | string;
  redirectUrl?: string | null;
  onSuccess?: (data: any) => void;
  onCheckStatus?: (orderId: string) => Promise<any>;
}

export function PaymentActionModal({
  open,
  onOpenChange,
  orderId,
  amount,
  gateway,
  studentName,
  className,
  status: initialStatus,
  redirectUrl,
  onSuccess,
  onCheckStatus,
}: PaymentActionModalProps) {
  const [currentStatus, setCurrentStatus] = useState<PaymentStatus>(
    (initialStatus as PaymentStatus) || "CREATED"
  );
  const [checking, setChecking] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    setCurrentStatus((initialStatus as PaymentStatus) || "CREATED");
  }, [initialStatus]);

  // Bounded status polling for pending gateway payments
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (
      open &&
      orderId &&
      (currentStatus === "INITIATED" ||
        currentStatus === "PENDING" ||
        currentStatus === "PROCESSING" ||
        currentStatus === "VERIFICATION_REQUIRED") &&
      pollCount < 6
    ) {
      // Exponential backoff: 2s -> 4s -> 6s -> 8s -> 10s
      const delay = Math.min(2000 * Math.pow(1.5, pollCount), 12000);

      timer = setTimeout(async () => {
        try {
          if (onCheckStatus) {
            const res = await onCheckStatus(orderId);
            if (res && res.status) {
              setCurrentStatus(res.status);
              if (res.status === "SUCCESS" && onSuccess) {
                onSuccess(res);
              }
            }
          }
        } catch {
          // Non-blocking poll error
        } finally {
          setPollCount((prev) => prev + 1);
        }
      }, delay);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [open, orderId, currentStatus, pollCount, onCheckStatus, onSuccess]);

  const handleManualCheck = async () => {
    if (!orderId || checking) return;
    setChecking(true);
    try {
      if (onCheckStatus) {
        const res = await onCheckStatus(orderId);
        if (res && res.status) {
          setCurrentStatus(res.status);
          if (res.status === "SUCCESS") {
            toast.success("Payment completed successfully!");
            if (onSuccess) onSuccess(res);
          } else {
            toast.info(`Current status: ${res.status}`);
          }
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Status check failed");
    } finally {
      setChecking(false);
    }
  };

  const statusDetails = getStatusDetails(currentStatus);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-6 border-border bg-card">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary mb-2">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Payment Security & Verification
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {studentName ? `${studentName} (${className || "N/A"})` : "School Fee Collection"}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4 rounded-xl bg-muted/40 p-4 border border-border/60">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Total Payable Amount:</span>
            <span className="font-bold text-base text-foreground">
              {formatTaka(amount)}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Payment Gateway:</span>
            <span className="font-medium uppercase tracking-wider text-xs px-2 py-0.5 rounded bg-background border">
              {gateway}
            </span>
          </div>

          {orderId && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Order ID:</span>
              <span className="font-mono text-xs text-muted-foreground">{orderId}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-sm pt-2 border-t border-border/40">
            <span className="text-muted-foreground">Current Status:</span>
            <PaymentStatusBadge status={currentStatus} />
          </div>
        </div>

        <div className="text-center p-3 rounded-lg bg-background border text-xs text-muted-foreground">
          {statusDetails.userMessageBn}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
          {redirectUrl && currentStatus === "INITIATED" && (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 font-medium"
              onClick={() => window.open(redirectUrl, "_blank")}
            >
              <ExternalLink className="w-4 h-4" />
              Pay Now (Gateway)
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full rounded-xl gap-2"
            onClick={handleManualCheck}
            disabled={checking}
          >
            {checking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Check Payment Status
          </Button>

          <Button
            variant="secondary"
            className="w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentActionModal;
