import { NextRequest, NextResponse } from 'next/server';
import { notifyDoctorLeave } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { doctorId, date, reason } = body;

    if (!doctorId || !date) {
      return NextResponse.json(
        { success: false, error: 'doctorId and date are required' },
        { status: 400 }
      );
    }

    const leaveReason = reason || 'Doctor unavailable due to unforeseen emergency leave';
    const result = await notifyDoctorLeave(doctorId, date, leaveReason);

    return NextResponse.json({
      success: true,
      message: `Doctor leave logged. ${result.affectedCount} appointment(s) cancelled and patients notified.`,
      affectedCount: result.affectedCount,
      appointments: result.appointments,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process doctor leave' },
      { status: 500 }
    );
  }
}
