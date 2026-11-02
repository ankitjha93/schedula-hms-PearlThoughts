"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Appointment, BillingInvoice, PatientProfile, PatientNotificationPreferences } from "@/lib/types";
import { useRole } from "@/components/RoleContext";
import { downloadCalendarEvent } from "@/lib/calendar";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  PlusCircle,
  Stethoscope,
  Info,
  CalendarPlus,
  FileText,
  Printer,
  X,
  Pill,
  Activity,
  HeartPulse,
  BadgeAlert,
  ShieldCheck,
  CalendarClock,
  RotateCcw,
  Sun,
  Moon,
  CloudSun,
  Check,
  Droplets,
  Heart,
  PhoneCall,
  Sparkles,
  DollarSign,
  Receipt,
  CreditCard,
  ChevronRight,
  TrendingUp,
  Undo2,
  CheckCircle2,
  Bell,
  Mail,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import { formatConsultationWindow } from "@/lib/timeUtils";

export default function PatientAppointmentsPage() {
  const { currentUser, setRole } = useRole();
  const [activeTab, setActiveTab] = useState<"VISITS" | "EHR" | "INVOICES" | "PREFERENCES">("VISITS");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [preferences, setPreferences] = useState<PatientNotificationPreferences>({
    emailEnabled: true,
    smsEnabled: true,
    remindersEnabled: true,
    marketingConsent: false,
  });
  const [savingPrefs, setSavingPrefs] = useState<boolean>(false);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [prescriptionAppt, setPrescriptionAppt] = useState<Appointment | null>(null);
  const [viewInvoice, setViewInvoice] = useState<BillingInvoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);

  // Reschedule State (TASK-004)
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [newDate, setNewDate] = useState<string>("");
  const [newTime, setNewTime] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; available: boolean; startTime?: string; endTime?: string }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null);

  // Cancellation & Refund Modal State (Day 4)
  const [cancelModalAppt, setCancelModalAppt] = useState<Appointment | null>(null);
  const [refundPreview, setRefundPreview] = useState<{
    paidAmount: number;
    refundAmount: number;
    percentage: number;
    policyTier: string;
    policyReason: string;
    hasOnlinePayment: boolean;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("Personal schedule conflict");
  const [cancelling, setCancelling] = useState<boolean>(false);

  useEffect(() => {
    fetchPatientData();
  }, [currentUser]);

  const fetchPatientData = async () => {
    setLoading(true);
    try {
      const pId = currentUser.patientId || "pat_1";
      const [apptRes, invRes, profRes, prefRes] = await Promise.all([
        fetch(`/api/appointments?patientId=${pId}`),
        fetch(`/api/admin/invoices?patientId=${pId}`),
        fetch(`/api/patient/profile?patientId=${pId}`),
        fetch(`/api/patient/preferences?patientId=${pId}`),
      ]);

      const [apptData, invData, profData, prefData] = await Promise.all([
        apptRes.json(),
        invRes.json(),
        profRes.json(),
        prefRes.json(),
      ]);

      setAppointments(apptData.appointments || []);
      setInvoices(invData.invoices || []);
      if (profData.success) setProfile(profData.profile);
      if (prefData.success && prefData.preferences) setPreferences(prefData.preferences);
    } catch (err) {
      console.error("Failed to load patient data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePreference = async (key: keyof PatientNotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    setSavingPrefs(true);
    setPrefsSuccess(null);
    try {
      const pId = currentUser.patientId || "pat_1";
      const res = await fetch("/api/patient/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: pId,
          preferences: { [key]: updated[key] },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPrefsSuccess("Communication preferences updated successfully.");
        setTimeout(() => setPrefsSuccess(null), 3000);
      }
    } catch (err) {
      console.error("Failed to update preferences", err);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setPayingInvoice(invoiceId);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", paymentMethod: "Credit Card (Online Portal)" }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(invoices.map((inv) => (inv.id === invoiceId ? data.invoice : inv)));
        if (viewInvoice && viewInvoice.id === invoiceId) {
          setViewInvoice(data.invoice);
        }
      }
    } catch (err) {
      console.error("Failed to settle invoice", err);
    } finally {
      setPayingInvoice(null);
    }
  };

  const openRescheduleModal = (appt: Appointment) => {
    setRescheduleAppt(appt);
    setRescheduleReason("");
    setRescheduleSuccess(null);
    setNewTime("");
    // Default to tomorrow or next weekday
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    setNewDate(dateStr);
    fetchSlotsForReschedule(appt.doctorId, dateStr);
  };

  const fetchSlotsForReschedule = async (doctorId: string, date: string) => {
    setLoadingSlots(true);
    setNewTime("");
    try {
      const res = await fetch(`/api/doctors/${doctorId}?date=${date}`);
      const data = await res.json();
      setRescheduleSlots(data.availableSlots || []);
    } catch (err) {
      console.error("Failed to load slots for rescheduling", err);
      setRescheduleSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleAppt || !newDate || !newTime) return;

    setActionLoading(rescheduleAppt.id);
    try {
      const res = await fetch(`/api/appointments/${rescheduleAppt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "RESCHEDULE",
          newDate,
          newTime,
          reason: rescheduleReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reschedule appointment");
      }

      setRescheduleSuccess(
        `Visit rescheduled to ${newDate} at ${newTime} (Token #${data.appointment?.tokenNumber || "Updated"})`
      );
      setTimeout(() => {
        setRescheduleAppt(null);
        setRescheduleSuccess(null);
      }, 1500);
      await fetchPatientData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error rescheduling visit");
    } finally {
      setActionLoading(null);
    }
  };

  const getDosageScheduleBadges = (frequency: string) => {
    const lower = frequency.toLowerCase();
    const isMorning =
      lower.includes("morning") ||
      lower.includes("daily") ||
      lower.includes("once") ||
      lower.includes("twice") ||
      lower.includes("thrice") ||
      lower.includes("1-0") ||
      lower.includes("1-1");
    const isNoon = lower.includes("noon") || lower.includes("lunch") || lower.includes("thrice") || lower.includes("-1-");
    const isNight =
      lower.includes("night") ||
      lower.includes("bedtime") ||
      lower.includes("evening") ||
      lower.includes("twice") ||
      lower.includes("thrice") ||
      lower.endsWith("-1") ||
      lower.includes("0-1");

    return (
      <div className="flex items-center space-x-1.5 mt-1">
        {isMorning && (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Sun className="w-2.5 h-2.5" />
            <span>Morning</span>
          </span>
        )}
        {isNoon && (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
            <CloudSun className="w-2.5 h-2.5" />
            <span>Noon</span>
          </span>
        )}
        {isNight && (
          <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <Moon className="w-2.5 h-2.5" />
            <span>Night</span>
          </span>
        )}
      </div>
    );
  };

  const openCancelModal = async (appt: Appointment) => {
    setCancelModalAppt(appt);
    setCancelReason("Personal schedule conflict");
    setRefundPreview(null);
    try {
      const res = await fetch(`/api/payments/refund?appointmentId=${appt.id}`);
      const data = await res.json();
      if (data.success) {
        setRefundPreview(data);
      }
    } catch {
      // fallback calculation
    }
  };

  const handleConfirmCancelWithRefund = async () => {
    if (!cancelModalAppt) return;
    setCancelling(true);
    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: cancelModalAppt.id,
          reason: cancelReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel appointment');
      }
      setCancelModalAppt(null);
      await fetchPatientData();
    } catch (err: any) {
      alert(err.message || 'Error processing cancellation');
    } finally {
      setCancelling(false);
    }
  };

  const handleCancel = async (id: string) => {
    const appt = appointments.find(a => a.id === id);
    if (appt) {
      openCancelModal(appt);
      return;
    }
    if (!confirm("Are you sure you want to cancel this appointment?")) return;

    setActionLoading(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to cancel appointment");
      }

      await fetchPatientData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error cancelling appointment");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (filter === "UPCOMING") return appt.status === "CONFIRMED" || appt.status === "SCHEDULED" || (appt.status as string) === "PENDING";
    if (filter === "COMPLETED") return appt.status === "COMPLETED";
    if (filter === "CANCELLED") return appt.status === "CANCELLED";
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3 h-3" />
            <span>Confirmed</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <CheckCircle className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span>{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Title & Booking CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Patient Portal & Appointments
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Active Patient: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser.name}</span> ({currentUser.email})
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            href="/doctors"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-2 shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Book New Appointment</span>
          </Link>
        </div>
      </div>

      {/* Patient Health Profile & Vitals Mini-Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Verified Patient Health Record (MPI)
            </span>
            <span className="text-emerald-400 text-xs font-mono font-bold">{profile?.mrn || "MRN-2026-0941"}</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">{currentUser.name}</h2>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <span className="flex items-center space-x-1.5">
              <Droplets className="w-3.5 h-3.5 text-rose-400" />
              <span>Blood Group: <strong className="text-white">{profile?.bloodGroup || "O+"}</strong></span>
            </span>
            <span className="flex items-center space-x-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              <span>BP: <strong className="text-white">120/80 mmHg</strong> (Pulse 72 bpm)</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <BadgeAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Allergies: <strong className="text-white">{profile?.allergies?.join(", ") || "Penicillin"}</strong></span>
            </span>
            <span className="flex items-center space-x-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-sky-400" />
              <span>Emergency: <strong className="text-white">{profile?.emergencyContact?.phone || "+1 (555) 987-1234"}</strong></span>
            </span>
          </div>
        </div>

        {/* Mini Stats */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-white/10 rounded-2xl px-4 py-3 text-center border border-white/10 min-w-[80px]">
            <div className="text-2xl font-black text-white">{appointments.length}</div>
            <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Total Visits</div>
          </div>
          <div className="bg-emerald-500/20 rounded-2xl px-4 py-3 text-center border border-emerald-500/30 min-w-[80px]">
            <div className="text-2xl font-black text-emerald-400">
              {appointments.filter((a) => a.status === "CONFIRMED" || a.status === "SCHEDULED").length}
            </div>
            <div className="text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">Upcoming</div>
          </div>
          <div className="bg-blue-500/20 rounded-2xl px-4 py-3 text-center border border-blue-500/30 min-w-[80px]">
            <div className="text-2xl font-black text-blue-400">
              {invoices.length}
            </div>
            <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider">Invoices</div>
          </div>
        </div>
      </div>

      {/* Patient Module Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {[
          { id: "VISITS", label: "My Appointments", icon: Calendar, count: appointments.length },
          { id: "EHR", label: "Longitudinal EHR Timeline", icon: Activity, count: appointments.filter(a => a.status === "COMPLETED").length },
          { id: "INVOICES", label: "Invoices & Receipts", icon: DollarSign, count: invoices.length },
          { id: "PREFERENCES", label: "Notification Channels & Preferences", icon: Bell, count: null },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  isActive ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Demo Tip Banner */}
      <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start space-x-3 text-xs text-emerald-900 dark:text-emerald-200">
        <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          <strong>Demo Workflow Tip:</strong> When you book or cancel an appointment here, switch your role to{" "}
          <button
            onClick={() => setRole("doc-01")}
            className="font-bold underline text-emerald-800 dark:text-emerald-300 hover:text-emerald-950"
          >
            Dr. Jane Smith
          </button>{" "}
          using the top-right persona switcher to see the doctor OPD queue, consultation desk, and prescription workflow react immediately!
        </p>
      </div>

      {/* TAB 1: VISITS & APPOINTMENTS */}
      {activeTab === "VISITS" && (
        <div className="space-y-6">
          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {[
              { key: "ALL", label: "All Bookings" },
              { key: "UPCOMING", label: "Upcoming / Confirmed" },
              { key: "COMPLETED", label: "Completed" },
              { key: "CANCELLED", label: "Cancelled" },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                  filter === t.key
                    ? "bg-slate-900 dark:bg-emerald-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

      {/* Appointments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white text-lg">No appointments found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You don't have any appointments matching this category. Ready to see a doctor?
          </p>
          <Link
            href="/doctors"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Schedule First Visit</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center md:justify-between gap-6"
            >
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">
                      {appt.doctorName || appt.doctor?.name || "Consulting Specialist"}
                    </h3>
                    {getStatusBadge(appt.status)}
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      Token #OPD-{String(appt.tokenNumber || 1).padStart(2, "0")}
                    </span>
                    {appt.rescheduledAt && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <RotateCcw className="w-3 h-3 text-amber-600" />
                        <span>Rescheduled</span>
                      </span>
                    )}
                    {appt.paymentStatus === 'PAID' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Paid (${appt.fee || 75})</span>
                      </span>
                    )}
                    {appt.refundStatus === 'SUCCEEDED' && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Undo2 className="w-3 h-3 text-blue-600" />
                        <span>Refunded ${appt.refundAmount || appt.fee}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {appt.doctorSpecialty || appt.doctor?.specialty || appt.doctor?.specialization || "Outpatient Clinical Consultation"}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{appt.date}</span>
                    </span>
                    <span className="flex items-center space-x-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time)}</span>
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">Ref: {appt.id}</span>
                  </div>

                  {appt.symptoms && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">Reason / Symptoms:</span> {appt.symptoms}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                {/* Add to Calendar (.ics) for active visits */}
                {appt.status !== "CANCELLED" && (
                  <button
                    onClick={() => downloadCalendarEvent(appt)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 transition"
                    title="Export .ics Calendar Event"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Calendar (.ics)</span>
                  </button>
                )}

                {/* View Prescription if completed */}
                {appt.status === "COMPLETED" && appt.prescription && (
                  <button
                    onClick={() => setPrescriptionAppt(appt)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center space-x-1.5 shadow-sm transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Prescription Slip</span>
                  </button>
                )}

                {appt.status !== "CANCELLED" && appt.status !== "COMPLETED" && (
                  <>
                    <button
                      onClick={() => openRescheduleModal(appt)}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1.5 transition"
                      title="Reschedule this visit"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reschedule</span>
                    </button>
                    <button
                      disabled={actionLoading === appt.id}
                      onClick={() => openCancelModal(appt)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800 transition cursor-pointer"
                    >
                      Cancel Visit & Refund
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      )}

      {/* TAB 2: LONGITUDINAL EHR MEDICAL TIMELINE */}
      {activeTab === "EHR" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Longitudinal Electronic Medical Record (EMR)</h2>
              <p className="text-xs text-slate-500">Comprehensive chronological encounter timeline and prescription records</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {profile?.mrn || "MRN-2026-0941"}
            </span>
          </div>

          {appointments.filter(a => a.status === "COMPLETED").length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
              <Activity className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No completed consultations yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Once a doctor conducts an OPD consultation and signs off your clinical SOAP note, your permanent medical history will appear here.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-emerald-500 ml-4 sm:ml-6 pl-6 space-y-8">
              {appointments
                .filter(a => a.status === "COMPLETED")
                .map((appt) => (
                  <div key={appt.id} className="relative group">
                    {/* Timeline Node Dot */}
                    <div className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full bg-emerald-600 border-4 border-white dark:border-slate-950 shadow-xs" />

                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                      
                      {/* Visit Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={appt.doctorAvatar || "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300"}
                            alt={appt.doctorName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white">
                              {appt.doctorName} • <span className="text-emerald-600 dark:text-emerald-400">{appt.doctorSpecialty}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                              <span>Encounter Date: {appt.date} ({formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time)})</span>
                              <span>•</span>
                              <span className="font-mono">Ref: {appt.id}</span>
                            </div>
                          </div>
                        </div>

                        {appt.prescription && (
                          <button
                            onClick={() => setPrescriptionAppt(appt)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer self-start sm:self-center"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Clinical Slip</span>
                          </button>
                        )}
                      </div>

                      {/* Clinical Assessment / Diagnosis */}
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Diagnosis & Assessment</span>
                        <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                          {appt.prescription?.diagnosis || "Clinical Review & Examination"}
                        </div>
                        {appt.prescription?.advice && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <strong>Doctor's Advice:</strong> {appt.prescription.advice}
                          </p>
                        )}
                      </div>

                      {/* Prescribed Medications */}
                      {appt.prescription && appt.prescription.medicines.length > 0 && (
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Pill className="w-3 h-3 text-emerald-600" />
                            <span>Prescribed Pharmacotherapy</span>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                            {appt.prescription.medicines.map((med, mIdx) => (
                              <div key={mIdx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                                <div className="font-bold text-slate-900 dark:text-white">{med.medicineName}</div>
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{med.dosage} • {med.frequency}</div>
                                <div className="text-[10px] text-slate-400">Duration: {med.duration}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Ordered Lab Tests */}
                      {appt.prescription?.labOrders && appt.prescription.labOrders.length > 0 && (
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                            Pathology & Diagnostic Orders
                          </span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {appt.prescription.labOrders.map((lab, lIdx) => (
                              <span key={lIdx} className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {lab}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INVOICES & RECEIPTS */}
      {activeTab === "INVOICES" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Hospital Billing Statements & Receipts</h2>
              <p className="text-xs text-slate-500">Itemized billing statements, payment receipts, and settlement ledger</p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Total Invoices: {invoices.length}
            </span>
          </div>

          {invoices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-3">
              <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No billing invoices found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Invoices are generated upon completing consultation encounters or ordering diagnostic investigations.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {inv.invoiceNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                      }`}>
                        {inv.status}
                      </span>
                      {inv.paymentMethod && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          via {inv.paymentMethod}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      {inv.items.map(item => item.description).join(" • ")}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Invoice Date: {inv.date}</span>
                      <span>•</span>
                      <span>Provider: {inv.doctorName || "OPD Clinic"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <div className="text-right mr-2">
                      <div className="font-black text-slate-900 dark:text-white text-base">
                        ${inv.total.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-400">Tax incl.</div>
                    </div>

                    <button
                      onClick={() => setViewInvoice(inv)}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                      title="View / Print Receipt"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {inv.status === "PENDING" && (
                      <button
                        onClick={() => handlePayInvoice(inv.id)}
                        disabled={payingInvoice === inv.id}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
                      >
                        {payingInvoice === inv.id ? (
                          <Activity className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5" />
                        )}
                        <span>Pay Online</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMUNICATION & NOTIFICATION PREFERENCES */}
      {activeTab === "PREFERENCES" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Patient Communication & Delivery Channels</h2>
              <p className="text-xs text-slate-500">Configure your email, SMS, and automated reminder alerts adhering to HIPAA confidentiality guardrails</p>
            </div>
            {prefsSuccess && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{prefsSuccess}</span>
              </div>
            )}
          </div>

          {/* Privacy notice banner */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <span className="font-bold text-slate-900 dark:text-white block">Zero-PHI Privacy Guarantee (HIPAA Compliant)</span>
              <p>
                Medrella notification channels transmit only operational scheduling tokens, doctor details, and payment receipts. Unencrypted messages never contain clinical diagnoses, symptoms, or prescription records.
              </p>
            </div>
          </div>

          {/* Preferences Card List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Channel 1: Email */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Email Notifications</h3>
                      <span className="text-[10px] text-slate-400 font-medium">To: {currentUser.email || "Registered Email"}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    preferences.emailEnabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {preferences.emailEnabled ? "ENABLED" : "MUTED"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Receive HTML confirmation slips, doctor rescheduling/leave notices, and itemized billing receipts.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Alerts</span>
                <button
                  onClick={() => handleTogglePreference('emailEnabled')}
                  disabled={savingPrefs}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    preferences.emailEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.emailEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Channel 2: SMS Text */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">SMS Text Alerts</h3>
                      <span className="text-[10px] text-slate-400 font-medium">To: Registered Mobile Phone</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    preferences.smsEnabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {preferences.smsEnabled ? "ENABLED" : "MUTED"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Instant text alerts for OPD token number assignment, emergency shift cancellations, and refund confirmations.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">SMS Alerts</span>
                <button
                  onClick={() => handleTogglePreference('smsEnabled')}
                  disabled={savingPrefs}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    preferences.smsEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.smsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Channel 3: Automated Reminders (24h & 1h) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Consultation Reminders</h3>
                      <span className="text-[10px] text-slate-400 font-medium">Cadence: 24h & 1h Prior</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    preferences.remindersEnabled ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {preferences.remindersEnabled ? "ACTIVE" : "PAUSED"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Automated background reminder scheduler delivers notifications 24 hours prior and 1 hour before OPD check-in.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pre-Visit Reminders</span>
                <button
                  onClick={() => handleTogglePreference('remindersEnabled')}
                  disabled={savingPrefs}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    preferences.remindersEnabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.remindersEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Channel 4: Optional Marketing & Wellness Updates */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Health & Wellness Advisories</h3>
                      <span className="text-[10px] text-slate-400 font-medium">Optional Marketing</span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    preferences.marketingConsent ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  }`}>
                    {preferences.marketingConsent ? "OPTED IN" : "OPTED OUT"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Seasonal vaccine reminders, clinical wellness workshops, and cardiology health tips. Opt-in is completely voluntary.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Wellness Updates</span>
                <button
                  onClick={() => handleTogglePreference('marketingConsent')}
                  disabled={savingPrefs}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    preferences.marketingConsent ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      preferences.marketingConsent ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PATIENT INVOICE & RECEIPT MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Hospital Billing Receipt
                </h3>
              </div>
              <button 
                onClick={() => setViewInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{viewInvoice.invoiceNumber}</div>
                  <div className="text-[10px] text-slate-500">{viewInvoice.date}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{viewInvoice.patientName}</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">{viewInvoice.patientMRN}</div>
                </div>
              </div>

              <div className="space-y-1.5 py-1">
                {viewInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>{item.description} (x{item.quantity})</span>
                    <span className="font-bold">${item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>${viewInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Tax (5%):</span>
                  <span>${viewInvoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Amount:</span>
                  <span>${viewInvoice.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 text-center">
                Status: <span className="font-bold text-emerald-600 uppercase">{viewInvoice.status}</span>
                {viewInvoice.paymentMethod && ` via ${viewInvoice.paymentMethod}`}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>

              {viewInvoice.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => handlePayInvoice(viewInvoice.id)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Pay Online
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hospital Medical Slip & Prescription Modal */}
      {prescriptionAppt && prescriptionAppt.prescription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <HeartPulse className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-wide">Official Medical Consultation Slip</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 text-slate-200 border border-slate-700 transition"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setPrescriptionAppt(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-200">
              {/* Hospital Letterhead */}
              <div className="border-b-2 border-emerald-600 pb-4 flex justify-between items-start">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                      MED<span className="text-emerald-600">RELLA</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded">
                      Outpatient Clinic
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Metropolitan Hospital Center • 402 Health Avenue • Tel: (555) 019-8372
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                    TOKEN #OPD-{String(prescriptionAppt.tokenNumber || 1).padStart(2, "0")}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Date: {prescriptionAppt.date}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Ref: {prescriptionAppt.id}
                  </div>
                </div>
              </div>

              {/* Patient & Doctor Demographics */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Patient Details</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{prescriptionAppt.patientName}</div>
                  <div className="text-slate-500 dark:text-slate-400">Contact: {prescriptionAppt.patientPhone}</div>
                  <div className="text-slate-500 dark:text-slate-400">Email: {prescriptionAppt.patientEmail}</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Consulting Physician</span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{prescriptionAppt.doctorName}</div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-semibold">{prescriptionAppt.doctorSpecialty}</div>
                  <div className="text-slate-500 dark:text-slate-400">Cardiology & Internal Medicine Desk</div>
                </div>
              </div>

              {/* Clinical Diagnosis */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Clinical Diagnosis / Assessment</span>
                </span>
                <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl font-semibold text-slate-900 dark:text-white text-sm">
                  {prescriptionAppt.prescription.diagnosis}
                </div>
              </div>

              {/* Prescription / Rx Section */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                  <Pill className="w-3.5 h-3.5 text-blue-600" />
                  <span>Rx — Prescribed Medications</span>
                </span>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Medicine</th>
                        <th className="py-2.5 px-3">Dosage</th>
                        <th className="py-2.5 px-3">Frequency</th>
                        <th className="py-2.5 px-3">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {prescriptionAppt.prescription.medicines.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{med.medicineName}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{med.dosage}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            <div>{med.frequency}</div>
                            {getDosageScheduleBadges(med.frequency)}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-emerald-700 dark:text-emerald-400">{med.duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Advice & Follow-Up */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prescriptionAppt.prescription.advice && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">Doctor's Advice & Guidelines</span>
                    <p className="text-slate-600 dark:text-slate-400">{prescriptionAppt.prescription.advice}</p>
                  </div>
                )}
                {prescriptionAppt.prescription.followUpDate && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900 text-xs space-y-1">
                    <span className="font-bold text-blue-900 dark:text-blue-300 uppercase text-[10px]">Next Follow-up Consultation</span>
                    <div className="font-semibold text-blue-800 dark:text-blue-200 text-sm">{prescriptionAppt.prescription.followUpDate}</div>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">Book through patient portal 3 days in advance.</p>
                  </div>
                )}
              </div>

              {/* Digital Signature Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Electronic Health Record (EHR)</span>
                </div>
                <div className="text-right">
                  <div className="font-serif italic font-bold text-slate-900 dark:text-white text-sm">
                    {prescriptionAppt.doctorName}
                  </div>
                  <div className="text-[10px] text-slate-400">Lic. #MD-2039-MEDRELLA</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Consultation Modal (TASK-004) */}
      {rescheduleAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <CalendarClock className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm tracking-wide">Reschedule Clinical Appointment</h3>
              </div>
              <button
                onClick={() => setRescheduleAppt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="p-6 space-y-5">
              {/* Current Appointment Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {rescheduleAppt.doctorName || "Consulting Specialist"}
                </div>
                <div className="text-emerald-700 dark:text-emerald-400 font-semibold">
                  {rescheduleAppt.doctorSpecialty || "Specialist"}
                </div>
                <div className="text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 pt-1">
                  <span>Current: <strong className="text-slate-800 dark:text-slate-200">{rescheduleAppt.date}</strong> ({formatConsultationWindow(rescheduleAppt.startTime, rescheduleAppt.endTime, rescheduleAppt.timeSlot || rescheduleAppt.time)})</span>
                  <span>•</span>
                  <span>Token: <strong className="text-slate-800 dark:text-slate-200">#OPD-{String(rescheduleAppt.tokenNumber || 1).padStart(2, "0")}</strong></span>
                </div>
              </div>

              {rescheduleSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{rescheduleSuccess}</span>
                </div>
              )}

              {/* Select Target Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Select Target Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split("T")[0]}
                  value={newDate}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    if (rescheduleAppt) {
                      fetchSlotsForReschedule(rescheduleAppt.doctorId, e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Select Slot */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Available Slots for {newDate}
                </label>

                {loadingSlots ? (
                  <div className="grid grid-cols-3 gap-2 py-2">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                    No available consultation slots on this date. Doctor may not practice on this day or all slots are booked.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      {rescheduleSlots.map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setNewTime(slot.time)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition border text-center ${
                            newTime === slot.time
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : slot.available
                              ? "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-300"
                              : "bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 border-transparent cursor-not-allowed line-through"
                          }`}
                        >
                          <span className="block font-bold">{slot.startTime || slot.time}</span>
                          {slot.endTime && (
                            <span className={`block text-[10px] ${newTime === slot.time ? "text-emerald-100" : "text-slate-400 dark:text-slate-500"}`}>
                              to {slot.endTime}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reason (Optional) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Reason for Rescheduling (Optional)
                </label>
                <textarea
                  rows={2}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Schedule conflict or earlier symptom checkup"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRescheduleAppt(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTime || actionLoading === rescheduleAppt.id}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-2"
                >
                  {actionLoading === rescheduleAppt.id ? (
                    <span>Reallocating Slot...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm Reschedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CANCELLATION & REFUND POLICY MODAL (Day 4) */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-500/20 text-rose-400 rounded-xl">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Cancel Consultation & Process Refund</h3>
                  <p className="text-xs text-slate-400">Hospital Cancellation & Refund Policy Enforcement</p>
                </div>
              </div>
              <button
                onClick={() => setCancelModalAppt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Appointment summary */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Consultation:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{cancelModalAppt.doctorName} ({cancelModalAppt.doctorSpecialty})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Schedule:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{cancelModalAppt.date} • {formatConsultationWindow(cancelModalAppt.startTime, cancelModalAppt.endTime, cancelModalAppt.timeSlot || cancelModalAppt.time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Booking Reference:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{cancelModalAppt.id}</span>
                </div>
              </div>

              {/* Policy Calculation Preview */}
              {refundPreview ? (
                <div className="space-y-3">
                  <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                    refundPreview.percentage === 100
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : refundPreview.percentage > 0
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                  }`}>
                    <div className="flex items-center justify-between font-bold text-sm">
                      <span>Eligible Refund ({refundPreview.percentage}% Policy)</span>
                      <span className="font-extrabold text-base">${refundPreview.refundAmount.toFixed(2)} USD</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">{refundPreview.policyReason}</p>
                  </div>

                  <div className="text-[11px] text-slate-500 flex justify-between px-1">
                    <span>Consultation Fee Paid: ${refundPreview.paidAmount.toFixed(2)}</span>
                    <span>Refund Processing: Immediate Gateway Dispatch</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-500 animate-pulse text-center">
                  Calculating hospital policy refund entitlement...
                </div>
              )}

              {/* Cancellation Reason Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Select Reason for Cancellation
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Personal schedule conflict",
                    "Feeling better / recovered",
                    "Need to see different specialist",
                    "Rescheduled to another week",
                    "Emergency",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCancelReason(r)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        cancelReason === r
                          ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 font-bold"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Additional feedback or cancellation details..."
                  className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Notice */}
              <p className="text-[10px] text-slate-500 leading-tight">
                * Note: Appointment cancellation frees your assigned OPD queue token and releases all scheduled automated reminders.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancelModalAppt(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition cursor-pointer"
                >
                  Keep Appointment
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleConfirmCancelWithRefund}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center space-x-2 cursor-pointer"
                >
                  {cancelling ? (
                    <span>Processing Refund...</span>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirm Cancellation & Refund</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
