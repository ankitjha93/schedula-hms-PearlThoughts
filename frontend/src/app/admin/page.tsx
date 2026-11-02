"use client";

import { useState, useEffect } from "react";
import { 
  HospitalKPIs, 
  Doctor, 
  Department, 
  BillingInvoice, 
  AuditLog, 
  InvoiceStatus,
  NotificationLog,
} from "@/lib/types";
import { useRole } from "@/components/RoleContext";
import {
  Building2,
  Users,
  DollarSign,
  Activity,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  RefreshCw,
  FileText,
  Printer,
  X,
  CreditCard,
  Briefcase,
  Layers,
  Sparkles,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Building,
  Bell,
  Mail,
  MessageSquare,
  Send,
  CalendarX,
  RotateCcw,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { currentUser, setRole } = useRole();
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "DOCTORS" | "DEPARTMENTS" | "BILLING" | "AUDIT" | "NOTIFICATIONS">("OVERVIEW");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Data states
  const [stats, setStats] = useState<HospitalKPIs | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [notificationStats, setNotificationStats] = useState({ total: 0, sent: 0, failed: 0, pending: 0 });

  // Filters & Search
  const [doctorSearch, setDoctorSearch] = useState<string>("");
  const [doctorDeptFilter, setDoctorDeptFilter] = useState<string>("ALL");
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>("ALL");
  const [notifChannelFilter, setNotifChannelFilter] = useState<string>("ALL");
  const [notifStatusFilter, setNotifStatusFilter] = useState<string>("ALL");

  // Notification Modals & Retry States
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);
  const [retryResultMsg, setRetryResultMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState<boolean>(false);
  const [leaveDoctorId, setLeaveDoctorId] = useState<string>("");
  const [leaveDate, setLeaveDate] = useState<string>("");
  const [leaveReason, setLeaveReason] = useState<string>("Emergency clinical duty / unplanned leave");
  const [submittingLeave, setSubmittingLeave] = useState<boolean>(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddDoctorModal, setShowAddDoctorModal] = useState<boolean>(false);
  const [viewInvoice, setViewInvoice] = useState<BillingInvoice | null>(null);
  const [submittingDoctor, setSubmittingDoctor] = useState<boolean>(false);
  const [statusActionLoading, setStatusActionLoading] = useState<string | null>(null);

  // New Doctor Form State
  const [newDoctor, setNewDoctor] = useState({
    name: "",
    specialization: "Cardiology",
    experienceYears: 8,
    consultationFee: 75,
    education: "MD - Medical School",
    hospital: "Medrella Central Hospital",
    departmentCode: "CARD",
    roomNumber: "Room 401",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    about: "",
  });

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [statsRes, doctorsRes, deptsRes, invoicesRes, auditRes, notifRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/doctors"),
        fetch("/api/admin/departments"),
        fetch("/api/admin/invoices"),
        fetch("/api/admin/audit-logs"),
        fetch("/api/notifications/logs"),
      ]);

      const [statsData, doctorsData, deptsData, invoicesData, auditData, notifData] = await Promise.all([
        statsRes.json(),
        doctorsRes.json(),
        deptsRes.json(),
        invoicesRes.json(),
        auditRes.json(),
        notifRes.json(),
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (doctorsData.success) setDoctors(doctorsData.doctors);
      if (deptsData.success) setDepartments(deptsData.departments);
      if (invoicesData.success) setInvoices(invoicesData.invoices);
      if (auditData.success) setAuditLogs(auditData.logs);
      if (notifData.success) {
        setNotificationLogs(notifData.logs || []);
        if (notifData.stats) setNotificationStats(notifData.stats);
      }
    } catch (err) {
      console.error("Failed to load admin datasets", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchNotificationLogs = async (channel = notifChannelFilter, status = notifStatusFilter) => {
    try {
      const params = new URLSearchParams();
      if (channel !== "ALL") params.append("channel", channel);
      if (status !== "ALL") params.append("status", status);
      const res = await fetch(`/api/notifications/logs?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setNotificationLogs(data.logs || []);
        if (data.stats) setNotificationStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch notification logs", err);
    }
  };

  const handleRetryNotification = async (logId: string) => {
    setRetryingLogId(logId);
    setRetryResultMsg(null);
    try {
      const res = await fetch("/api/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId }),
      });
      const data = await res.json();
      if (data.success) {
        setRetryResultMsg({ text: "Delivery succeeded! Recipient received notification.", isError: false });
        fetchNotificationLogs();
      } else {
        setRetryResultMsg({ text: data.error || "Retry failed.", isError: true });
        fetchNotificationLogs();
      }
    } catch (err: any) {
      setRetryResultMsg({ text: err.message || "Retry request failed.", isError: true });
    } finally {
      setRetryingLogId(null);
    }
  };

  const handleBroadcastDoctorLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveDoctorId || !leaveDate) return;
    setSubmittingLeave(true);
    setLeaveSuccessMsg(null);
    try {
      const res = await fetch("/api/doctor/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: leaveDoctorId,
          date: leaveDate,
          reason: leaveReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLeaveSuccessMsg(data.message || `Leave logged. ${data.affectedCount} patient(s) notified.`);
        fetchNotificationLogs();
        setTimeout(() => {
          setShowLeaveModal(false);
          setLeaveSuccessMsg(null);
        }, 3000);
      } else {
        alert(data.error || "Failed to process leave broadcast.");
      }
    } catch (err: any) {
      alert(err.message || "Error submitting leave.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllAdminData();
  };

  const handleCreateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoctor.name || !newDoctor.specialization || !newDoctor.consultationFee) return;

    setSubmittingDoctor(true);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDoctor),
      });
      const data = await res.json();
      if (data.success) {
        setDoctors([data.doctor, ...doctors]);
        setShowAddDoctorModal(false);
        setNewDoctor({
          name: "",
          specialization: "Cardiology",
          experienceYears: 8,
          consultationFee: 75,
          education: "MD - Medical School",
          hospital: "Medrella Central Hospital",
          departmentCode: "CARD",
          roomNumber: "Room 401",
          availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          about: "",
        });
        fetchAllAdminData(); // Refresh metrics
      } else {
        alert(data.error || "Failed to onboard doctor");
      }
    } catch (err) {
      console.error(err);
      alert("Error adding doctor");
    } finally {
      setSubmittingDoctor(false);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: InvoiceStatus, method: string = "Cash") => {
    setStatusActionLoading(invoiceId);
    try {
      const res = await fetch(`/api/admin/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, paymentMethod: method }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(invoices.map(inv => inv.id === invoiceId ? data.invoice : inv));
        if (viewInvoice && viewInvoice.id === invoiceId) {
          setViewInvoice(data.invoice);
        }
        // Refresh aggregate stats
        const statsRes = await fetch("/api/admin/stats");
        const statsData = await statsRes.json();
        if (statsData.success) setStats(statsData.stats);
      }
    } catch (err) {
      console.error("Failed to update invoice status", err);
    } finally {
      setStatusActionLoading(null);
    }
  };

  // Filtered lists
  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(doctorSearch.toLowerCase()) ||
      doc.specialization.toLowerCase().includes(doctorSearch.toLowerCase());
    const matchesDept = doctorDeptFilter === "ALL" || doc.specialization.toLowerCase() === doctorDeptFilter.toLowerCase();
    return matchesSearch && matchesDept;
  });

  const filteredInvoices = invoices.filter((inv) => {
    if (billingStatusFilter === "ALL") return true;
    return inv.status === billingStatusFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      
      {/* Top Admin Banner */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl text-white shadow-md shadow-emerald-600/20">
                <Building2 className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Hospital Administration & Governance
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    Live System
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Danphe EMR-compatible clinical operations, provider credentialing, itemized billing ledger, and security audit logs.
                </p>
              </div>
            </div>

            {/* Quick Actions & Role Indicator */}
            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col text-right mr-1">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{currentUser.name}</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                  {currentUser.role} Control
                </span>
              </div>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh Metrics"
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
              </button>

              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-xs transition cursor-pointer"
                title="Broadcast Doctor Leave & Auto-Cancel Visits"
              >
                <CalendarX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="hidden md:inline">Doctor Leave Broadcast</span>
              </button>

              <button
                onClick={() => setShowAddDoctorModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Onboard Doctor</span>
              </button>
            </div>

          </div>

          {/* Module Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-6 overflow-x-auto border-t border-slate-100 dark:border-slate-800/80 pt-3">
            {[
              { id: "OVERVIEW", label: "Executive Overview", icon: Activity, count: null },
              { id: "DOCTORS", label: "Specialist Roster", icon: Users, count: doctors.length },
              { id: "DEPARTMENTS", label: "Departments", icon: Building, count: departments.length },
              { id: "BILLING", label: "Hospital Billing Ledger", icon: DollarSign, count: invoices.length },
              { id: "AUDIT", label: "System Audit Trail", icon: ShieldCheck, count: auditLogs.length },
              { id: "NOTIFICATIONS", label: "Delivery Logs & Audit", icon: Bell, count: notificationLogs.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
            <p className="text-sm font-semibold text-slate-500">Loading hospital administration datasets...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: EXECUTIVE OVERVIEW */}
            {activeTab === "OVERVIEW" && (
              <div className="space-y-6">
                
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Revenue Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Settled Revenue</span>
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        ${stats?.totalRevenue ? stats.totalRevenue.toFixed(2) : "0.00"}
                      </span>
                      <span className="text-xs font-bold text-emerald-600 flex items-center">
                        <TrendingUp className="w-3 h-3 mr-0.5" /> +14.2%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">From settled consultation & lab orders</p>
                  </div>

                  {/* Daily OPD Footfall */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's OPD Queue</span>
                      <div className="p-2 rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
                        <Activity className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {stats?.activeAppointmentsToday ?? 0} Visits
                      </span>
                      <span className="text-xs font-bold text-teal-600">Active</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {stats?.completedVisitsCount ?? 0} encounters signed off
                    </p>
                  </div>

                  {/* Active Providers */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Medical Staff</span>
                      <div className="p-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
                        <Users className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {stats?.totalDoctors ?? 0} Doctors
                      </span>
                      <span className="text-xs font-bold text-blue-600">5 Specialties</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Across 5 hospital clinical departments</p>
                  </div>

                  {/* Pending Invoices */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unsettled Invoices</span>
                      <div className="p-2 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {stats?.pendingInvoicesCount ?? 0} Invoices
                      </span>
                      <span className="text-xs font-bold text-slate-400">Pending Pay</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">Awaiting cashier or patient settlement</p>
                  </div>

                </div>

                {/* Operations Grid: Department Throughput & Operational Ledger */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Department Overview */}
                  <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Department Capacity & Utilization</h2>
                        <p className="text-xs text-slate-500">Live operational status across outpatient wings</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab("DEPARTMENTS")}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>View All</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {departments.map((dept) => (
                        <div key={dept.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-extrabold flex items-center justify-center text-xs">
                              {dept.code}
                            </div>
                            <div>
                              <div className="font-bold text-xs text-slate-900 dark:text-white">{dept.name}</div>
                              <div className="text-[11px] text-slate-500">{dept.location} • Head: {dept.headOfDepartment}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {dept.activeDoctorsCount} Specialists
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                              Active
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Audit Stream */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Live Audit Events</h2>
                        <p className="text-xs text-slate-500">Clinical & financial compliance stream</p>
                      </div>
                      <button 
                        onClick={() => setActiveTab("AUDIT")}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Full Log</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {auditLogs.slice(0, 5).map((log) => (
                        <div key={log.id} className="text-xs border-l-2 border-emerald-500 pl-3 py-1 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
                              {log.action.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300 text-[11px]">{log.resource}</div>
                          <div className="text-[10px] text-slate-400">{log.actor.name} ({log.actor.role})</div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* TAB 2: DOCTORS & SPECIALISTS ROSTER */}
            {activeTab === "DOCTORS" && (
              <div className="space-y-4">
                
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search doctor by name or specialty..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={doctorDeptFilter}
                      onChange={(e) => setDoctorDeptFilter(e.target.value)}
                      className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-hidden cursor-pointer"
                    >
                      <option value="ALL">All Specialties</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Dermatology">Dermatology</option>
                      <option value="Pediatrics">Pediatrics</option>
                      <option value="Orthopedics">Orthopedics</option>
                      <option value="Neurology">Neurology</option>
                    </select>

                    <button
                      onClick={() => setShowAddDoctorModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Specialist</span>
                    </button>
                  </div>
                </div>

                {/* Doctors Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          <th className="py-3 px-4">Doctor Specialist</th>
                          <th className="py-3 px-4">Department & Room</th>
                          <th className="py-3 px-4">Experience</th>
                          <th className="py-3 px-4">Consultation Fee</th>
                          <th className="py-3 px-4">Rating & Reviews</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {filteredDoctors.map((doc) => (
                          <tr key={doc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={doc.avatar}
                                  alt={doc.name}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white">{doc.name}</div>
                                  <div className="text-[11px] text-slate-500">{doc.education}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{doc.specialization}</span>
                              <div className="text-[11px] text-slate-500">{doc.roomNumber || "OPD Cabin 402"} • {doc.hospital}</div>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                              {doc.experienceYears} Years
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                                ${doc.consultationFee}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1 font-bold text-amber-500">
                                <span>★ {doc.rating.toFixed(1)}</span>
                                <span className="text-[10px] text-slate-400 font-normal">({doc.reviewsCount} reviews)</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                                Active OPD
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: DEPARTMENTS */}
            {activeTab === "DEPARTMENTS" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {departments.map((dept) => (
                  <div key={dept.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 font-black text-xs">
                            {dept.code}
                          </span>
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{dept.name}</h3>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                          {dept.status}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                        {dept.description}
                      </p>

                      <div className="space-y-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Head of Department:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{dept.headOfDepartment}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Facility Location:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{dept.location}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Active Staff:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{dept.activeDoctorsCount} Specialists</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                      <button 
                        onClick={() => {
                          setDoctorDeptFilter(dept.name);
                          setActiveTab("DOCTORS");
                        }}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Filter Specialists</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: HOSPITAL BILLING LEDGER */}
            {activeTab === "BILLING" && (
              <div className="space-y-4">
                
                {/* Billing Summary & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Filter Invoices:</span>
                    {["ALL", "PAID", "PENDING"].map((status) => (
                      <button
                        key={status}
                        onClick={() => setBillingStatusFilter(status)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          billingStatusFilter === status
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    Showing {filteredInvoices.length} billing ledger statements
                  </div>
                </div>

                {/* Invoices Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/75 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                          <th className="py-3 px-4">Invoice #</th>
                          <th className="py-3 px-4">Patient & MRN</th>
                          <th className="py-3 px-4">Doctor & Date</th>
                          <th className="py-3 px-4">Item Breakdown</th>
                          <th className="py-3 px-4">Total Amount</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                        {filteredInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-white">{inv.patientName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{inv.patientMRN}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{inv.doctorName || "OPD Clinic"}</div>
                              <div className="text-[11px] text-slate-500">{inv.date}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {inv.items.length} item(s): {inv.items[0]?.description}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="font-black text-slate-900 dark:text-white text-sm">
                                ${inv.total.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                inv.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                              }`}>
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setViewInvoice(inv)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                                  title="View Itemized Receipt"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>

                                {inv.status === "PENDING" && (
                                  <button
                                    onClick={() => handleUpdateInvoiceStatus(inv.id, "PAID", "Cash")}
                                    disabled={statusActionLoading === inv.id}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-xs cursor-pointer"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: SYSTEM AUDIT TRAIL */}
            {activeTab === "AUDIT" && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Security & Clinical Audit Trail</h2>
                    <p className="text-xs text-slate-500">Immutable operational activity stream adhering to HIPAA/EHR compliance</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Total Events: {auditLogs.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl mt-0.5 ${
                          log.severity === "CRITICAL"
                            ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                            : log.severity === "WARNING"
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                        }`}>
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                              {log.action.replace(/_/g, " ")}
                            </span>
                            <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {log.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">
                            {log.details || log.resource}
                          </p>
                          <div className="text-[10px] text-slate-400 mt-1">
                            Target Resource: <span className="font-mono text-slate-600 dark:text-slate-400">{log.resource}</span> • Actor: <span className="font-semibold">{log.actor.name}</span> ({log.actor.role})
                          </div>
                        </div>
                      </div>

                      <div className="text-right whitespace-nowrap text-[11px] text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: NOTIFICATION DELIVERY LOGS & AUDIT */}
            {activeTab === "NOTIFICATIONS" && (
              <div className="space-y-6">
                
                {/* Header & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Bell className="w-5 h-5 text-emerald-600" />
                      <span>Multi-Channel Notification Audit & Delivery Logs</span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real-time delivery verification for Email (Resend/SMTP) and SMS (Twilio/Simulated) with idempotency tracking
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowLeaveModal(true)}
                      className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CalendarX className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Doctor Leave Broadcast</span>
                    </button>
                    <button
                      onClick={() => fetchNotificationLogs()}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                      title="Refresh Notification Logs"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Status or Retry Banner */}
                {retryResultMsg && (
                  <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
                    retryResultMsg.isError
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                  }`}>
                    <div className="flex items-center gap-2">
                      {retryResultMsg.isError ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{retryResultMsg.text}</span>
                    </div>
                    <button onClick={() => setRetryResultMsg(null)} className="p-1 hover:opacity-70">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* 4 Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Dispatches</span>
                      <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{notificationStats.total}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <Send className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Delivered (Sent)</span>
                      <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{notificationStats.sent}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Delivery Failures</span>
                      <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{notificationStats.failed}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending / Retrying</span>
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{notificationStats.pending}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                  </div>
                </div>

                {/* Filter Controls */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" /> Channel:
                    </span>
                    {["ALL", "EMAIL", "SMS"].map((ch) => (
                      <button
                        key={ch}
                        onClick={() => {
                          setNotifChannelFilter(ch);
                          fetchNotificationLogs(ch, notifStatusFilter);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                          notifChannelFilter === ch
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        {ch}
                      </button>
                    ))}

                    <span className="font-bold text-slate-500 ml-3 mr-1">Status:</span>
                    {["ALL", "SENT", "FAILED", "PENDING"].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setNotifStatusFilter(st);
                          fetchNotificationLogs(notifChannelFilter, st);
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                          notifStatusFilter === st
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Showing {notificationLogs.length} events
                  </span>
                </div>

                {/* Logs Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                  {notificationLogs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 space-y-2">
                      <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                      <p className="text-sm font-semibold">No notification logs match your filters.</p>
                      <p className="text-xs text-slate-500">Notifications are logged upon booking, cancellation, rescheduling, reminder triggers, or payment.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Event &amp; Recipient</th>
                            <th className="px-4 py-3">Channel &amp; Provider</th>
                            <th className="px-4 py-3">Delivery Status</th>
                            <th className="px-4 py-3">Reference / Message ID</th>
                            <th className="px-4 py-3">Timestamp</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {notificationLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {log.eventType.replace(/_/g, " ")}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                  {log.recipient}
                                </div>
                                {log.appointmentId && (
                                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                    Apt: {log.appointmentId}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-1.5">
                                  {log.channel === "EMAIL" ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                      <Mail className="w-3 h-3" /> EMAIL
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      <MessageSquare className="w-3 h-3" /> SMS
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                                    {log.provider}
                                  </span>
                                </div>
                                {log.subject && (
                                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 max-w-xs truncate">
                                    {log.subject}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                    log.status === "SENT"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                      : log.status === "FAILED"
                                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-400 border border-rose-300 dark:border-rose-800"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                  }`}>
                                    {log.status}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    Try {log.attempts}/{log.maxAttempts}
                                  </span>
                                </div>
                                {log.errorMessage && (
                                  <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1 max-w-xs truncate" title={log.errorMessage}>
                                    {log.errorMessage}
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                {log.providerMessageId ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{log.providerMessageId}</span>
                                ) : (
                                  <span className="text-slate-400">{log.idempotencyKey}</span>
                                )}
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                                <div>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                <div className="text-[10px] text-slate-400">{new Date(log.createdAt).toLocaleDateString()}</div>
                              </td>

                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                {log.status === "FAILED" ? (
                                  <button
                                    onClick={() => handleRetryNotification(log.id)}
                                    disabled={retryingLogId === log.id || log.attempts >= log.maxAttempts}
                                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ml-auto"
                                  >
                                    <RotateCcw className={`w-3.5 h-3.5 ${retryingLogId === log.id ? "animate-spin" : ""}`} />
                                    <span>{retryingLogId === log.id ? "Retrying..." : "Retry"}</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center justify-end gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* MODAL 1: ONBOARD NEW DOCTOR */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 rounded-xl">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Onboard Doctor Specialist</h3>
                  <p className="text-[11px] text-slate-500">Configure medical credentials, cabin, and fee schedule</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddDoctorModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDoctor} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Doctor Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Arthur Pendelton, MD"
                  value={newDoctor.name}
                  onChange={(e) => setNewDoctor({ ...newDoctor, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Specialization</label>
                  <select
                    value={newDoctor.specialization}
                    onChange={(e) => {
                      const spec = e.target.value;
                      const deptCodeMap: Record<string, string> = {
                        Cardiology: "CARD",
                        Dermatology: "DERM",
                        Pediatrics: "PEDI",
                        Orthopedics: "ORTH",
                        Neurology: "NEUR",
                      };
                      setNewDoctor({ 
                        ...newDoctor, 
                        specialization: spec,
                        departmentCode: deptCodeMap[spec] || "GENMED",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Neurology">Neurology</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Consultation Fee ($)</label>
                  <input
                    type="number"
                    required
                    min="20"
                    max="500"
                    value={newDoctor.consultationFee}
                    onChange={(e) => setNewDoctor({ ...newDoctor, consultationFee: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="50"
                    value={newDoctor.experienceYears}
                    onChange={(e) => setNewDoctor({ ...newDoctor, experienceYears: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Room / Cabin</label>
                  <input
                    type="text"
                    required
                    value={newDoctor.roomNumber}
                    onChange={(e) => setNewDoctor({ ...newDoctor, roomNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Education / Credentials</label>
                <input
                  type="text"
                  required
                  value={newDoctor.education}
                  onChange={(e) => setNewDoctor({ ...newDoctor, education: e.target.value })}
                  placeholder="e.g. MD - Harvard Medical School"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDoctor}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  {submittingDoctor && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Specialist</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ITEMIZE INVOICE & RECEIPT MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Hospital Clinical Invoice Slip
                </h3>
              </div>
              <button 
                onClick={() => setViewInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Receipt Body */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-3 text-xs font-mono">
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

              {/* Items List */}
              <div className="space-y-1.5 py-1">
                {viewInvoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>{item.description} (x{item.quantity})</span>
                    <span className="font-bold">${item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>${viewInvoice.subtotal.toFixed(2)}</span>
                </div>
                {viewInvoice.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-${viewInvoice.discount.toFixed(2)}</span>
                  </div>
                )}
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
                Payment Status: <span className="font-bold text-emerald-600 uppercase">{viewInvoice.status}</span>
                {viewInvoice.paymentMethod && ` (${viewInvoice.paymentMethod})`}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Slip</span>
              </button>

              {viewInvoice.status === "PENDING" && (
                <button
                  type="button"
                  onClick={() => handleUpdateInvoiceStatus(viewInvoice.id, "PAID", "Cash")}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  Confirm Cash Payment
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: DOCTOR LEAVE & SESSION CANCELLATION BROADCAST */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 rounded-xl">
                  <CalendarX className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Doctor Leave &amp; Session Broadcast
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cancels scheduled consultations and dispatches emergency email &amp; SMS alerts to affected patients
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowLeaveModal(false);
                  setLeaveSuccessMsg(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {leaveSuccessMsg ? (
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">{leaveSuccessMsg}</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Notification delivery logs updated. Patients can now reschedule or request automated refunds.
                </p>
              </div>
            ) : (
              <form onSubmit={handleBroadcastDoctorLeave} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Doctor Specialist</label>
                  <select
                    required
                    value={leaveDoctorId}
                    onChange={(e) => setLeaveDoctorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  >
                    <option value="">-- Choose Specialist --</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.specialization}) - {d.hospital}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Leave Date (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Leave Reason / Notice Message</label>
                  <textarea
                    rows={3}
                    required
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="e.g. Unforeseen emergency medical leave or hospital theater duties"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="font-bold block mb-0.5">Automated Multi-Channel Broadcast:</span>
                  All active patients booked with this doctor on the selected date will be cancelled and sent an immediate SMS and Email notification with reschedule options.
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowLeaveModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingLeave || !leaveDoctorId || !leaveDate}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    {submittingLeave ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Broadcasting Alerts...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Confirm &amp; Broadcast</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

