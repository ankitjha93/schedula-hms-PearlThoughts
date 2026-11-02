import { NextRequest, NextResponse } from 'next/server';
import { updateAppointmentStatus, rescheduleAppointment, processRefund } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, status, cancellationReason, prescription, newDate, newTime, reason } = body;

    // Handle appointment rescheduling
    if (action === 'RESCHEDULE') {
      const targetDate = newDate || body.date;
      const targetTime = newTime || body.time;
      const targetReason = reason || body.rescheduleReason;

      if (!targetDate || !targetTime) {
        return NextResponse.json(
          { success: false, error: 'newDate and newTime are required to reschedule' },
          { status: 400 }
        );
      }

      try {
        const rescheduled = rescheduleAppointment(id, targetDate, targetTime, targetReason);
        if (!rescheduled) {
          return NextResponse.json(
            { success: false, error: 'Appointment not found' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, appointment: rescheduled, data: rescheduled });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: err.message || 'Failed to reschedule appointment' },
          { status: 409 }
        );
      }
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: 'Status is required' },
        { status: 400 }
      );
    }

    if (status === 'CANCELLED' && body.refund !== false) {
      const refundRes = await processRefund(id, cancellationReason || 'Appointment cancelled', body.overrideAmount);
      return NextResponse.json({
        success: true,
        appointment: refundRes.appointment,
        refundAmount: refundRes.refundAmount,
        payment: refundRes.payment,
        data: refundRes.appointment,
      });
    }

    const updated = updateAppointmentStatus(id, status, cancellationReason, prescription);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Appointment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, appointment: updated, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update appointment' },
      { status: 500 }
    );
  }
}
