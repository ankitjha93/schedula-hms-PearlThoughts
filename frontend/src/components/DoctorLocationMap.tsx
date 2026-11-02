"use client";

import { useEffect, useRef, useState } from "react";
import { Doctor } from "@/lib/types";
import { getDirectionsUrl, formatDistance, GeoPoint, DEFAULT_HOSPITAL_CENTER } from "@/lib/geoUtils";
import { Navigation, Calendar, Stethoscope, DollarSign, Star, MapPin } from "lucide-react";

interface DoctorLocationMapProps {
  doctors: Doctor[];
  patientLocation?: GeoPoint | null;
  selectedDoctorId?: string | null;
  onSelectDoctor?: (doctor: Doctor) => void;
  onBookDoctor?: (doctor: Doctor) => void;
}

export default function DoctorLocationMap({
  doctors,
  patientLocation,
  selectedDoctorId,
  onSelectDoctor,
  onBookDoctor,
}: DoctorLocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [activeDoctor, setActiveDoctor] = useState<Doctor | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      // Ensure Leaflet stylesheet is injected
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // Dynamically load leaflet on client only
      const L = await import("leaflet");

      if (!isMounted || !mapContainerRef.current) return;

      // Destroy previous map instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const initialCenter: [number, number] = patientLocation
        ? [patientLocation.lat, patientLocation.lng]
        : [DEFAULT_HOSPITAL_CENTER.lat, DEFAULT_HOSPITAL_CENTER.lng];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: true,
      });

      // OpenStreetMap Tiles (100% Free & Open Source)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapLoaded(true);
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when doctors or patientLocation changes
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    let isMounted = true;

    async function updateMarkers() {
      const L = await import("leaflet");
      if (!isMounted || !mapInstanceRef.current) return;

      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = L.latLngBounds([]);

      // 1. Patient Location Marker (Blue Pulsing Pin)
      if (patientLocation) {
        const patientLatLng: [number, number] = [patientLocation.lat, patientLocation.lng];
        bounds.extend(patientLatLng);

        const patientIcon = L.divIcon({
          className: "patient-geo-pin",
          html: `
            <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
              <span style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background-color: #38bdf8; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background-color: #0284c7; border: 3px solid #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);"></span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const patientMarker = L.marker(patientLatLng, { icon: patientIcon })
          .addTo(map)
          .bindPopup("<div style='font-family: sans-serif; font-size: 12px; font-weight: bold; color: #0284c7;'>📍 Your Current Location</div>");

        markersRef.current.push(patientMarker);
      }

      // 2. Doctor / Hospital Pins
      doctors.forEach((doc) => {
        if (!doc.coordinates) return;

        const docLatLng: [number, number] = [doc.coordinates.lat, doc.coordinates.lng];
        bounds.extend(docLatLng);

        const isSelected = selectedDoctorId === doc.id;
        const fee = doc.fee || doc.consultationFee;

        const docIcon = L.divIcon({
          className: `doctor-map-pin-${doc.id}`,
          html: `
            <div style="
              display: flex;
              align-items: center;
              gap: 4px;
              background-color: ${isSelected ? '#059669' : '#0f172a'};
              color: #ffffff;
              padding: 4px 8px;
              border-radius: 9999px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.25);
              border: 2px solid #ffffff;
              font-family: sans-serif;
              font-size: 11px;
              font-weight: 800;
              cursor: pointer;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.2s;
              white-space: nowrap;
            ">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 9999px; background-color: #34d399;"></span>
              <span>$${fee}</span>
            </div>
          `,
          iconSize: [60, 28],
          iconAnchor: [30, 14],
        });

        const marker = L.marker(docLatLng, { icon: docIcon }).addTo(map);

        marker.on("click", () => {
          setActiveDoctor(doc);
          if (onSelectDoctor) onSelectDoctor(doc);
        });

        markersRef.current.push(marker);
      });

      // Fit bounds if we have points
      if (bounds.isValid() && doctors.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [doctors, patientLocation, selectedDoctorId, mapLoaded]);

  return (
    <div className="relative w-full h-[540px] rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-100 dark:bg-slate-900">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Legend Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md text-xs flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-500 border-2 border-white shadow-xs"></span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-600 border-2 border-white shadow-xs"></span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Specialist Clinic</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">
          {doctors.length} clinics mapped
        </span>
      </div>

      {/* Selected Doctor Floating Preview Card */}
      {activeDoctor && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={activeDoctor.avatar}
                alt={activeDoctor.name}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-100 dark:border-slate-800"
              />
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white leading-tight">
                  {activeDoctor.name}
                </h4>
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                  <Stethoscope className="w-3 h-3" />
                  <span>{activeDoctor.specialty || activeDoctor.specialization}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveDoctor(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            >
              ✕
            </button>
          </div>

          <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-medium truncate">{activeDoctor.hospital} • {activeDoctor.location}</span>
            </div>

            {activeDoctor.coordinates && (
              <div className="text-[11px] text-slate-400 pl-5 truncate">
                {activeDoctor.coordinates.formattedAddress}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white text-base">
                  ${activeDoctor.fee || activeDoctor.consultationFee}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">/ encounter</span>
              </div>

              {activeDoctor.distanceKm !== undefined && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Navigation className="w-2.5 h-2.5" />
                  <span>{formatDistance(activeDoctor.distanceKm)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            {activeDoctor.coordinates && (
              <a
                href={getDirectionsUrl(
                  activeDoctor.coordinates.lat,
                  activeDoctor.coordinates.lng,
                  activeDoctor.hospital
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition flex-1 text-center"
              >
                <Navigation className="w-3.5 h-3.5 text-sky-500" />
                <span>Directions</span>
              </a>
            )}

            <button
              onClick={() => {
                if (onBookDoctor) onBookDoctor(activeDoctor);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex-1 text-center cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Visit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

