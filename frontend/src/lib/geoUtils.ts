/**
 * Geolocation & Distance Calculation Utilities for Medrella HMS
 * Employs spherical trigonometry (Haversine formula) for precise proximity sorting.
 */

import { DoctorCoordinates } from './types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export const DEFAULT_HOSPITAL_CENTER: GeoPoint = {
  lat: 40.758896,
  lng: -73.985130, // New York Midtown / Healthcare Corridor
};

/**
 * Verified Medical Facilities & Hospital Coordinates Directory
 */
export const HOSPITAL_LOCATIONS: Record<string, { lat: number; lng: number; city: string; address: string }> = {
  'City General Hospital': {
    lat: 40.7648,
    lng: -73.9565,
    city: 'Manhattan',
    address: '402 E 68th St, Manhattan, NY 10065',
  },
  'St. Jude Specialty Hospital': {
    lat: 40.7391,
    lng: -73.9774,
    city: 'New York',
    address: '550 1st Ave, New York, NY 10016',
  },
  'Childrens Wellness Hospital': {
    lat: 40.7903,
    lng: -73.9532,
    city: 'New York',
    address: '1184 5th Ave, New York, NY 10029',
  },
  'University Health Center': {
    lat: 40.7183,
    lng: -74.0048,
    city: 'Lower Manhattan',
    address: '170 William St, New York, NY 10038',
  },
  'Memorial Neuroscience Center': {
    lat: 40.7678,
    lng: -73.9538,
    city: 'Upper East Side',
    address: '1305 York Ave, New York, NY 10021',
  },
  'Memorial Cancer Institute': {
    lat: 40.7634,
    lng: -73.9589,
    city: 'New York',
    address: '1275 York Ave, New York, NY 10065',
  },
  'Childrens & Womens Hospital': {
    lat: 40.7128,
    lng: -73.9870,
    city: 'Financial District',
    address: '83 Maiden Ln, New York, NY 10038',
  },
  'Medrella Neuroscience Pavilion': {
    lat: 40.7680,
    lng: -73.9535,
    city: 'Manhattan',
    address: '1305 York Ave, New York, NY 10021',
  },
  'Medrella Central Hospital': {
    lat: 40.7589,
    lng: -73.9851,
    city: 'Midtown',
    address: '350 5th Ave, New York, NY 10118',
  },
};

/**
 * Resolves hospital coordinates or generates a deterministic fallback
 */
export function resolveDoctorCoordinates(hospital?: string, location?: string): DoctorCoordinates {
  if (hospital && HOSPITAL_LOCATIONS[hospital]) {
    const loc = HOSPITAL_LOCATIONS[hospital];
    return {
      lat: loc.lat,
      lng: loc.lng,
      city: loc.city,
      formattedAddress: loc.address,
    };
  }

  // Deterministic fallback based on hospital name hash
  const hash = (hospital || 'Medrella Clinic').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const jitterLat = ((hash % 100) - 50) * 0.0008;
  const jitterLng = (((hash * 13) % 100) - 50) * 0.0008;

  return {
    lat: parseFloat((DEFAULT_HOSPITAL_CENTER.lat + jitterLat).toFixed(4)),
    lng: parseFloat((DEFAULT_HOSPITAL_CENTER.lng + jitterLng).toFixed(4)),
    city: 'New York',
    formattedAddress: `${location || 'Medical Suite'}, ${hospital || 'Medrella Medical Center'}`,
  };
}

/**
 * Calculates great-circle distance between two GPS coordinates in kilometers
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's mean radius in kilometers
  const toRad = (degree: number) => (degree * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place (e.g. 2.4 km)
  return Math.round(distance * 10) / 10;
}

/**
 * Formats a metric distance into clean patient-facing notation
 */
export function formatDistance(distanceKm?: number, unit: 'km' | 'mi' = 'km'): string {
  if (distanceKm === undefined || distanceKm === null) return '';
  if (unit === 'mi') {
    const miles = distanceKm * 0.621371;
    return `${miles.toFixed(1)} mi away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Generates universal Google Maps turn-by-turn navigation link
 * Supports both (lat, lng, label) and (coordinatesObject, label) signatures
 */
export function getDirectionsUrl(
  latOrCoords: number | { lat: number; lng: number },
  lngOrLabel?: number | string,
  label?: string
): string {
  let lat: number;
  let lng: number;

  if (typeof latOrCoords === 'object' && latOrCoords !== null) {
    lat = latOrCoords.lat;
    lng = latOrCoords.lng;
  } else {
    lat = latOrCoords;
    lng = typeof lngOrLabel === 'number' ? lngOrLabel : 0;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/**
 * Requests current device GPS coordinates from browser Geolocation API
 */
export function getCurrentPatientPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        let msg = 'Unable to retrieve location';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission denied by user';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'GPS signal unavailable';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out';
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}
