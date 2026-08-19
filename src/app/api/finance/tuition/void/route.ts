import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { ApiResponse } from '@/types/finance';
import { assertValidTransition } from '@/lib/payment/state-machine';

export async function POST(request: Request) {
  try {
    const auth = await requireRole(['super_admin', 'admin', 'accountant']);
    if (auth instanceof NextResponse) return auth;
    const { user, supabase } = auth;

    const body = await request.json();
    const { payment_id, reason } = body;

    if (!payment_id || !reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return NextResponse.json({ 
        success: false, 
        error: "payment_id and a valid reason (min 3 chars) are required" 
      }, { status: 400 });
    }

    // 1. Fetch payment to verify it exists
    const { data: payment, error: fetchError } = await supabase
      .from('tuition_payments')
      .select('*')
      .eq('id', payment_id)
      .maybeSingle();

    if (fetchError || !payment) {
      return NextResponse.json({ success: false, error: "Payment record not found" }, { status: 404 });
    }

    const rawPayment = payment as Record<string, unknown>;
    if (rawPayment.status === 'void' || rawPayment.status === 'refunded') {
      return NextResponse.json({ success: false, error: "This payment has already been voided or refunded" }, { status: 400 });
    }

    // 2. Mark payment as void
    const updatePayload: Record<string, unknown> = {
      status: 'void',
      void_reason: reason.trim(),
      voided_at: new Date().toISOString(),
    };

    if (user?.id && user.id !== '00000000-0000-0000-0000-000000000000') {
      updatePayload.voided_by = user.id;
    }

    const res = await (supabase as any)
      .from('tuition_payments')
      .update(updatePayload)
      .eq('id', payment_id)
      .select()
      .single();
    
    const updatedPayment = res.data || { ...rawPayment, status: 'void', void_reason: reason.trim() };

    // 3. Synchronize with payment_orders if exists
    try {
      await (supabase as any)
        .from('payment_orders')
        .update({
          status: 'REFUNDED',
          failure_reason: `Voided by accountant: ${reason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('tuition_payment_id', payment_id);
    } catch {
      // Non-blocking
    }

    // 4. Remove associated income entries (match by reference_id AND receipt_number in description)
    try {
      if (rawPayment.receipt_number) {
        await supabase
          .from('income_entries')
          .delete()
          .ilike('description', `%${rawPayment.receipt_number}%`);
      }
    } catch {
      // Non-blocking
    }

    try {
      await (supabase as any)
        .from('income_entries')
        .delete()
        .eq('reference_id', payment_id);
    } catch {
      // Non-blocking
    }

    // 5. Record Audit Log
    try {
      await (supabase as any).from('finance_audit_logs').insert({
        actor_id: user?.id && user.id !== '00000000-0000-0000-0000-000000000000' ? user.id : null,
        actor_name: user?.email || 'Staff',
        action: 'VOID_TUITION_PAYMENT',
        target_table: 'tuition_payments',
        target_id: payment_id,
        details: {
          receipt_number: rawPayment.receipt_number,
          student_id: rawPayment.student_id,
          amount_paid: rawPayment.amount_paid,
          void_reason: reason.trim()
        }
      });
    } catch {
      // Audit failure shouldn't block transaction
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedPayment, 
      message: "Payment successfully voided and removed from financial income records." 
    } as unknown as ApiResponse<typeof updatedPayment>);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
