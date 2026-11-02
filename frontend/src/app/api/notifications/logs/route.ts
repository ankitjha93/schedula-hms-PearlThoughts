import { NextRequest, NextResponse } from 'next/server';
import { getNotificationLogs } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || undefined;
    const status = searchParams.get('status') || undefined;
    const patientId = searchParams.get('patientId') || undefined;
    const appointmentId = searchParams.get('appointmentId') || undefined;

    const logs = getNotificationLogs({
      channel,
      status,
      patientId,
      appointmentId,
    });

    const stats = {
      total: logs.length,
      sent: logs.filter(l => l.status === 'SENT').length,
      failed: logs.filter(l => l.status === 'FAILED').length,
      pending: logs.filter(l => l.status === 'PENDING' || l.status === 'RETRYING').length,
    };

    return NextResponse.json({
      success: true,
      logs,
      stats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch notification logs' },
      { status: 500 }
    );
  }
}
