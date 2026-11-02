import { NextRequest, NextResponse } from 'next/server';
import { getPatientNotificationPreferences, updatePatientNotificationPreferences } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'patientId is required' },
        { status: 400 }
      );
    }

    const preferences = getPatientNotificationPreferences(patientId);
    return NextResponse.json({
      success: true,
      patientId,
      preferences,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, preferences } = body;

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: 'patientId is required' },
        { status: 400 }
      );
    }

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { success: false, error: 'preferences object is required' },
        { status: 400 }
      );
    }

    const updated = updatePatientNotificationPreferences(patientId, preferences);
    return NextResponse.json({
      success: true,
      patientId,
      preferences: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
