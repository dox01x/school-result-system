"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { PaymentStatus } from "@/lib/payment/types";
import { getStatusDetails } from "@/lib/payment/state-machine";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Ban,
  ShieldAlert,
  Loader2,
} from "lucide-react";

interface PaymentStatusBadgeProps {
  status: PaymentStatus | string;
  showIcon?: boolean;
  className?: string;
}

export function PaymentStatusBadge({
  status,
  showIcon = true,
  className = "",
}: PaymentStatusBadgeProps) {
  const normalizedStatus = (status || "CREATED").toUpperCase() as PaymentStatus;
  const details = getStatusDetails(normalizedStatus);

  const getIcon = () => {
    switch (normalizedStatus) {
      case "SUCCESS":
        return <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />;
      case "PENDING":
      case "PROCESSING":
      case "INITIATED":
        return <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-amber-500" />;
      case "VERIFICATION_REQUIRED":
        return <AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-500" />;
      case "FAILED":
        return <Ban className="w-3.5 h-3.5 mr-1 text-rose-500" />;
      case "CANCELLED":
      case "EXPIRED":
        return <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />;
      case "REFUND_PENDING":
      case "PARTIALLY_REFUNDED":
      case "REFUNDED":
        return <RotateCcw className="w-3.5 h-3.5 mr-1 text-purple-500" />;
      default:
        return <ShieldAlert className="w-3.5 h-3.5 mr-1 text-muted-foreground" />;
    }
  };

  const getStyleClass = () => {
    switch (normalizedStatus) {
      case "SUCCESS":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20";
      case "PENDING":
      case "PROCESSING":
      case "INITIATED":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20";
      case "VERIFICATION_REQUIRED":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20";
      case "FAILED":
        return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20";
      case "CANCELLED":
      case "EXPIRED":
        return "bg-muted text-muted-foreground border-border";
      case "REFUND_PENDING":
      case "PARTIALLY_REFUNDED":
      case "REFUNDED":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20";
      default:
        return "bg-secondary text-secondary-foreground border-border";
    }
  };

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${getStyleClass()} ${className}`}
      title={`${details.labelEn}: ${details.userMessageBn}`}
    >
      {showIcon && getIcon()}
      <span>{details.labelEn}</span>
    </Badge>
  );
}

export default PaymentStatusBadge;
