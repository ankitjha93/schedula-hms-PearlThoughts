import { NextRequest, NextResponse } from 'next/server';
import { retryNotificationDelivery } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { logId } = body;

    if (!logId) {
      return NextResponse.json(
        { success: false, error: 'logId is required to retry delivery' },
        { status: 400 }
      );
    }

    const result = await retryNotificationDelivery(logId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Retry delivery failed', log: result.log },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification delivery retried successfully',
      log: result.log,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retry notification' },
      { status: 500 }
    );
  }
}
