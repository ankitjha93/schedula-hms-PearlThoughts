export type Role = 'PATIENT' | 'DOCTOR' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar?: string;
  doctorId?: string; // if user is a doctor
  patientId?: string; // if user is a patient
}

export interface PatientProfile {
  id: string;
  mrn: string; // Medical Record Number e.g. "MRN-2026-0941"
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  allergies: string[];
  chronicConditions: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  notificationPreferences?: PatientNotificationPreferences;
}

export interface DoctorCoordinates {
  lat: number;
  lng: number;
  city: string;
  state?: string;
  postalCode?: string;
  formattedAddress: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  specialty?: string; // alias
  experienceYears: number;
  experience?: string; // alias e.g. "12 years"
  consultationFee: number;
  fee?: number; // alias
  rating: number;
  reviewsCount: number;
  reviewCount?: number; // alias
  avatar: string;
  about: string;
  bio?: string; // alias
  education: string;
  location: string;
  hospital: string;
  departmentCode?: string;
  roomNumber?: string;
  coordinates?: DoctorCoordinates;
  distanceKm?: number;
  availableDays: string[]; // e.g. ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  conditions?: string[];
  languages?: string[];
  acceptedInsurance?: string[];
  nextAvailableSlot?: string;
  reviews?: DoctorReview[];
}

export interface DoctorReview {
  id: string;
  doctorId: string;
  patientName: string;
  rating: number; // 1 to 5
  comment: string;
  date: string;
  verifiedVisit?: boolean;
}

export interface DoctorAvailability {
  id?: string;
  doctorId: string;
  dayOfWeek?: string;
  daysOfWeek?: string[];
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  slotDurationMinutes: number; // 30
  maxCapacity?: number; // 1
  isActive?: boolean;
  blackoutDates?: string[]; // e.g. ["2026-11-10", "2026-11-11"]
}

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'PENDING';

export interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface VitalsRecord {
  bloodPressure?: string; // "120/80 mmHg"
  heartRate?: string;     // "72 bpm"
  temperature?: string;   // "98.6 °F"
  oxygenSaturation?: string; // "99%"
  respiratoryRate?: string; // "16 /min"
  weightKg?: string;      // "68 kg"
}

export interface SOAPEncounter {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  subjective: {
    chiefComplaint: string;
    historyOfPresentIllness?: string;
  };
  objective: {
    vitals?: VitalsRecord;
    physicalExamination?: string;
  };
  assessment: {
    diagnosis: string;
    icd10Code?: string;
    clinicalNotes?: string;
  };
  plan: {
    prescription: PrescriptionItem[];
    labOrders?: string[];
    lifestyleAdvice?: string;
    followUpDate?: string;
  };
  createdAt: string;
}

export interface Prescription {
  diagnosis: string;
  medicines: PrescriptionItem[];
  advice?: string;
  followUpDate?: string;
  prescribedAt: string;
  doctorNotes?: string;
  vitals?: VitalsRecord;
  labOrders?: string[];
}

export interface Appointment {
  id: string;
  tokenNumber?: number; // OPD Queue Token e.g. 1, 2, 3
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorAvatar?: string;
  doctor?: Doctor;
  date: string; // "2026-10-28"
  time: string; // "10:00 AM"
  timeSlot?: string; // alias for time
  startTime?: string; // "10:00 AM"
  endTime?: string; // "10:30 AM"
  durationMinutes: number;
  fee: number;
  status: AppointmentStatus;
  symptoms: string;
  cancellationReason?: string;
  prescription?: Prescription;
  encounter?: SOAPEncounter;
  rescheduledAt?: string;
  previousDate?: string;
  previousTime?: string;
  paymentId?: string;
  paymentStatus?: PaymentStatus;
  paymentProvider?: PaymentProvider;
  refundStatus?: RefundStatus;
  refundAmount?: number;
  refundReason?: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  category: 'CONSULTATION' | 'LAB_TEST' | 'PHARMACY' | 'PROCEDURE';
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = 'PAID' | 'PENDING' | 'CANCELLED';

export interface BillingInvoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-2026-1049"
  appointmentId?: string;
  patientId: string;
  patientName: string;
  patientMRN: string;
  doctorId?: string;
  doctorName?: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paymentMethod?: 'Cash' | 'Credit Card' | 'Insurance' | 'UPI' | 'Direct Debit';
  paidAt?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headOfDepartment: string;
  location: string;
  activeDoctorsCount: number;
  status: 'ACTIVE' | 'INACTIVE';
  description: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: {
    id: string;
    name: string;
    role: Role;
  };
  resource: string;
  details?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface HospitalKPIs {
  totalDoctors: number;
  activeAppointmentsToday: number;
  totalPatients: number;
  totalRevenue: number;
  pendingInvoicesCount: number;
  occupancyRate: number;
  averageConsultationTimeMinutes: number;
  completedVisitsCount: number;
}

export interface TimeSlot {
  time: string;
  startTime?: string;
  endTime?: string;
  isAvailable: boolean;
  available?: boolean;
  appointmentId?: string;
  period?: 'MORNING' | 'AFTERNOON';
}

export interface NotificationItem {
  id: string;
  userId?: string; // patientId or doctorId
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'APPOINTMENT' | 'PRESCRIPTION' | 'QUEUE' | 'BILLING' | 'ADMIN' | 'PAYMENT' | 'REFUND' | 'REMINDER';
  actionUrl?: string;
}

export type PaymentProvider = 'RAZORPAY' | 'STRIPE' | 'SIMULATED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type RefundStatus = 'NONE' | 'REQUESTED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export interface PaymentRecord {
  id: string;
  orderId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionReference?: string;
  paymentMethod?: string;
  refundStatus: RefundStatus;
  refundAmount?: number;
  refundReason?: string;
  providerRefundId?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

export interface SlotHold {
  slotKey: string; // `${doctorId}_${date}_${time}`
  doctorId: string;
  date: string;
  time: string;
  appointmentId: string;
  expiresAt: number; // Unix timestamp in ms (10 min TTL)
}

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  patientEmail: string;
  patientPhone?: string;
  doctorName: string;
  date: string;
  time: string;
  scheduledFor: string; // ISO date-time
  type: 'REMINDER_24H' | 'REMINDER_1H';
  status: 'SCHEDULED' | 'SENT' | 'CANCELLED';
  sentAt?: string;
}

export type NotificationChannel = 'EMAIL' | 'SMS' | 'IN_APP';
export type NotificationDeliveryStatus = 'SENT' | 'FAILED' | 'PENDING' | 'RETRYING';
export type NotificationEventType =
  | 'BOOKING_CONFIRMATION'
  | 'RESCHEDULE'
  | 'RESCHEDULE_CONFIRMATION'
  | 'CANCELLATION'
  | 'CANCELLATION_CONFIRMATION'
  | 'REMINDER_24H'
  | 'REMINDER_1H'
  | 'UPCOMING_REMINDER'
  | 'DOCTOR_LEAVE'
  | 'PAYMENT_RECEIPT'
  | 'REFUND_PROCESSED'
  | 'REFUND_UPDATE';

export interface NotificationLog {
  id: string;
  appointmentId?: string;
  patientId?: string;
  recipient: string; // email address or phone number
  channel: NotificationChannel;
  eventType: NotificationEventType;
  subject?: string;
  content: string;
  status: NotificationDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string;
  provider: 'RESEND' | 'TWILIO' | 'SMTP' | 'SIMULATED';
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface PatientNotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  remindersEnabled: boolean;
  marketingConsent: boolean;
}

