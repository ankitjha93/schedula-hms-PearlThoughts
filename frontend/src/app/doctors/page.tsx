"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Doctor } from "@/lib/types";
import { BookingModal } from "@/components/BookingModal";
import {
  Search,
  Filter,
  Star,
  MapPin,
  Clock,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Stethoscope,
  LayoutGrid,
  List,
  Building2,
  GraduationCap,
  ShieldCheck,
  X,
  CheckCircle2,
  DollarSign,
  HeartPulse,
  Activity,
  Heart,
  Brain,
  Smile,
  Bone,
  Eye,
  Zap,
  RotateCcw,
  Languages,
  Check,
  ExternalLink,
  Navigation,
  LocateFixed,
  Map as MapIcon,
} from "lucide-react";
import { formatDistance, getDirectionsUrl, getCurrentPatientPosition, calculateDistanceKm, GeoPoint } from "@/lib/geoUtils";
import DoctorLocationMap from "@/components/DoctorLocationMap";

export default function DoctorsDirectoryPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("ALL");
  const [feeFilter, setFeeFilter] = useState<string>("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "TODAY" | "TOP_RATED">("ALL");
  const [sortBy, setSortBy] = useState<string>("RATING");
  const [viewMode, setViewMode] = useState<"GRID" | "LIST" | "MAP">("GRID");
  const [patientLocation, setPatientLocation] = useState<GeoPoint | null>(null);
  const [locating, setLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [campusFilter, setCampusFilter] = useState<string>("ALL");
  const [radiusFilter, setRadiusFilter] = useState<string>("ALL");

  // Modals state
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [profileDoctor, setProfileDoctor] = useState<Doctor | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctors");
      const data = await res.json();
      setDoctors(data.doctors || []);
    } catch (err) {
      console.error("Failed to load doctor directory", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGetLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const pos = await getCurrentPatientPosition();
      setPatientLocation(pos);
      setSortBy("DISTANCE");
    } catch (err: any) {
      setLocationError(err.message || "Failed to detect location");
    } finally {
      setLocating(false);
    }
  };

  const handleClearLocation = () => {
    setPatientLocation(null);
    setLocationError(null);
    if (sortBy === "DISTANCE") setSortBy("RATING");
  };

  // Dynamic specialties map with counts
  const specialtyCounts = doctors.reduce<Record<string, number>>((acc, doc) => {
    const spec = doc.specialty || doc.specialization;
    if (spec) {
      acc[spec] = (acc[spec] || 0) + 1;
    }
    return acc;
  }, {});

  const specialties = ["ALL", ...Object.keys(specialtyCounts).sort()];

  const getSpecialtyIcon = (spec: string) => {
    switch (spec.toLowerCase()) {
      case "cardiology":
        return <Heart className="w-3.5 h-3.5 text-rose-500" />;
      case "dermatology":
        return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case "pediatrics":
        return <Smile className="w-3.5 h-3.5 text-sky-500" />;
      case "orthopedics":
        return <Bone className="w-3.5 h-3.5 text-indigo-500" />;
      case "neurology":
        return <Brain className="w-3.5 h-3.5 text-purple-500" />;
      case "general medicine":
        return <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />;
      case "oncology":
        return <Activity className="w-3.5 h-3.5 text-pink-500" />;
      case "gastroenterology":
        return <HeartPulse className="w-3.5 h-3.5 text-teal-500" />;
      case "gynecology":
        return <ShieldCheck className="w-3.5 h-3.5 text-red-500" />;
      case "psychiatry":
        return <Brain className="w-3.5 h-3.5 text-indigo-500" />;
      case "ophthalmology":
        return <Eye className="w-3.5 h-3.5 text-blue-500" />;
      default:
        return <Stethoscope className="w-3.5 h-3.5 text-emerald-500" />;
    }
  };

  const filteredDoctors = doctors
    .map((doc) => {
      if (patientLocation && doc.coordinates) {
        const dist = calculateDistanceKm(
          patientLocation.lat,
          patientLocation.lng,
          doc.coordinates.lat,
          doc.coordinates.lng
        );
        return { ...doc, distanceKm: dist };
      }
      return doc;
    })
    .filter((doc) => {
      const spec = doc.specialty || doc.specialization;
      const fee = doc.fee !== undefined ? doc.fee : doc.consultationFee;
      const q = searchQuery.trim().toLowerCase();

      // Search matches name, specialty, hospital, location, city, bio, education, conditions
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        spec.toLowerCase().includes(q) ||
        doc.hospital.toLowerCase().includes(q) ||
        (doc.location && doc.location.toLowerCase().includes(q)) ||
        (doc.coordinates?.city && doc.coordinates.city.toLowerCase().includes(q)) ||
        (doc.education && doc.education.toLowerCase().includes(q)) ||
        (doc.bio && doc.bio.toLowerCase().includes(q)) ||
        (doc.about && doc.about.toLowerCase().includes(q)) ||
        (doc.conditions && doc.conditions.some((c) => c.toLowerCase().includes(q)));

      const matchesSpecialty =
        specialtyFilter === "ALL" || spec.toLowerCase() === specialtyFilter.toLowerCase();

      let matchesFee = true;
      if (feeFilter === "UNDER_65") matchesFee = fee < 65;
      else if (feeFilter === "65_TO_80") matchesFee = fee >= 65 && fee <= 80;
      else if (feeFilter === "OVER_80") matchesFee = fee > 80;

      let matchesAvail = true;
      if (availabilityFilter === "TODAY") {
        matchesAvail = (doc.nextAvailableSlot || "").toLowerCase().includes("today");
      } else if (availabilityFilter === "TOP_RATED") {
        matchesAvail = doc.rating >= 4.88;
      }

      // Campus / City filter
      let matchesCampus = true;
      if (campusFilter !== "ALL") {
        const c = campusFilter.toLowerCase();
        matchesCampus =
          doc.hospital.toLowerCase().includes(c) ||
          Boolean(doc.coordinates?.city && doc.coordinates.city.toLowerCase().includes(c)) ||
          Boolean(doc.location && doc.location.toLowerCase().includes(c));
      }

      // Radius filter (when patientLocation active)
      let matchesRadius = true;
      if (radiusFilter !== "ALL" && doc.distanceKm !== undefined) {
        matchesRadius = doc.distanceKm <= Number(radiusFilter);
      }

      return matchesSearch && matchesSpecialty && matchesFee && matchesAvail && matchesCampus && matchesRadius;
    })
    .sort((a, b) => {
      if (sortBy === "DISTANCE") {
        return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
      }
      const feeA = a.fee !== undefined ? a.fee : a.consultationFee;
      const feeB = b.fee !== undefined ? b.fee : b.consultationFee;
      if (sortBy === "FEE_ASC") return feeA - feeB;
      if (sortBy === "FEE_DESC") return feeB - feeA;
      if (sortBy === "EXPERIENCE") return b.experienceYears - a.experienceYears;
      if (sortBy === "REVIEWS")
        return (b.reviewsCount || b.reviewCount || 0) - (a.reviewsCount || a.reviewCount || 0);
      return b.rating - a.rating;
    });

  const resetFilters = () => {
    setSearchQuery("");
    setSpecialtyFilter("ALL");
    setFeeFilter("ALL");
    setAvailabilityFilter("ALL");
    setCampusFilter("ALL");
    setRadiusFilter("ALL");
    setPatientLocation(null);
    setLocationError(null);
    setSortBy("RATING");
  };

  const isFiltered =
    searchQuery.trim() !== "" ||
    specialtyFilter !== "ALL" ||
    feeFilter !== "ALL" ||
    availabilityFilter !== "ALL" ||
    campusFilter !== "ALL" ||
    radiusFilter !== "ALL" ||
    patientLocation !== null;

  const handleBook = (doctor: Doctor) => {
    setSelectedDoctor(doctor);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-in fade-in duration-300">
      {/* Hero & Clinical Trust Bar */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Medrella Verified Specialist Directory</span>
          </div>

          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Find Your Doctor &amp; Book Consultation
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Discover top-rated board-certified specialists, inspect consultation fees with transparent pricing, view clinical credentials, and book conflict-free appointments.
            </p>
          </div>

          {/* Trust KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-black text-white">{doctors.length || 12}+ Verified</div>
                <div className="text-[11px] text-slate-400 font-medium">Medical Specialists</div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                <Star className="w-4 h-4 fill-amber-400" />
              </div>
              <div>
                <div className="text-sm font-black text-white">4.9 / 5.0</div>
                <div className="text-[11px] text-slate-400 font-medium">Patient Satisfaction</div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-black text-white">Instant OPD</div>
                <div className="text-[11px] text-slate-400 font-medium">Live Queue Tokens</div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-black text-white">100% Conflict-Free</div>
                <div className="text-[11px] text-slate-400 font-medium">Real-Time Slot Engine</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Smart Search Bar */}
          <div className="relative md:col-span-4">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by doctor, condition (e.g. migraine, acne), or hospital..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 font-medium outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Specialty Dropdown */}
          <div className="relative md:col-span-3">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer outline-hidden"
            >
              <option value="ALL">All Specialties ({doctors.length})</option>
              {Object.keys(specialtyCounts)
                .sort()
                .map((spec) => (
                  <option key={spec} value={spec}>
                    {spec} ({specialtyCounts[spec]})
                  </option>
                ))}
            </select>
          </div>

          {/* Hospital Campus / City Location Filter */}
          <div className="relative md:col-span-3">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer outline-hidden"
            >
              <option value="ALL">All Hospital Campuses</option>
              <option value="Manhattan">Manhattan Health District</option>
              <option value="Midtown">Midtown Pavilion</option>
              <option value="Upper East Side">Upper East Side</option>
              <option value="Lower Manhattan">Lower Manhattan / Downtown</option>
              <option value="City General Hospital">City General Hospital</option>
              <option value="St. Jude Specialty Hospital">St. Jude Specialty Hospital</option>
              <option value="Childrens Wellness Hospital">Children&apos;s Wellness Pavilion</option>
              <option value="Medrella Neuroscience Pavilion">Neuroscience Pavilion</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="relative md:col-span-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer outline-hidden"
            >
              {patientLocation && <option value="DISTANCE">Nearest to You 📍</option>}
              <option value="RATING">Highest Rated ⭐</option>
              <option value="EXPERIENCE">Most Experienced</option>
              <option value="REVIEWS">Most Reviewed</option>
              <option value="FEE_ASC">Fee: Low to High</option>
              <option value="FEE_DESC">Fee: High to Low</option>
            </select>
          </div>
        </div>

        {/* Location Alerts / Error Banner */}
        {locationError && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{locationError}. You can still browse by hospital campus or manual city filter.</span>
            </div>
            <button onClick={() => setLocationError(null)} className="p-1 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Availability Toggle + View Mode Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* Quick Filters + Near Me */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Geolocation Button */}
            <button
              onClick={patientLocation ? handleClearLocation : handleGetLocation}
              disabled={locating}
              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                patientLocation
                  ? "bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              }`}
              title={patientLocation ? "Click to reset your device location" : "Find specialists nearest to your device"}
            >
              <LocateFixed className={`w-3.5 h-3.5 ${locating ? "animate-spin text-sky-500" : patientLocation ? "text-sky-500" : "text-slate-400"}`} />
              <span>{locating ? "Detecting GPS..." : patientLocation ? "Near Me (Active) ✕" : "Find Near Me"}</span>
            </button>

            {/* Radius Selector (when location is active) */}
            {patientLocation && (
              <select
                value={radiusFilter}
                onChange={(e) => setRadiusFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer outline-hidden"
              >
                <option value="ALL">All Distances</option>
                <option value="5">&lt; 5 km</option>
                <option value="15">&lt; 15 km</option>
                <option value="30">&lt; 30 km</option>
              </select>
            )}

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 ml-1 mr-1">Availability:</span>
            <button
              onClick={() => setAvailabilityFilter("ALL")}
              className={`text-xs px-3 py-1 rounded-xl font-semibold transition cursor-pointer ${
                availabilityFilter === "ALL"
                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAvailabilityFilter("TODAY")}
              className={`text-xs px-3 py-1 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer ${
                availabilityFilter === "TODAY"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Today</span>
            </button>
            <button
              onClick={() => setAvailabilityFilter("TOP_RATED")}
              className={`text-xs px-3 py-1 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer ${
                availabilityFilter === "TOP_RATED"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800"
              }`}
            >
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>Top Rated (4.85+)</span>
            </button>
          </div>

          {/* View mode toggle & counter */}
          <div className="flex items-center space-x-3">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              Showing <span className="font-bold text-emerald-600 dark:text-emerald-400">{filteredDoctors.length}</span> of {doctors.length}
            </div>

            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setViewMode("GRID")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "GRID"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("LIST")}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === "LIST"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("MAP")}
                className={`p-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                  viewMode === "MAP"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
                title="Interactive Map View"
              >
                <MapIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Specialty Category Pills with department counts */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {specialties.map((spec) => {
            const count = spec === "ALL" ? doctors.length : specialtyCounts[spec] || 0;
            const isSelected = specialtyFilter.toLowerCase() === spec.toLowerCase();
            return (
              <button
                key={spec}
                onClick={() => setSpecialtyFilter(spec)}
                className={`text-[11px] px-3 py-1.5 rounded-xl font-semibold transition flex items-center space-x-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200/80 dark:border-slate-700"
                }`}
              >
                {spec !== "ALL" && <span>{getSpecialtyIcon(spec)}</span>}
                <span>{spec === "ALL" ? "All Specialties" : spec}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected
                      ? "bg-emerald-700 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Filters Summary Bar */}
        {isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/60 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">Active Filters:</span>
              {searchQuery && (
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center space-x-1">
                  <span>Query: &quot;{searchQuery}&quot;</span>
                  <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setSearchQuery("")} />
                </span>
              )}
              {specialtyFilter !== "ALL" && (
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center space-x-1">
                  <span>Specialty: {specialtyFilter}</span>
                  <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setSpecialtyFilter("ALL")} />
                </span>
              )}
              {feeFilter !== "ALL" && (
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center space-x-1">
                  <span>Fee: {feeFilter}</span>
                  <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setFeeFilter("ALL")} />
                </span>
              )}
              {availabilityFilter !== "ALL" && (
                <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center space-x-1">
                  <span>Availability: {availabilityFilter}</span>
                  <X className="w-3 h-3 cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setAvailabilityFilter("ALL")} />
                </span>
              )}
            </div>

            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Doctors Grid / List View */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-80 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-pulse shadow-sm"
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
                </div>
              </div>
              <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
              <div className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-xl mx-auto">
          <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <Stethoscope className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">No Specialists Match Your Criteria</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Try adjusting your search query, selecting &quot;All Specialties&quot;, or removing fee and availability filters.
            </p>
          </div>
          <button
            onClick={resetFilters}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      ) : viewMode === "MAP" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Showing {filteredDoctors.length} {filteredDoctors.length === 1 ? "specialist" : "specialists"} across Medrella network
            </span>
            {patientLocation && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Distances calculated from your live GPS location</span>
              </span>
            )}
          </div>
          <DoctorLocationMap
            doctors={filteredDoctors}
            patientLocation={patientLocation}
            onBookDoctor={handleBook}
            onSelectDoctor={setProfileDoctor}
          />
        </div>
      ) : viewMode === "GRID" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => {
            const fee = doc.fee !== undefined ? doc.fee : doc.consultationFee;
            const spec = doc.specialty || doc.specialization;
            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200 flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3.5">
                  {/* Top card row: Avatar & Badge */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3.5">
                      <div className="relative">
                        <img
                          src={doc.avatar}
                          alt={doc.name}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 dark:border-slate-700 shadow-xs group-hover:border-emerald-500 transition"
                        />
                        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" title="Verified active specialist" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-1 text-amber-500 text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span>{doc.rating}</span>
                          <span className="text-slate-400 font-normal">
                            ({doc.reviewCount || doc.reviewsCount || 0})
                          </span>
                        </div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white mt-0.5 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                          {doc.name}
                        </h3>
                        <div className="flex items-center space-x-1.5 mt-0.5">
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            {getSpecialtyIcon(spec)}
                            <span>{spec}</span>
                          </span>
                          {doc.departmentCode && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {doc.departmentCode}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dual currency fee pill */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                        ₹{fee} / ${fee}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium block mt-0.5">per visit</span>
                    </div>
                  </div>

                  {/* Next slot badge */}
                  <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-[11px]">
                    <span className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 font-bold">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>Next Slot:</span>
                    </span>
                    <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                      {doc.nextAvailableSlot || "Today, 10:30 AM"}
                    </span>
                  </div>

                  {/* Doctor Bio */}
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {doc.bio || doc.about}
                  </p>

                  {/* Conditions Treated Chips */}
                  {doc.conditions && doc.conditions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clinical Focus:</span>
                      <div className="flex flex-wrap gap-1">
                        {doc.conditions.slice(0, 3).map((cond) => (
                          <span
                            key={cond}
                            className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60"
                          >
                            #{cond}
                          </span>
                        ))}
                        {doc.conditions.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-medium self-center">
                            +{doc.conditions.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Hospital & Credentials Details */}
                  <div className="space-y-1 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center space-x-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-medium">{doc.hospital}</span>
                      </div>
                      {doc.distanceKm !== undefined && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                          <MapPin className="w-2.5 h-2.5" />
                          <span>{formatDistance(doc.distanceKm)}</span>
                        </span>
                      )}
                    </div>
                    {doc.coordinates?.formattedAddress && (
                      <div className="flex items-center space-x-2 text-[11px] text-slate-400 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{doc.coordinates.formattedAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{doc.education}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{doc.experience || `${doc.experienceYears} years`} clinical practicing</span>
                    </div>
                  </div>
                </div>

                {/* Card Action CTAs */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  {doc.coordinates && (
                    <a
                      href={getDirectionsUrl(doc.coordinates, doc.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Get Directions in Google Maps"
                      className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setProfileDoctor(doc)}
                    className="flex-1 py-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Quick View
                  </button>
                  <button
                    onClick={() => handleBook(doc)}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Visit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {filteredDoctors.map((doc) => {
            const fee = doc.fee !== undefined ? doc.fee : doc.consultationFee;
            const spec = doc.specialty || doc.specialization;
            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                <div className="flex items-start sm:items-center space-x-4">
                  <div className="relative shrink-0">
                    <img
                      src={doc.avatar}
                      alt={doc.name}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
                    />
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-base text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                        {doc.name}
                      </h3>
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        {getSpecialtyIcon(spec)}
                        <span>{spec}</span>
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 flex items-center space-x-1">
                        <Zap className="w-3 h-3 text-amber-500" />
                        <span>Next: {doc.nextAvailableSlot || "Today, 10:30 AM"}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                      <span className="flex items-center space-x-1 text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{doc.rating}</span>
                        <span className="text-slate-400 font-normal">
                          ({doc.reviewCount || doc.reviewsCount || 0})
                        </span>
                      </span>
                      <span>•</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{doc.hospital}</span>
                      {doc.distanceKm !== undefined && (
                        <>
                          <span>•</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{formatDistance(doc.distanceKm)}</span>
                          </span>
                        </>
                      )}
                      <span>•</span>
                      <span>{doc.experience || `${doc.experienceYears} yrs`} experience</span>
                      <span>•</span>
                      <span className="truncate max-w-xs">{doc.education}</span>
                    </div>

                    {doc.conditions && doc.conditions.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {doc.conditions.slice(0, 4).map((cond) => (
                          <span
                            key={cond}
                            className="px-2 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          >
                            #{cond}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                  <div className="text-right mr-2 hidden sm:block">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Consultation Fee</span>
                    <div className="font-black text-base text-emerald-700 dark:text-emerald-400">
                      ₹{fee} / ${fee}
                    </div>
                  </div>
                  {doc.coordinates && (
                    <a
                      href={getDirectionsUrl(doc.coordinates, doc.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Get Directions in Google Maps"
                      className="p-2 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700/60"
                    >
                      <Navigation className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => setProfileDoctor(doc)}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Quick View
                  </button>
                  <button
                    onClick={() => handleBook(doc)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Visit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Physician Clinical Profile Quick View Modal */}
      {profileDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <HeartPulse className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-wide">Physician Clinical Profile &amp; Credentials</h3>
              </div>
              <button
                onClick={() => setProfileDoctor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200">
              {/* Doctor Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-5 pb-5 border-b border-slate-200 dark:border-slate-800">
                <img
                  src={profileDoctor.avatar}
                  alt={profileDoctor.name}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
                />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{profileDoctor.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1.5">
                    {getSpecialtyIcon(profileDoctor.specialty || profileDoctor.specialization)}
                    <span>{profileDoctor.specialty || profileDoctor.specialization}</span>
                    {profileDoctor.departmentCode && <span>• {profileDoctor.departmentCode}</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center space-x-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{profileDoctor.rating}</span>
                      <span className="text-slate-400 font-normal">
                        ({profileDoctor.reviewCount || profileDoctor.reviewsCount || 0} verified reviews)
                      </span>
                    </span>
                    <span>•</span>
                    <span>{profileDoctor.experience || `${profileDoctor.experienceYears} years`} clinical practicing</span>
                  </div>
                </div>
              </div>

              {/* Clinical Focus / Bio */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Practice Focus &amp; Clinical Philosophy</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {profileDoctor.bio || profileDoctor.about}
                </p>
              </div>

              {/* Conditions Treated */}
              {profileDoctor.conditions && profileDoctor.conditions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Common Clinical Conditions Evaluated</span>
                  <div className="flex flex-wrap gap-1.5">
                    {profileDoctor.conditions.map((cond) => (
                      <span
                        key={cond}
                        className="px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
                      >
                        ✓ {cond}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Credentials & Station Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center space-x-1">
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Education &amp; Fellowships</span>
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                    {profileDoctor.education}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center space-x-1">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Hospital Station &amp; Room</span>
                    </span>
                    {profileDoctor.coordinates && (
                      <a
                        href={getDirectionsUrl(profileDoctor.coordinates, profileDoctor.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Directions</span>
                      </a>
                    )}
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                    {profileDoctor.location || profileDoctor.hospital}
                    {profileDoctor.roomNumber && ` • ${profileDoctor.roomNumber}`}
                  </div>
                  {profileDoctor.coordinates?.formattedAddress && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {profileDoctor.coordinates.formattedAddress}
                    </div>
                  )}
                </div>
              </div>

              {/* Languages & Accepted Insurance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center space-x-1">
                    <Languages className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Languages Spoken</span>
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(profileDoctor.languages || ["English"]).map((lang) => (
                      <span key={lang} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5">
                  <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Accepted Insurance Networks</span>
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    {(profileDoctor.acceptedInsurance || ["Aetna", "BlueCross", "Cigna", "Medicare"]).join(", ")}
                  </p>
                </div>
              </div>

              {/* Verified Patient Reviews (if available) */}
              {profileDoctor.reviews && profileDoctor.reviews.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Verified Patient Reviews ({profileDoctor.reviews.length})
                  </span>
                  <div className="space-y-2">
                    {profileDoctor.reviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{rev.patientName}</span>
                          <div className="flex items-center space-x-1 text-amber-500 font-bold text-[11px]">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{rev.rating}.0</span>
                            <span className="text-slate-400 font-normal ml-1">{rev.date}</span>
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px] italic leading-relaxed">
                          &quot;{rev.comment}&quot;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outpatient Fee Card */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Transparent Consultation Fee
                  </span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                    ₹{profileDoctor.fee || profileDoctor.consultationFee} INR / ${profileDoctor.fee || profileDoctor.consultationFee} USD
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Razorpay UPI/Cards or Stripe • 100% money-back guarantee
                  </span>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] inline-block">
                    Next: {profileDoctor.nextAvailableSlot || "Today"}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="button"
                onClick={() => setProfileDoctor(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = profileDoctor;
                  setProfileDoctor(null);
                  handleBook(doc);
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition shadow-sm cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Book with {profileDoctor.name}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal
        doctor={selectedDoctor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchDoctors();
        }}
      />
    </div>
  );
}
