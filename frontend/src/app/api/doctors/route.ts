import { NextRequest, NextResponse } from 'next/server';
import { getDoctors } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const specialty = searchParams.get('specialty') || undefined;
    const city = searchParams.get('city') || undefined;
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radiusKm') || searchParams.get('radius');

    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lngStr ? parseFloat(lngStr) : undefined;
    const radiusKm = radiusStr ? parseFloat(radiusStr) : undefined;

    const locationFilter = (lat !== undefined && lng !== undefined) || city || radiusKm
      ? { lat, lng, radiusKm, city }
      : undefined;

    const doctors = getDoctors(search, specialty, locationFilter);
    return NextResponse.json({ success: true, doctors, data: doctors });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch doctors' },
      { status: 500 }
    );
  }
}
