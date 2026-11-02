import fs from 'fs';
import path from 'path';
import { 
  Doctor, 
  Appointment, 
  DoctorAvailability, 
  TimeSlot, 
  AppointmentStatus, 
  Prescription, 
  DoctorReview,
  BillingInvoice,
  InvoiceItem,
  InvoiceStatus,
  Department,
  AuditLog,
  PatientProfile,
  HospitalKPIs,
  SOAPEncounter,
  PaymentRecord,
  SlotHold,
  AppointmentReminder,
  NotificationItem,
  NotificationLog,
  PatientNotificationPreferences,
  PaymentProvider,
  PaymentStatus,
  RefundStatus
} from './types';
import { 
  INITIAL_DOCTORS, 
  INITIAL_APPOINTMENTS, 
  INITIAL_AVAILABILITIES,
  INITIAL_DEPARTMENTS,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
  INITIAL_PATIENT_PROFILES,
  INITIAL_PAYMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REMINDERS
} from './mockData';
import { getPaymentGateway } from './payments/gateway';
import { NotificationService } from './notifications/service';
import { getEmailProvider } from './notifications/providers/email';
import { getSmsProvider } from './notifications/providers/sms';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  doctors: Doctor[];
  appointments: Appointment[];
  availabilities: DoctorAvailability[];
  departments: Department[];
  invoices: BillingInvoice[];
  auditLogs: AuditLog[];
  patientProfiles: PatientProfile[];
  payments: PaymentRecord[];
  slotHolds: SlotHold[];
  processedWebhooks: string[];
  reminders: AppointmentReminder[];
  notifications: NotificationItem[];
  notificationLogs: NotificationLog[];
  patientPreferences: Record<string, PatientNotificationPreferences>;
}

// In-memory fallback / cache
let cachedDb: DatabaseSchema | null = null;

function loadDatabase(): DatabaseSchema {
  if (cachedDb) return cachedDb;

  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      cachedDb = {
        doctors: parsed.doctors || [...INITIAL_DOCTORS],
        appointments: parsed.appointments || [...INITIAL_APPOINTMENTS],
        availabilities: parsed.availabilities || [...INITIAL_AVAILABILITIES],
        departments: parsed.departments || [...INITIAL_DEPARTMENTS],
        invoices: parsed.invoices || [...INITIAL_INVOICES],
        auditLogs: parsed.auditLogs || [...INITIAL_AUDIT_LOGS],
        patientProfiles: parsed.patientProfiles || [...INITIAL_PATIENT_PROFILES],
        payments: parsed.payments || [...INITIAL_PAYMENTS],
        slotHolds: parsed.slotHolds || [],
        processedWebhooks: parsed.processedWebhooks || [],
        reminders: parsed.reminders || [...INITIAL_REMINDERS],
        notifications: parsed.notifications || [...INITIAL_NOTIFICATIONS],
        notificationLogs: parsed.notificationLogs || [],
        patientPreferences: parsed.patientPreferences || {},
      };
      return cachedDb!;
    }
  } catch (err) {
    console.warn('Error reading from disk database, using seed:', err);
  }

  // Seed default database
  cachedDb = {
    doctors: [...INITIAL_DOCTORS],
    appointments: [...INITIAL_APPOINTMENTS],
    availabilities: [...INITIAL_AVAILABILITIES],
    departments: [...INITIAL_DEPARTMENTS],
    invoices: [...INITIAL_INVOICES],
    auditLogs: [...INITIAL_AUDIT_LOGS],
    patientProfiles: [...INITIAL_PATIENT_PROFILES],
    payments: [...INITIAL_PAYMENTS],
    slotHolds: [],
    processedWebhooks: [],
    reminders: [...INITIAL_REMINDERS],
    notifications: [...INITIAL_NOTIFICATIONS],
    notificationLogs: [],
    patientPreferences: {},
  };

  saveDatabase(cachedDb);
  return cachedDb;
}

function saveDatabase(db: DatabaseSchema) {
  cachedDb = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not persist to file system (e.g. read-only serverless environment):', err);
  }
}

function normalizeDoctor(d: Doctor): Doctor {
  return {
    ...d,
    specialty: d.specialty || d.specialization,
    fee: d.fee !== undefined ? d.fee : d.consultationFee,
    experience: d.experience || `${d.experienceYears} years`,
    bio: d.bio || d.about,
    reviewCount: d.reviewCount !== undefined ? d.reviewCount : d.reviewsCount,
    reviews: d.reviews || [],
    languages: d.languages || ['English'],
    acceptedInsurance: d.acceptedInsurance || ['Aetna', 'BlueCross BlueShield', 'Cigna', 'Medicare'],
    nextAvailableSlot: d.nextAvailableSlot || 'Today, 10:30 AM',
  };
}

import { calculateEndTime, formatConsultationWindow } from './timeUtils';
export { calculateEndTime, formatConsultationWindow };

function normalizeAppointment(a: Appointment): Appointment {
  const startTime = a.startTime || a.time || a.timeSlot || '10:00 AM';
  const duration = a.durationMinutes || 30;
  const endTime = a.endTime || calculateEndTime(startTime, duration);
  return {
    ...a,
    tokenNumber: a.tokenNumber || 1,
    time: a.time || startTime,
    timeSlot: a.timeSlot || a.time || startTime,
    startTime,
    endTime,
    durationMinutes: duration,
  };
}

// --- DOCTORS ---
export function getDoctors(search?: string, specialty?: string): Doctor[] {
  const db = loadDatabase();
  let list = db.doctors;

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.specialization.toLowerCase().includes(q) ||
      (d.specialty && d.specialty.toLowerCase().includes(q)) ||
      d.hospital.toLowerCase().includes(q) ||
      (d.about && d.about.toLowerCase().includes(q)) ||
      (d.education && d.education.toLowerCase().includes(q)) ||
      (d.conditions && d.conditions.some(c => c.toLowerCase().includes(q)))
    );
  }

  if (specialty && specialty !== 'All' && specialty !== 'ALL') {
    list = list.filter(d => 
      d.specialization.toLowerCase() === specialty.toLowerCase() ||
      (d.specialty && d.specialty.toLowerCase() === specialty.toLowerCase())
    );
  }

  return list.map(normalizeDoctor);
}

export function getDoctorById(id: string): Doctor | undefined {
  const db = loadDatabase();
  const found = db.doctors.find(d => d.id === id);
  return found ? normalizeDoctor(found) : undefined;
}

export function addDoctorReview(
  doctorId: string,
  review: { patientName?: string; rating: number; comment: string }
): { doctor: Doctor; review: DoctorReview } {
  const db = loadDatabase();
  const doctor = db.doctors.find(d => d.id === doctorId);
  if (!doctor) {
    throw new Error('Doctor not found');
  }

  const newReview: DoctorReview = {
    id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    doctorId,
    patientName: review.patientName?.trim() || 'Verified Patient',
    rating: Math.min(5, Math.max(1, review.rating)),
    comment: review.comment,
    date: new Date().toISOString().split('T')[0],
    verifiedVisit: true,
  };

  const currentReviews = doctor.reviews || [];
  currentReviews.unshift(newReview);
  doctor.reviews = currentReviews;

  // Recalculate average rating & reviewsCount
  const totalRating = currentReviews.reduce((acc, r) => acc + r.rating, 0);
  doctor.reviewsCount = currentReviews.length;
  doctor.reviewCount = currentReviews.length;
  doctor.rating = Math.round((totalRating / currentReviews.length) * 10) / 10;

  saveDatabase(db);
  return { doctor: normalizeDoctor(doctor), review: newReview };
}

// --- APPOINTMENTS ---
export function getAppointments(filters?: { patientId?: string; doctorId?: string }): Appointment[] {
  const db = loadDatabase();
  let list = db.appointments;

  if (filters?.patientId) {
    list = list.filter(a => a.patientId === filters.patientId);
  }

  if (filters?.doctorId) {
    list = list.filter(a => a.doctorId === filters.doctorId);
  }

  // Sort descending by date and time
  return list
    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())
    .map(normalizeAppointment);
}

export function createAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'status'>): Appointment {
  const db = loadDatabase();

  const appointmentDate = data.date;
  const doctorAppointmentsOnDate = db.appointments.filter(
    a => a.doctorId === data.doctorId && a.date === appointmentDate && a.status !== 'CANCELLED'
  );
  const nextToken = (doctorAppointmentsOnDate.length || 0) + 1;

  const startTime = data.startTime || data.time || data.timeSlot || '10:00 AM';
  const duration = data.durationMinutes || 30;
  const endTime = data.endTime || calculateEndTime(startTime, duration);

  const newAppointment: Appointment = {
    ...data,
    tokenNumber: data.tokenNumber || nextToken,
    time: startTime,
    timeSlot: startTime,
    startTime,
    endTime,
    durationMinutes: duration,
    id: `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  db.appointments.unshift(newAppointment);
  saveDatabase(db);
  return normalizeAppointment(newAppointment);
}

export function updateAppointmentStatus(
  id: string, 
  status: AppointmentStatus, 
  cancellationReason?: string,
  prescription?: Prescription
): Appointment | null {
  const db = loadDatabase();
  const index = db.appointments.findIndex(a => a.id === id);

  if (index === -1) return null;

  db.appointments[index].status = status;
  if (cancellationReason) {
    db.appointments[index].cancellationReason = cancellationReason;
  }
  if (prescription) {
    db.appointments[index].prescription = prescription;
  }

  if (status === 'CANCELLED') {
    cancelAppointmentReminders(id);
  }

  saveDatabase(db);
  return normalizeAppointment(db.appointments[index]);
}

export function rescheduleAppointment(
  id: string,
  newDate: string,
  newTime: string,
  reason?: string
): Appointment | null {
  const db = loadDatabase();
  const index = db.appointments.findIndex(a => a.id === id);

  if (index === -1) return null;
  const current = db.appointments[index];

  if (current.status === 'COMPLETED' || current.status === 'CANCELLED') {
    throw new Error(`Cannot reschedule an appointment that is already ${current.status}`);
  }

  // Check if target slot is already occupied on target date
  const isConflict = db.appointments.some(
    a => a.id !== id &&
         a.doctorId === current.doctorId &&
         a.date === newDate &&
         (a.time === newTime || a.timeSlot === newTime) &&
         a.status !== 'CANCELLED'
  );

  if (isConflict) {
    throw new Error('The selected time slot is already reserved. Please choose another slot.');
  }

  // Calculate new token for new date
  const doctorDateAppts = db.appointments.filter(
    a => a.id !== id &&
         a.doctorId === current.doctorId &&
         a.date === newDate &&
         a.status !== 'CANCELLED'
  );
  const nextToken = doctorDateAppts.length + 1;

  db.appointments[index] = {
    ...current,
    previousDate: current.date,
    previousTime: current.time,
    date: newDate,
    time: newTime,
    timeSlot: newTime,
    startTime: newTime,
    endTime: calculateEndTime(newTime, current.durationMinutes || 30),
    tokenNumber: nextToken,
    rescheduledAt: new Date().toISOString(),
    symptoms: reason ? `${current.symptoms} (Rescheduled: ${reason})` : current.symptoms,
  };

  const updatedAppt = normalizeAppointment(db.appointments[index]);

  try {
    rescheduleAppointmentReminders(updatedAppt);
    NotificationService.notifyReschedule(updatedAppt, current.date, current.time, addNotification);
  } catch (err) {
    console.warn('Could not update reminders on reschedule:', err);
  }

  saveDatabase(db);
  return updatedAppt;
}

// --- DYNAMIC SLOTS GENERATOR ---
const DEFAULT_TIME_SLOTS = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
];

export function getAvailableSlots(doctorId: string, date: string): TimeSlot[] {
  const db = loadDatabase();

  // Check doctor blackout / leave dates
  const doctorAvail = db.availabilities.find(a => a.doctorId === doctorId);
  const isBlackedOut = doctorAvail?.blackoutDates?.includes(date);

  if (isBlackedOut) {
    return DEFAULT_TIME_SLOTS.map(time => ({
      time,
      startTime: time,
      endTime: calculateEndTime(time, 30),
      isAvailable: false,
      available: false,
      period: time.includes('AM') ? 'MORNING' : 'AFTERNOON',
    }));
  }

  // Clean up expired slot holds
  const now = Date.now();
  if (db.slotHolds && db.slotHolds.length > 0) {
    db.slotHolds = db.slotHolds.filter(h => h.expiresAt > now);
  }

  // Find existing bookings on this date for this doctor that are active
  const bookedTimes = new Set(
    db.appointments
      .filter(a => a.doctorId === doctorId && a.date === date && a.status !== 'CANCELLED')
      .map(a => a.time)
  );

  const heldTimes = new Set(
    (db.slotHolds || [])
      .filter(h => h.doctorId === doctorId && h.date === date && h.expiresAt > now)
      .map(h => h.time)
  );

  return DEFAULT_TIME_SLOTS.map(time => {
    const isFree = !bookedTimes.has(time) && !heldTimes.has(time);
    return {
      time,
      startTime: time,
      endTime: calculateEndTime(time, 30),
      isAvailable: isFree,
      available: isFree,
      period: time.includes('AM') ? 'MORNING' : 'AFTERNOON',
    };
  });
}

// --- AVAILABILITY RULES ---
export function getDoctorAvailability(doctorId: string): DoctorAvailability[] {
  const db = loadDatabase();
  return db.availabilities.filter(av => av.doctorId === doctorId);
}

export function updateDoctorAvailability(doctorId: string, updated: DoctorAvailability[]): DoctorAvailability[] {
  const db = loadDatabase();
  db.availabilities = db.availabilities.filter(av => av.doctorId !== doctorId).concat(updated);
  saveDatabase(db);
  return getDoctorAvailability(doctorId);
}

// --- CREATE DOCTOR ---
export function createDoctor(doctorData: Omit<Doctor, 'id' | 'rating' | 'reviewsCount' | 'reviews'>): Doctor {
  const db = loadDatabase();

  // Deduplicate: If doctor with same name already exists, update record rather than appending duplicate
  const existingIdx = db.doctors.findIndex(d => d.name.toLowerCase() === doctorData.name.toLowerCase());
  if (existingIdx !== -1) {
    db.doctors[existingIdx] = {
      ...db.doctors[existingIdx],
      ...doctorData,
    };
    saveDatabase(db);
    return normalizeDoctor(db.doctors[existingIdx]);
  }

  const newDoctor: Doctor = {
    ...doctorData,
    id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    rating: 5.0,
    reviewsCount: 0,
    reviewCount: 0,
    reviews: [],
  };

  db.doctors.push(newDoctor);

  // Setup default availability for the new doctor
  const defaultAvailabilities: DoctorAvailability[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day, idx) => ({
    id: `av_${newDoctor.id}_${idx + 1}`,
    doctorId: newDoctor.id,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '17:00',
    slotDurationMinutes: 30,
    maxCapacity: 1,
    isActive: true,
  }));
  db.availabilities.push(...defaultAvailabilities);

  // Add audit log
  addAuditLog({
    action: 'DOCTOR_ONBOARDED',
    actor: { id: 'user_admin_1', name: 'Sarah Jenkins', role: 'ADMIN' },
    resource: `Doctor ${newDoctor.name} (${newDoctor.specialization})`,
    details: `New specialist added with fee $${newDoctor.consultationFee}. Hospital: ${newDoctor.hospital}.`,
    severity: 'INFO',
  });

  saveDatabase(db);
  return normalizeDoctor(newDoctor);
}

// --- DEPARTMENTS ---
export function getDepartments(): Department[] {
  const db = loadDatabase();
  return db.departments || [];
}

// --- BILLING & INVOICES ---
export function getInvoices(filters?: { patientId?: string; status?: string }): BillingInvoice[] {
  const db = loadDatabase();
  let list = db.invoices || [];

  if (filters?.patientId) {
    list = list.filter(inv => inv.patientId === filters.patientId);
  }

  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter(inv => inv.status.toUpperCase() === filters.status?.toUpperCase());
  }

  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getInvoiceById(id: string): BillingInvoice | undefined {
  const db = loadDatabase();
  return (db.invoices || []).find(inv => inv.id === id || inv.invoiceNumber === id);
}

export function createInvoice(data: Omit<BillingInvoice, 'id' | 'createdAt' | 'invoiceNumber'>): BillingInvoice {
  const db = loadDatabase();
  const count = (db.invoices?.length || 0) + 1;
  const newInvoice: BillingInvoice = {
    ...data,
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    invoiceNumber: `INV-2026-${1000 + count}`,
    createdAt: new Date().toISOString(),
  };

  db.invoices = db.invoices || [];
  db.invoices.unshift(newInvoice);

  addAuditLog({
    action: 'INVOICE_GENERATED',
    actor: { id: 'system', name: 'Billing Engine', role: 'ADMIN' },
    resource: `Invoice ${newInvoice.invoiceNumber}`,
    details: `Generated for ${newInvoice.patientName} (${newInvoice.patientMRN}) - Total $${newInvoice.total}.`,
    severity: 'INFO',
  });

  saveDatabase(db);
  return newInvoice;
}

export function updateInvoiceStatus(id: string, status: InvoiceStatus, paymentMethod?: string): BillingInvoice | null {
  const db = loadDatabase();
  const invoice = (db.invoices || []).find(inv => inv.id === id || inv.invoiceNumber === id);

  if (!invoice) return null;

  invoice.status = status;
  if (paymentMethod) invoice.paymentMethod = paymentMethod as any;
  if (status === 'PAID') {
    invoice.paidAt = new Date().toISOString();
  }

  addAuditLog({
    action: status === 'PAID' ? 'INVOICE_SETTLED' : 'INVOICE_STATUS_UPDATED',
    actor: { id: 'user_admin_1', name: 'Sarah Jenkins', role: 'ADMIN' },
    resource: `Invoice ${invoice.invoiceNumber}`,
    details: `Status set to ${status}${paymentMethod ? ` via ${paymentMethod}` : ''}.`,
    severity: 'INFO',
  });

  saveDatabase(db);
  return invoice;
}

// --- AUDIT LOGS ---
export function getAuditLogs(limit: number = 50): AuditLog[] {
  const db = loadDatabase();
  const logs = db.auditLogs || [];
  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): AuditLog {
  const db = loadDatabase();
  const newLog: AuditLog = {
    ...entry,
    id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  db.auditLogs = db.auditLogs || [];
  db.auditLogs.unshift(newLog);

  // Keep max 500 audit logs to prevent runaway file size
  if (db.auditLogs.length > 500) {
    db.auditLogs = db.auditLogs.slice(0, 500);
  }

  saveDatabase(db);
  return newLog;
}

// --- PATIENT PROFILES ---
export function getPatientProfile(patientId: string): PatientProfile | undefined {
  const db = loadDatabase();
  return (db.patientProfiles || []).find(p => p.id === patientId);
}

// --- HOSPITAL KPIS (EXECUTIVE OVERVIEW) ---
export function getHospitalKPIs(): HospitalKPIs {
  const db = loadDatabase();
  const doctors = db.doctors || [];
  const appointments = db.appointments || [];
  const invoices = db.invoices || [];

  const todayStr = new Date().toISOString().split('T')[0];
  const activeAppointmentsToday = appointments.filter(
    a => a.date === todayStr && a.status !== 'CANCELLED'
  ).length;

  const completedVisits = appointments.filter(a => a.status === 'COMPLETED');

  const totalRevenue = invoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + inv.total, 0);

  const pendingInvoicesCount = invoices.filter(inv => inv.status === 'PENDING').length;

  // Mocked realistic hospital metrics
  const uniquePatients = new Set(appointments.map(a => a.patientId)).size;

  return {
    totalDoctors: doctors.length,
    activeAppointmentsToday,
    totalPatients: Math.max(uniquePatients, db.patientProfiles?.length || 1),
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    pendingInvoicesCount,
    occupancyRate: 84, // 84% OPD capacity utilization
    averageConsultationTimeMinutes: 18,
    completedVisitsCount: completedVisits.length,
  };
}

// --- SOAP CLINICAL ENCOUNTER ---
export function recordSOAPEncounter(
  appointmentId: string, 
  data: {
    vitals?: any;
    diagnosis: string;
    medicines: any[];
    advice?: string;
    followUpDate?: string;
    labOrders?: string[];
    doctorNotes?: string;
    chiefComplaint?: string;
  }
): { appointment: Appointment; invoice?: BillingInvoice } {
  const db = loadDatabase();
  const apptIndex = db.appointments.findIndex(a => a.id === appointmentId);
  if (apptIndex === -1) {
    throw new Error('Appointment not found');
  }

  const appt = db.appointments[apptIndex];

  // Build prescription
  const prescription: Prescription = {
    diagnosis: data.diagnosis,
    medicines: data.medicines || [],
    advice: data.advice,
    followUpDate: data.followUpDate,
    prescribedAt: new Date().toISOString(),
    doctorNotes: data.doctorNotes,
    vitals: data.vitals,
    labOrders: data.labOrders,
  };

  // Build SOAP encounter object
  const encounter: SOAPEncounter = {
    id: `enc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    appointmentId,
    patientId: appt.patientId,
    doctorId: appt.doctorId,
    doctorName: appt.doctorName,
    date: appt.date,
    subjective: {
      chiefComplaint: data.chiefComplaint || appt.symptoms,
      historyOfPresentIllness: appt.symptoms,
    },
    objective: {
      vitals: data.vitals,
    },
    assessment: {
      diagnosis: data.diagnosis,
      clinicalNotes: data.doctorNotes,
    },
    plan: {
      prescription: data.medicines,
      labOrders: data.labOrders,
      lifestyleAdvice: data.advice,
      followUpDate: data.followUpDate,
    },
    createdAt: new Date().toISOString(),
  };

  appt.status = 'COMPLETED';
  appt.prescription = prescription;
  appt.encounter = encounter;

  // Auto-generate invoice if not already generated
  let invoice = db.invoices.find(inv => inv.appointmentId === appointmentId);
  if (!invoice) {
    const consultationFee = appt.fee || 75;
    const labFee = (data.labOrders?.length || 0) * 35;
    const items: InvoiceItem[] = [
      {
        id: `item_${Date.now()}_1`,
        description: `Consultation - ${appt.doctorSpecialty} (${appt.doctorName})`,
        category: 'CONSULTATION',
        quantity: 1,
        unitPrice: consultationFee,
        total: consultationFee,
      },
    ];

    if (labFee > 0) {
      items.push({
        id: `item_${Date.now()}_2`,
        description: `Ordered Diagnostic Labs (${data.labOrders?.join(', ')})`,
        category: 'LAB_TEST',
        quantity: data.labOrders?.length || 1,
        unitPrice: 35,
        total: labFee,
      });
    }

    const subtotal = consultationFee + labFee;
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + tax;

    const patientProfile = db.patientProfiles?.find(p => p.id === appt.patientId);

    invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: `INV-2026-${1000 + (db.invoices.length + 1)}`,
      appointmentId,
      patientId: appt.patientId,
      patientName: appt.patientName,
      patientMRN: patientProfile?.mrn || 'MRN-2026-0941',
      doctorId: appt.doctorId,
      doctorName: appt.doctorName,
      date: appt.date,
      items,
      subtotal,
      discount: 0,
      tax,
      total,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    db.invoices.unshift(invoice);
  }

  // Audit event
  addAuditLog({
    action: 'CLINICAL_ENCOUNTER_COMPLETED',
    actor: { id: appt.doctorId, name: appt.doctorName, role: 'DOCTOR' },
    resource: `Appointment ${appointmentId} (${appt.patientName})`,
    details: `SOAP Encounter signed off. Diagnosis: ${data.diagnosis}. ${data.medicines.length} medications prescribed.`,
    severity: 'INFO',
  });

  saveDatabase(db);
  return { appointment: normalizeAppointment(appt), invoice };
}

// ============================================================================
// --- DAY 4: PAYMENTS, SLOT LOCKING, REFUNDS, NOTIFICATIONS & REMINDERS ---
// ============================================================================

/**
 * Clean up expired slot holds
 */
function cleanExpiredSlotHolds(db: DatabaseSchema) {
  const now = Date.now();
  if (db.slotHolds && db.slotHolds.length > 0) {
    db.slotHolds = db.slotHolds.filter(h => h.expiresAt > now);
  }
}

/**
 * Creates a temporary slot hold (default 10 minutes TTL)
 */
export function createSlotHold(
  doctorId: string,
  date: string,
  time: string,
  appointmentId: string,
  ttlSeconds: number = 600
): { success: boolean; expiresAt: number; error?: string } {
  const db = loadDatabase();
  cleanExpiredSlotHolds(db);

  const slotKey = `${doctorId}_${date}_${time}`;
  const now = Date.now();

  // 1. Check if slot is already booked and active
  const isBooked = db.appointments.some(
    a => a.doctorId === doctorId &&
         a.date === date &&
         (a.time === time || a.timeSlot === time) &&
         a.status !== 'CANCELLED' &&
         a.id !== appointmentId
  );
  if (isBooked) {
    return { success: false, expiresAt: 0, error: 'This time slot is already booked.' };
  }

  // 2. Check if another patient is currently holding this slot
  const existingHold = (db.slotHolds || []).find(
    h => h.slotKey === slotKey && h.appointmentId !== appointmentId && h.expiresAt > now
  );
  if (existingHold) {
    const remainingSecs = Math.max(1, Math.round((existingHold.expiresAt - now) / 1000));
    return {
      success: false,
      expiresAt: existingHold.expiresAt,
      error: `This time slot is temporarily reserved by another patient. Try again in ${remainingSecs} seconds.`,
    };
  }

  // 3. Create or refresh hold
  const expiresAt = now + ttlSeconds * 1000;
  if (!db.slotHolds) db.slotHolds = [];
  
  // Remove any previous hold for this appointment
  db.slotHolds = db.slotHolds.filter(h => h.appointmentId !== appointmentId);
  db.slotHolds.push({
    slotKey,
    doctorId,
    date,
    time,
    appointmentId,
    expiresAt,
  });

  saveDatabase(db);
  return { success: true, expiresAt };
}

/**
 * Releases a slot hold manually or on abandonment
 */
export function releaseSlotHold(doctorId: string, date: string, time: string, appointmentId?: string): void {
  const db = loadDatabase();
  const slotKey = `${doctorId}_${date}_${time}`;
  if (!db.slotHolds) return;

  db.slotHolds = db.slotHolds.filter(h => {
    if (appointmentId && h.appointmentId === appointmentId) return false;
    if (h.slotKey === slotKey) return false;
    return true;
  });

  saveDatabase(db);
}

/**
 * Checks if a slot is completely available (not booked and not held by another)
 */
export function isSlotAvailableForBooking(
  doctorId: string,
  date: string,
  time: string,
  excludeAppointmentId?: string
): { isAvailable: boolean; reason?: string } {
  const db = loadDatabase();
  cleanExpiredSlotHolds(db);
  const now = Date.now();

  const isBooked = db.appointments.some(
    a => a.doctorId === doctorId &&
         a.date === date &&
         (a.time === time || a.timeSlot === time) &&
         a.status !== 'CANCELLED' &&
         a.id !== excludeAppointmentId
  );
  if (isBooked) {
    return { isAvailable: false, reason: 'Slot is already booked.' };
  }

  const slotKey = `${doctorId}_${date}_${time}`;
  const isHeld = (db.slotHolds || []).some(
    h => h.slotKey === slotKey && h.appointmentId !== excludeAppointmentId && h.expiresAt > now
  );
  if (isHeld) {
    return { isAvailable: false, reason: 'Slot is currently reserved by another patient in checkout.' };
  }

  return { isAvailable: true };
}

/**
 * Creates an Online Consultation Payment Order securely on the backend
 * and locks the time slot with a 10-minute hold TTL.
 */
export async function createPaymentOrder(data: {
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  doctorId: string;
  date: string;
  time: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  symptoms?: string;
  provider?: PaymentProvider;
  currency?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  payment?: PaymentRecord;
  appointment?: Appointment;
  expiresAt?: number;
  error?: string;
}> {
  const db = loadDatabase();
  cleanExpiredSlotHolds(db);

  // 1. Fetch Doctor and verify fee
  const doctor = db.doctors.find(d => d.id === data.doctorId);
  if (!doctor) {
    return { success: false, error: 'Selected doctor not found' };
  }
  const fee = doctor.consultationFee || 75;
  const provider = data.provider || 'RAZORPAY';
  const currency = data.currency || (provider === 'RAZORPAY' ? 'INR' : 'USD');

  const appointmentId = `apt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const startTime = data.startTime || data.time;
  const duration = data.durationMinutes || 30;
  const endTime = data.endTime || calculateEndTime(startTime, duration);

  // 2. Hold slot with 10-minute TTL (prevents overbooking)
  const holdResult = createSlotHold(data.doctorId, data.date, startTime, appointmentId, 600);
  if (!holdResult.success) {
    return { success: false, error: holdResult.error };
  }

  // 3. Create Gateway Order
  const gateway = getPaymentGateway(provider);
  const order = await gateway.createOrder({
    amount: fee,
    currency,
    receipt: `rcpt_${appointmentId}`,
    notes: {
      doctorId: data.doctorId,
      doctorName: doctor.name,
      patientId: data.patientId,
      patientName: data.patientName,
      appointmentId,
    },
  });

  // 4. Create Pending Appointment
  const newAppointment: Appointment = {
    id: appointmentId,
    patientId: data.patientId,
    patientName: data.patientName,
    patientEmail: data.patientEmail,
    patientPhone: data.patientPhone || '+1 (555) 019-2834',
    doctorId: data.doctorId,
    doctorName: doctor.name,
    doctorSpecialty: doctor.specialization,
    doctorAvatar: doctor.avatar,
    date: data.date,
    time: startTime,
    timeSlot: startTime,
    startTime,
    endTime,
    durationMinutes: duration,
    fee,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    paymentProvider: provider,
    refundStatus: 'NONE',
    symptoms: data.symptoms || 'General OPD Consultation',
    createdAt: new Date().toISOString(),
  };

  // 5. Create Payment Record
  const newPayment: PaymentRecord = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    orderId: order.orderId,
    appointmentId,
    patientId: data.patientId,
    patientName: data.patientName,
    patientEmail: data.patientEmail,
    doctorId: data.doctorId,
    doctorName: doctor.name,
    amount: fee,
    currency,
    provider,
    status: 'PENDING',
    refundStatus: 'NONE',
    createdAt: new Date().toISOString(),
  };

  newAppointment.paymentId = newPayment.id;

  if (!db.payments) db.payments = [];
  db.payments.unshift(newPayment);
  db.appointments.unshift(newAppointment);

  addAuditLog({
    action: 'PAYMENT_ORDER_CREATED',
    actor: { id: data.patientId, name: data.patientName, role: 'PATIENT' },
    resource: `Order ${order.orderId} ($${fee} ${currency})`,
    details: `Payment order initialized for consultation with ${doctor.name} on ${data.date} at ${data.time}. Slot locked for 10 minutes.`,
    severity: 'INFO',
  });

  saveDatabase(db);

  return {
    success: true,
    orderId: order.orderId,
    payment: newPayment,
    appointment: normalizeAppointment(newAppointment),
    expiresAt: holdResult.expiresAt,
  };
}

/**
 * Server-side payment verification, appointment confirmation & receipt generation
 */
export async function verifyPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  provider?: PaymentProvider;
  paymentMethod?: string;
}): Promise<{
  success: boolean;
  payment?: PaymentRecord;
  appointment?: Appointment;
  invoice?: BillingInvoice;
  error?: string;
}> {
  const db = loadDatabase();
  const payment = (db.payments || []).find(p => p.orderId === params.orderId);

  if (!payment) {
    return { success: false, error: 'Payment order record not found.' };
  }

  // Idempotency: If already paid, return existing verified state
  if (payment.status === 'PAID') {
    const appt = db.appointments.find(a => a.id === payment.appointmentId);
    const inv = db.invoices.find(i => i.appointmentId === payment.appointmentId);
    return {
      success: true,
      payment,
      appointment: appt ? normalizeAppointment(appt) : undefined,
      invoice: inv,
    };
  }

  const provider = params.provider || payment.provider || 'RAZORPAY';
  const gateway = getPaymentGateway(provider);

  const isValid = gateway.verifySignature({
    orderId: params.orderId,
    paymentId: params.paymentId,
    signature: params.signature,
  });

  if (!isValid) {
    payment.status = 'FAILED';
    saveDatabase(db);
    return { success: false, error: 'Invalid payment signature or tamper detected.' };
  }

  // Signature verified!
  const now = new Date().toISOString();
  payment.status = 'PAID';
  payment.paidAt = now;
  payment.transactionReference = params.paymentId;
  payment.paymentMethod = params.paymentMethod || `${provider} Online Checkout`;

  // Update appointment status to CONFIRMED and assign token
  const apptIndex = db.appointments.findIndex(a => a.id === payment.appointmentId);
  let appointment: Appointment | undefined;

  if (apptIndex !== -1) {
    const existing = db.appointments[apptIndex];
    const doctorAppointmentsOnDate = db.appointments.filter(
      a => a.doctorId === existing.doctorId && a.date === existing.date && a.status !== 'CANCELLED' && a.id !== existing.id
    );
    const nextToken = (doctorAppointmentsOnDate.length || 0) + 1;

    db.appointments[apptIndex] = {
      ...existing,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      tokenNumber: existing.tokenNumber || nextToken,
    };
    appointment = normalizeAppointment(db.appointments[apptIndex]);

    // Release slot hold since the appointment is confirmed
    releaseSlotHold(existing.doctorId, existing.date, existing.time, existing.id);
  }

  // Auto-generate or mark Paid Billing Invoice
  let invoice = db.invoices.find(i => i.appointmentId === payment.appointmentId);
  if (!invoice && appointment) {
    const patientProfile = db.patientProfiles?.find(p => p.id === appointment?.patientId);
    invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber: `INV-2026-${1000 + (db.invoices.length + 1)}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientMRN: patientProfile?.mrn || 'MRN-2026-0941',
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName,
      date: appointment.date,
      items: [
        {
          id: `item_${Date.now()}`,
          description: `Consultation Visit - ${appointment.doctorSpecialty} (${appointment.doctorName})`,
          category: 'CONSULTATION',
          quantity: 1,
          unitPrice: payment.amount,
          total: payment.amount,
        },
      ],
      subtotal: payment.amount,
      discount: 0,
      tax: 0,
      total: payment.amount,
      status: 'PAID',
      paymentMethod: payment.paymentMethod as any,
      paidAt: now,
      createdAt: now,
    };
    db.invoices.unshift(invoice);
  } else if (invoice) {
    invoice.status = 'PAID';
    invoice.paidAt = now;
  }

  // Schedule automated appointment reminders (24h and 1h alerts)
  if (appointment) {
    scheduleAppointmentReminders(appointment);
    // Dispatch Notifications
    NotificationService.notifyBookingConfirmation(appointment, payment, addNotification);
    NotificationService.notifyPaymentReceipt(payment, invoice, addNotification);
  }

  addAuditLog({
    action: 'PAYMENT_VERIFIED_AND_CAPTURED',
    actor: { id: payment.patientId, name: payment.patientName, role: 'PATIENT' },
    resource: `Payment ${payment.id} (Txn: ${params.paymentId})`,
    details: `Online payment of $${payment.amount} verified successfully via ${provider}. Appointment confirmed with OPD Token #${appointment?.tokenNumber || 1}.`,
    severity: 'INFO',
  });

  saveDatabase(db);

  return {
    success: true,
    payment,
    appointment,
    invoice,
  };
}

/**
 * Calculates Refund amount according to Medrella Cancellation Policy:
 * - > 24 hours prior to appointment: 100% full refund
 * - <= 24 hours prior but in future: 50% partial refund
 * - Past appointment or completed: 0% refund
 */
export function calculateRefundPolicy(
  appointment: Appointment,
  amount: number
): {
  refundAmount: number;
  percentage: number;
  policyTier: 'FULL_REFUND_24H' | 'PARTIAL_REFUND_50' | 'NO_REFUND_PAST';
  reason: string;
} {
  try {
    const apptDateTime = new Date(`${appointment.date}T${convertTo24Hour(appointment.time)}`);
    const now = new Date();
    const diffHours = (apptDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours >= 24) {
      return {
        refundAmount: amount,
        percentage: 100,
        policyTier: 'FULL_REFUND_24H',
        reason: 'Full 100% refund applied (Cancelled more than 24 hours prior to scheduled visit).',
      };
    } else if (diffHours > 0) {
      const partial = Math.round(amount * 0.5 * 100) / 100;
      return {
        refundAmount: partial,
        percentage: 50,
        policyTier: 'PARTIAL_REFUND_50',
        reason: '50% partial refund applied (Cancelled within 24 hours of scheduled consultation).',
      };
    } else {
      return {
        refundAmount: 0,
        percentage: 0,
        policyTier: 'NO_REFUND_PAST',
        reason: 'No refund applicable (Scheduled consultation time has passed or visit completed).',
      };
    }
  } catch {
    return {
      refundAmount: amount,
      percentage: 100,
      policyTier: 'FULL_REFUND_24H',
      reason: 'Standard 100% full refund applied.',
    };
  }
}

function convertTo24Hour(timeStr: string): string {
  try {
    const [time, modifier] = timeStr.trim().split(' ');
    let [hours, minutes] = time.split(':');
    if (modifier === 'PM' && hours !== '12') hours = String(parseInt(hours, 10) + 12);
    if (modifier === 'AM' && hours === '12') hours = '00';
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
  } catch {
    return '10:00:00';
  }
}

/**
 * Executes refund processing according to hospital policy or admin override
 */
export async function processRefund(
  appointmentId: string,
  reason: string,
  overrideAmount?: number
): Promise<{
  success: boolean;
  payment?: PaymentRecord;
  appointment?: Appointment;
  refundAmount?: number;
  error?: string;
}> {
  const db = loadDatabase();
  const appointment = db.appointments.find(a => a.id === appointmentId);

  if (!appointment) {
    return { success: false, error: 'Appointment not found.' };
  }

  const payment = (db.payments || []).find(
    p => p.appointmentId === appointmentId && (p.status === 'PAID' || p.status === 'PARTIALLY_REFUNDED')
  );

  if (!payment) {
    // If appointment has no online payment record, still cancel appointment cleanly
    appointment.status = 'CANCELLED';
    appointment.cancellationReason = reason;
    appointment.refundStatus = 'NONE';
    cancelAppointmentReminders(appointmentId);
    NotificationService.notifyCancellation(appointment, 0, addNotification);
    saveDatabase(db);
    return {
      success: true,
      appointment: normalizeAppointment(appointment),
      refundAmount: 0,
    };
  }

  if (payment.refundStatus === 'SUCCEEDED' && payment.status === 'REFUNDED') {
    return { success: false, error: 'This payment has already been completely refunded.' };
  }

  // Calculate refund amount
  const policy = calculateRefundPolicy(appointment, payment.amount);
  const refundAmount = overrideAmount !== undefined ? overrideAmount : policy.refundAmount;

  // Process with payment gateway
  const gateway = getPaymentGateway(payment.provider);
  const refundResult = await gateway.processRefund({
    paymentId: payment.transactionReference || payment.id,
    amount: refundAmount,
    reason: reason || policy.reason,
  });

  const now = new Date().toISOString();
  payment.refundStatus = refundResult.status;
  payment.refundAmount = refundAmount;
  payment.refundReason = reason || policy.reason;
  payment.providerRefundId = refundResult.refundId;
  payment.refundedAt = now;
  payment.status = refundAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

  // Mark appointment cancelled
  appointment.status = 'CANCELLED';
  appointment.cancellationReason = reason;
  appointment.refundStatus = refundResult.status;
  appointment.refundAmount = refundAmount;
  appointment.refundReason = reason || policy.reason;

  // Update invoice if exists
  const invoice = db.invoices.find(i => i.appointmentId === appointmentId);
  if (invoice) {
    invoice.status = 'CANCELLED';
  }

  // Immediately cancel all scheduled automated reminders
  cancelAppointmentReminders(appointmentId);

  // Dispatch notifications
  NotificationService.notifyCancellation(appointment, refundAmount, addNotification);
  if (refundAmount > 0) {
    NotificationService.notifyRefund(payment, refundAmount, policy.reason, addNotification);
  }

  addAuditLog({
    action: 'PAYMENT_REFUND_PROCESSED',
    actor: { id: appointment.patientId, name: appointment.patientName, role: 'PATIENT' },
    resource: `Refund ${refundResult.refundId} ($${refundAmount})`,
    details: `Refund of $${refundAmount} processed via ${payment.provider} for Appointment ${appointmentId}. Reason: ${reason || policy.reason}.`,
    severity: 'INFO',
  });

  saveDatabase(db);

  return {
    success: true,
    payment,
    appointment: normalizeAppointment(appointment),
    refundAmount,
  };
}

export function getPaymentByOrderId(orderId: string): PaymentRecord | null {
  const db = loadDatabase();
  return (db.payments || []).find(p => p.orderId === orderId) || null;
}

export function getPaymentByAppointmentId(appointmentId: string): PaymentRecord | null {
  const db = loadDatabase();
  return (db.payments || []).find(p => p.appointmentId === appointmentId) || null;
}

export function getPayments(filters?: { patientId?: string; doctorId?: string; appointmentId?: string }): PaymentRecord[] {
  const db = loadDatabase();
  let list = db.payments || [];

  if (filters?.patientId) {
    list = list.filter(p => p.patientId === filters.patientId);
  }
  if (filters?.doctorId) {
    list = list.filter(p => p.doctorId === filters.doctorId);
  }
  if (filters?.appointmentId) {
    list = list.filter(p => p.appointmentId === filters.appointmentId);
  }

  return list;
}

// ============================================================================
// --- AUTOMATED APPOINTMENT REMINDERS ENGINE ---
// ============================================================================

export function scheduleAppointmentReminders(appointment: Appointment): AppointmentReminder[] {
  const db = loadDatabase();
  if (!db.reminders) db.reminders = [];

  try {
    const apptDateTime = new Date(`${appointment.date}T${convertTo24Hour(appointment.time)}`);
    const now = Date.now();

    const rem24hTime = new Date(apptDateTime.getTime() - 24 * 60 * 60 * 1000);
    const rem1hTime = new Date(apptDateTime.getTime() - 60 * 60 * 1000);

    const createdReminders: AppointmentReminder[] = [];

    // Schedule 24H reminder
    if (rem24hTime.getTime() > now) {
      const r24: AppointmentReminder = {
        id: `rem_${Date.now()}_24h`,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientEmail: appointment.patientEmail,
        patientPhone: appointment.patientPhone,
        doctorName: appointment.doctorName,
        date: appointment.date,
        time: appointment.time,
        scheduledFor: rem24hTime.toISOString(),
        type: 'REMINDER_24H',
        status: 'SCHEDULED',
      };
      db.reminders.push(r24);
      createdReminders.push(r24);
    }

    // Schedule 1H reminder
    if (rem1hTime.getTime() > now) {
      const r1: AppointmentReminder = {
        id: `rem_${Date.now()}_1h`,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        patientEmail: appointment.patientEmail,
        patientPhone: appointment.patientPhone,
        doctorName: appointment.doctorName,
        date: appointment.date,
        time: appointment.time,
        scheduledFor: rem1hTime.toISOString(),
        type: 'REMINDER_1H',
        status: 'SCHEDULED',
      };
      db.reminders.push(r1);
      createdReminders.push(r1);
    }

    saveDatabase(db);
    return createdReminders;
  } catch (err) {
    console.warn('Failed to calculate reminder timestamps:', err);
    return [];
  }
}

export function cancelAppointmentReminders(appointmentId: string): void {
  const db = loadDatabase();
  if (!db.reminders) return;

  db.reminders = db.reminders.map(r => {
    if (r.appointmentId === appointmentId && r.status === 'SCHEDULED') {
      return { ...r, status: 'CANCELLED' };
    }
    return r;
  });

  saveDatabase(db);
}

export function rescheduleAppointmentReminders(appointment: Appointment): AppointmentReminder[] {
  cancelAppointmentReminders(appointment.id);
  return scheduleAppointmentReminders(appointment);
}

/**
 * Cron / automated processor for pending reminders
 */
export function processDueReminders(): {
  processedCount: number;
  sentCount: number;
  cancelledCount: number;
} {
  const db = loadDatabase();
  if (!db.reminders) return { processedCount: 0, sentCount: 0, cancelledCount: 0 };

  const now = new Date().toISOString();
  let sentCount = 0;
  let cancelledCount = 0;

  for (let i = 0; i < db.reminders.length; i++) {
    const reminder = db.reminders[i];
    if (reminder.status === 'SCHEDULED' && reminder.scheduledFor <= now) {
      // Check parent appointment status
      const appt = db.appointments.find(a => a.id === reminder.appointmentId);
      if (!appt || appt.status === 'CANCELLED' || appt.status === 'COMPLETED') {
        // Inappropriate reminder prevented!
        reminder.status = 'CANCELLED';
        cancelledCount++;
      } else {
        reminder.status = 'SENT';
        reminder.sentAt = now;
        sentCount++;
        NotificationService.notifyReminder(reminder, addNotification);
      }
    }
  }

  saveDatabase(db);
  return { processedCount: sentCount + cancelledCount, sentCount, cancelledCount };
}

export function getReminders(patientId?: string): AppointmentReminder[] {
  const db = loadDatabase();
  let list = db.reminders || [];
  if (patientId) {
    list = list.filter(r => r.patientId === patientId);
  }
  return list;
}

// ============================================================================
// --- NOTIFICATIONS & IN-APP ALERTS ---
// ============================================================================

export function getNotifications(userId?: string): NotificationItem[] {
  const db = loadDatabase();
  let list = db.notifications || [];
  if (userId) {
    list = list.filter(n => !n.userId || n.userId === userId);
  }
  return list;
}

export function markNotificationRead(id: string): boolean {
  const db = loadDatabase();
  const notif = (db.notifications || []).find(n => n.id === id);
  if (!notif) return false;
  notif.read = true;
  saveDatabase(db);
  return true;
}

export function markAllNotificationsRead(userId?: string): boolean {
  const db = loadDatabase();
  if (!db.notifications) return false;

  db.notifications = db.notifications.map(n => {
    if (!userId || !n.userId || n.userId === userId) {
      return { ...n, read: true };
    }
    return n;
  });

  saveDatabase(db);
  return true;
}

export function addNotification(
  item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>
): NotificationItem {
  const db = loadDatabase();
  if (!db.notifications) db.notifications = [];

  const newNotif: NotificationItem = {
    ...item,
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: 'Just now',
    read: false,
  };

  db.notifications.unshift(newNotif);
  saveDatabase(db);
  return newNotif;
}

// ============================================================================
// --- WEBHOOK IDEMPOTENCY ---
// ============================================================================

export function isWebhookProcessed(eventId: string): boolean {
  const db = loadDatabase();
  return Boolean(db.processedWebhooks && db.processedWebhooks.includes(eventId));
}

export function markWebhookProcessed(eventId: string): void {
  const db = loadDatabase();
  if (!db.processedWebhooks) db.processedWebhooks = [];
  if (!db.processedWebhooks.includes(eventId)) {
    db.processedWebhooks.push(eventId);
    saveDatabase(db);
  }
}

// ============================================================================
// --- NOTIFICATION DELIVERY LOGS & AUDIT ---
// ============================================================================

export function addNotificationLog(log: NotificationLog): NotificationLog {
  const db = loadDatabase();
  if (!db.notificationLogs) db.notificationLogs = [];
  db.notificationLogs.unshift(log);
  saveDatabase(db);
  return log;
}

export function updateNotificationLog(updatedLog: NotificationLog): void {
  const db = loadDatabase();
  if (!db.notificationLogs) return;
  const idx = db.notificationLogs.findIndex(l => l.id === updatedLog.id);
  if (idx !== -1) {
    db.notificationLogs[idx] = updatedLog;
    saveDatabase(db);
  }
}

export function getNotificationLogs(filter?: {
  channel?: string;
  status?: string;
  patientId?: string;
  appointmentId?: string;
}): NotificationLog[] {
  const db = loadDatabase();
  let list = db.notificationLogs || [];

  if (filter?.channel && filter.channel !== 'ALL') {
    list = list.filter(l => l.channel === filter.channel);
  }
  if (filter?.status && filter.status !== 'ALL') {
    list = list.filter(l => l.status === filter.status);
  }
  if (filter?.patientId) {
    list = list.filter(l => l.patientId === filter.patientId);
  }
  if (filter?.appointmentId) {
    list = list.filter(l => l.appointmentId === filter.appointmentId);
  }

  return list;
}

export function isNotificationDuplicate(idempotencyKey: string): boolean {
  if (!idempotencyKey) return false;
  const db = loadDatabase();
  return (db.notificationLogs || []).some(
    l => l.idempotencyKey === idempotencyKey && l.status === 'SENT'
  );
}

// ============================================================================
// --- PATIENT NOTIFICATION PREFERENCES ---
// ============================================================================

export function getPatientNotificationPreferences(patientId: string): PatientNotificationPreferences {
  const db = loadDatabase();
  const defaultPrefs: PatientNotificationPreferences = {
    emailEnabled: true,
    smsEnabled: true,
    remindersEnabled: true,
    marketingConsent: false,
  };

  if (!db.patientPreferences) db.patientPreferences = {};
  return db.patientPreferences[patientId] || defaultPrefs;
}

export function updatePatientNotificationPreferences(
  patientId: string,
  prefs: Partial<PatientNotificationPreferences>
): PatientNotificationPreferences {
  const db = loadDatabase();
  if (!db.patientPreferences) db.patientPreferences = {};

  const current = getPatientNotificationPreferences(patientId);
  const updated: PatientNotificationPreferences = {
    ...current,
    ...prefs,
  };

  db.patientPreferences[patientId] = updated;
  saveDatabase(db);
  return updated;
}

// ============================================================================
// --- NOTIFICATION RETRY HANDLER ---
// ============================================================================

export async function retryNotificationDelivery(logId: string): Promise<{
  success: boolean;
  log?: NotificationLog;
  error?: string;
}> {
  const db = loadDatabase();
  if (!db.notificationLogs) return { success: false, error: 'No notification logs found' };

  const index = db.notificationLogs.findIndex(l => l.id === logId);
  if (index === -1) return { success: false, error: 'Notification log not found' };

  const log = db.notificationLogs[index];
  if (log.attempts >= log.maxAttempts) {
    return { success: false, error: `Maximum retry attempts (${log.maxAttempts}) reached for this notification.` };
  }

  log.attempts += 1;
  log.status = 'RETRYING';

  try {
    if (log.channel === 'EMAIL') {
      const emailProvider = getEmailProvider();
      const res = await emailProvider.send({
        to: log.recipient,
        subject: log.subject || 'Medrella HMS Notification',
        html: log.content,
        text: log.content.replace(/<[^>]*>?/gm, ''),
      });
      if (res.success) {
        log.status = 'SENT';
        log.providerMessageId = res.messageId;
        log.sentAt = new Date().toISOString();
        log.errorMessage = undefined;
      } else {
        log.status = 'FAILED';
        log.errorMessage = res.error;
      }
    } else if (log.channel === 'SMS') {
      const smsProvider = getSmsProvider();
      const res = await smsProvider.send({
        to: log.recipient,
        message: log.content,
      });
      if (res.success) {
        log.status = 'SENT';
        log.providerMessageId = res.messageId;
        log.sentAt = new Date().toISOString();
        log.errorMessage = undefined;
      } else {
        log.status = 'FAILED';
        log.errorMessage = res.error;
      }
    } else {
      log.status = 'SENT';
      log.sentAt = new Date().toISOString();
    }
  } catch (err: any) {
    log.status = 'FAILED';
    log.errorMessage = err.message || 'Retry failed';
  }

  db.notificationLogs[index] = log;
  saveDatabase(db);
  return { success: log.status === 'SENT', log, error: log.errorMessage };
}

// ============================================================================
// --- DOCTOR LEAVE & SESSION CANCELLATION ---
// ============================================================================

export async function notifyDoctorLeave(
  doctorId: string,
  date: string,
  reason: string
): Promise<{ affectedCount: number; appointments: Appointment[] }> {
  const db = loadDatabase();
  const affected = db.appointments.filter(
    a => a.doctorId === doctorId && a.date === date && a.status !== 'CANCELLED' && a.status !== 'COMPLETED'
  );

  // Dispatch doctor leave notifications to each patient
  for (const appt of affected) {
    appt.status = 'CANCELLED';
    appt.symptoms = `${appt.symptoms} (Doctor Session Cancelled: ${reason})`;
    await NotificationService.notifyDoctorLeave(appt, reason, addNotification);
  }

  saveDatabase(db);
  return { affectedCount: affected.length, appointments: affected };
}

