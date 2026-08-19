import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { PaymentGatewayManager } from "@/lib/payment/gateway-manager";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  releaseIdempotencyLock,
} from "@/lib/payment/idempotency";
import { roundCurrency, getMonthName } from "@/lib/finance-utils";
import { FeeItemDetail, PaymentOrder } from "@/lib/payment/types";

export async function POST(request: Request) {
  let idempotencyKey: string | null = null;
  let authContext: any = null;

  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;
    authContext = auth;
    const { user, supabase } = auth;

    idempotencyKey = request.headers.get("Idempotency-Key") || null;
    const body = await request.json();

    const {
      student_id,
      fee_details = [],
      year,
      month,
      gateway = "counter",
      payment_method = "cash",
      discount = 0,
      fine = 0,
      note,
      client_redirect_url,
    } = body;

    const parsedYear = parseInt(String(year || new Date().getFullYear()), 10);
    const parsedDiscount = roundCurrency(discount);
    const parsedFine = roundCurrency(fine);

    if (!student_id || !Array.isArray(fee_details) || fee_details.length === 0) {
      return NextResponse.json(
        { success: false, error: "student_id and non-empty fee_details are required" },
        { status: 400 }
      );
    }

    // 1. Check & Acquire Idempotency Lock
    if (idempotencyKey) {
      const lock = await acquireIdempotencyLock(
        supabase,
        idempotencyKey,
        "payment_order_create",
        body,
        user.id
      );

      if (lock.isDuplicate) {
        if (lock.inProgress) {
          return NextResponse.json(
            { success: false, error: lock.error || "Request already in progress" },
            { status: 409 }
          );
        }
        if (lock.cachedResponse) {
          return NextResponse.json(lock.cachedResponse.body, {
            status: lock.cachedResponse.status,
          });
        }
      }
    }

    // 2. Fetch student details
    const { data: student, error: stdErr } = await supabase
      .from("students")
      .select("id, name, roll, class_id, classes(name), sections(name)")
      .eq("id", student_id)
      .single();

    if (stdErr || !student) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json({ success: false, error: "Student not found" }, { status: 404 });
    }

    const className = (student.classes as { name?: string })?.name || "N/A";
    const sectionName = (student.sections as { name?: string })?.name || "";

    // 3. Authoritative Server-Side Fee Lookup & Calculation
    const { data: feeStructure } = await supabase
      .from("fee_structure")
      .select("fee_type, amount")
      .eq("class_name", className)
      .eq("academic_year", parsedYear.toString())
      .eq("is_active", true);

    const feeMap = new Map<string, number>();
    (feeStructure || []).forEach((f) => {
      feeMap.set(f.fee_type.toLowerCase().trim(), Number(f.amount));
    });

    let totalAmountDue = 0;
    const validatedFeeDetails: FeeItemDetail[] = [];

    for (const item of fee_details as FeeItemDetail[]) {
      const fType = (item.type || "").toLowerCase().trim();
      const scheduledRate = feeMap.get(fType);

      // Enforce scheduled rate unless custom item / arrears
      const itemRate = scheduledRate !== undefined && scheduledRate > 0 
        ? scheduledRate 
        : roundCurrency(item.amount);

      if (itemRate <= 0) {
        if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
        return NextResponse.json(
          { success: false, error: `Invalid non-positive amount for fee "${item.type}"` },
          { status: 400 }
        );
      }

      totalAmountDue = roundCurrency(totalAmountDue + itemRate);
      validatedFeeDetails.push({
        type: item.type,
        amount: itemRate,
        month: item.month,
        year: item.year || parsedYear,
        exam_name: item.exam_name,
        description: item.description,
      });
    }

    const grossPayable = roundCurrency(totalAmountDue + parsedFine);
    if (parsedDiscount > grossPayable) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json(
        { success: false, error: "Discount cannot exceed payable amount" },
        { status: 400 }
      );
    }

    const netPayable = roundCurrency(grossPayable - parsedDiscount);

    // 4. Generate Unique Order ID
    const orderId = `ORD-${parsedYear}-${Date.now().toString().slice(-6)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const feeTypes = [...new Set(validatedFeeDetails.map((f) => f.type))];
    const fee_type = feeTypes.length > 1 ? "multiple" : feeTypes[0] || "tuition";

    // 5. Create Payment Order Record
    const orderRecord: Record<string, any> = {
      order_id: orderId,
      student_id,
      class_name: className,
      section: sectionName,
      amount_due: totalAmountDue,
      amount_paid: netPayable,
      discount: parsedDiscount,
      fine: parsedFine,
      currency: "BDT",
      fee_type,
      fee_details: validatedFeeDetails,
      year: parsedYear,
      month: month ? parseInt(String(month), 10) : null,
      status: "CREATED",
      payment_method,
      gateway,
      idempotency_key: idempotencyKey,
      payer_id: user.id,
      collected_by: user.id,
      note: note || null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 mins expiry
    };

    const { data: insertedOrder, error: insertErr } = await (supabase as any)
      .from("payment_orders")
      .insert(orderRecord)
      .select()
      .single();

    if (insertErr) {
      if (idempotencyKey) await releaseIdempotencyLock(supabase, idempotencyKey);
      return NextResponse.json(
        { success: false, error: insertErr.message || "Failed to create payment order" },
        { status: 500 }
      );
    }

    // 6. Handle Gateway Session Creation if Online
    let initiationResult: any = {
      success: true,
      order_id: orderId,
      status: "CREATED",
      amount_paid: netPayable,
    };

    if (gateway !== "counter") {
      const gatewayInfo = PaymentGatewayManager.resolveGateway(gateway);
      const origin = new URL(request.url).origin;
      const callbackUrl = `${origin}/api/finance/payment/callback`;

      const gResult = await (gatewayInfo.adapter as any).createPayment(
        {
          ...insertedOrder,
          student_name: student.name,
        },
        callbackUrl
      );

      if (gResult.success) {
        await (supabase as any)
          .from("payment_orders")
          .update({
            status: "INITIATED",
            gateway_payment_id: gResult.gateway_payment_id,
            gateway_response: gResult.raw_response,
          })
          .eq("id", insertedOrder.id);

        initiationResult = {
          success: true,
          order_id: orderId,
          status: "INITIATED",
          gateway_payment_id: gResult.gateway_payment_id,
          redirect_url: gResult.redirect_url,
          amount_paid: netPayable,
        };
      } else {
        await (supabase as any)
          .from("payment_orders")
          .update({
            status: "FAILED",
            failure_reason: gResult.message,
          })
          .eq("id", insertedOrder.id);

        initiationResult = {
          success: false,
          order_id: orderId,
          status: "FAILED",
          error: gResult.message || "Failed to initiate gateway payment",
        };
      }
    }

    const responsePayload = {
      success: initiationResult.success,
      data: {
        order: insertedOrder,
        ...initiationResult,
      },
    };

    if (idempotencyKey) {
      await completeIdempotencyLock(supabase, idempotencyKey, 200, responsePayload);
    }

    return NextResponse.json(responsePayload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (idempotencyKey && authContext?.supabase) {
      await releaseIdempotencyLock(authContext.supabase, idempotencyKey);
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
