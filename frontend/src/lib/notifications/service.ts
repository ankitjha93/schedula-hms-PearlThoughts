import {
  Appointment,
  PaymentRecord,
  BillingInvoice,
  AppointmentReminder,
  NotificationItem,
  NotificationLog,
  NotificationEventType,
} from '../types';
import { getEmailProvider } from './providers/email';
import { getSmsProvider } from './providers/sms';
import {
  buildBookingConfirmationEmail,
  buildBookingConfirmationSms,
  buildRescheduleEmail,
  buildRescheduleSms,
  buildCancellationEmail,
  buildCancellationSms,
  buildReminderEmail,
  buildReminderSms,
  buildDoctorLeaveEmail,
  buildDoctorLeaveSms,
  buildPaymentReceiptEmail,
  buildPaymentReceiptSms,
  buildRefundEmail,
  buildRefundSms,
} from './templates';
import {
  addNotificationLog,
  updateNotificationLog,
  isNotificationDuplicate,
  getPatientNotificationPreferences,
} from '../db';

export interface NotificationResult {
  inAppId: string;
  emailSent: boolean;
  smsQueued: boolean;
}

/**
 * Dispatches an email notification with idempotency checking and audit logging
 */
async function sendAndLogEmail(params: {
  recipient: string;
  patientId?: string;
  appointmentId?: string;
  eventType: NotificationEventType;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<boolean> {
  const { recipient, patientId, appointmentId, eventType, subject, html, text, idempotencyKey } = params;

  if (!recipient) return false;

  // Idempotency check: prevent duplicate deliveries
  if (isNotificationDuplicate(idempotencyKey)) {
    console.log(`[IDEMPOTENCY SKIP] Email notification already sent for key: ${idempotencyKey}`);
    return true;
  }

  const emailProvider = getEmailProvider();
  const logId = `log_email_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Create initial log entry
  const log: NotificationLog = {
    id: logId,
    appointmentId,
    patientId,
    recipient,
    channel: 'EMAIL',
    eventType,
    subject,
    content: html,
    status: 'PENDING',
    attempts: 1,
    maxAttempts: 3,
    idempotencyKey,
    provider: emailProvider.name,
    createdAt: now,
  };
  addNotificationLog(log);

  try {
    const res = await emailProvider.send({
      to: recipient,
      subject,
      html,
      text,
    });

    if (res.success) {
      log.status = 'SENT';
      log.providerMessageId = res.messageId;
      log.sentAt = new Date().toISOString();
      log.errorMessage = undefined;
    } else {
      log.status = 'FAILED';
      log.errorMessage = res.error || 'Provider delivery error';
    }
  } catch (err: any) {
    log.status = 'FAILED';
    log.errorMessage = err.message || 'Network exception during email dispatch';
  }

  updateNotificationLog(log);
  return log.status === 'SENT';
}

/**
 * Dispatches an SMS notification with idempotency checking and audit logging
 */
async function sendAndLogSms(params: {
  recipient: string;
  patientId?: string;
  appointmentId?: string;
  eventType: NotificationEventType;
  message: string;
  idempotencyKey: string;
}): Promise<boolean> {
  const { recipient, patientId, appointmentId, eventType, message, idempotencyKey } = params;

  if (!recipient) return false;

  // Idempotency check
  if (isNotificationDuplicate(idempotencyKey)) {
    console.log(`[IDEMPOTENCY SKIP] SMS notification already sent for key: ${idempotencyKey}`);
    return true;
  }

  const smsProvider = getSmsProvider();
  const logId = `log_sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  // Create initial log entry
  const log: NotificationLog = {
    id: logId,
    appointmentId,
    patientId,
    recipient,
    channel: 'SMS',
    eventType,
    content: message,
    status: 'PENDING',
    attempts: 1,
    maxAttempts: 3,
    idempotencyKey,
    provider: smsProvider.name,
    createdAt: now,
  };
  addNotificationLog(log);

  try {
    const res = await smsProvider.send({
      to: recipient,
      message,
    });

    if (res.success) {
      log.status = 'SENT';
      log.providerMessageId = res.messageId;
      log.sentAt = new Date().toISOString();
      log.errorMessage = undefined;
    } else {
      log.status = 'FAILED';
      log.errorMessage = res.error || 'Provider delivery error';
    }
  } catch (err: any) {
    log.status = 'FAILED';
    log.errorMessage = err.message || 'Network exception during SMS dispatch';
  }

  updateNotificationLog(log);
  return log.status === 'SENT';
}

/**
 * Multi-Channel Healthcare Communication Service
 * Handles In-App alerts, verified Email dispatch, and SMS connectors with durable audit logging.
 */
export class NotificationService {
  /**
   * Dispatches Booking & Payment Confirmation
   */
  static async notifyBookingConfirmation(
    appointment: Appointment,
    payment?: PaymentRecord,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = appointment.patientId ? getPatientNotificationPreferences(appointment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    // 1. Email notification
    if (prefs.emailEnabled && appointment.patientEmail) {
      const emailContent = buildBookingConfirmationEmail(appointment, payment);
      emailSent = await sendAndLogEmail({
        recipient: appointment.patientEmail,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'BOOKING_CONFIRMATION',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `booking_${appointment.id}_email`,
      });
    }

    // 2. SMS notification
    if (prefs.smsEnabled && appointment.patientPhone) {
      const smsContent = buildBookingConfirmationSms(appointment);
      smsQueued = await sendAndLogSms({
        recipient: appointment.patientPhone,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'BOOKING_CONFIRMATION',
        message: smsContent.message,
        idempotencyKey: `booking_${appointment.id}_sms`,
      });
    }

    // 3. In-App notification
    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Consultation Confirmed';
      const message = `Your visit with ${appointment.doctorName} (${appointment.doctorSpecialty}) on ${appointment.date} at ${appointment.time} is confirmed. OPD Token #${appointment.tokenNumber || 1}.`;
      const created = addNotificationFn({
        userId: appointment.patientId,
        title,
        message,
        type: 'APPOINTMENT',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Payment Receipt & Transaction Reference
   */
  static async notifyPaymentReceipt(
    payment: PaymentRecord,
    invoice?: BillingInvoice,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = payment.patientId ? getPatientNotificationPreferences(payment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    if (prefs.emailEnabled && payment.patientEmail) {
      const emailContent = buildPaymentReceiptEmail(payment, invoice);
      emailSent = await sendAndLogEmail({
        recipient: payment.patientEmail,
        patientId: payment.patientId,
        appointmentId: payment.appointmentId,
        eventType: 'PAYMENT_RECEIPT',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `payment_${payment.id}_email`,
      });
    }

    if (prefs.smsEnabled && payment.patientPhone) {
      const smsContent = buildPaymentReceiptSms(payment);
      smsQueued = await sendAndLogSms({
        recipient: payment.patientPhone,
        patientId: payment.patientId,
        appointmentId: payment.appointmentId,
        eventType: 'PAYMENT_RECEIPT',
        message: smsContent.message,
        idempotencyKey: `payment_${payment.id}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Payment Receipt Issued';
      const message = `Payment of $${payment.amount.toFixed(2)} received via ${payment.provider} (${payment.paymentMethod || 'Online'}). Transaction Ref: ${payment.transactionReference || payment.id}.`;
      const created = addNotificationFn({
        userId: payment.patientId,
        title,
        message,
        type: 'PAYMENT',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Rescheduled Visit Alert
   */
  static async notifyReschedule(
    appointment: Appointment,
    previousDate?: string,
    previousTime?: string,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = appointment.patientId ? getPatientNotificationPreferences(appointment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    const rescheduleKey = `${appointment.id}_${appointment.date}_${appointment.time}`;

    if (prefs.emailEnabled && appointment.patientEmail) {
      const emailContent = buildRescheduleEmail(appointment, previousDate, previousTime);
      emailSent = await sendAndLogEmail({
        recipient: appointment.patientEmail,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'RESCHEDULE_CONFIRMATION',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `reschedule_${rescheduleKey}_email`,
      });
    }

    if (prefs.smsEnabled && appointment.patientPhone) {
      const smsContent = buildRescheduleSms(appointment, previousDate, previousTime);
      smsQueued = await sendAndLogSms({
        recipient: appointment.patientPhone,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'RESCHEDULE_CONFIRMATION',
        message: smsContent.message,
        idempotencyKey: `reschedule_${rescheduleKey}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Appointment Rescheduled';
      const message = `Your consultation with ${appointment.doctorName} was moved from ${previousDate || 'prior date'} to ${appointment.date} at ${appointment.time}. OPD Token #${appointment.tokenNumber || 1}.`;
      const created = addNotificationFn({
        userId: appointment.patientId,
        title,
        message,
        type: 'APPOINTMENT',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Cancellation Notice
   */
  static async notifyCancellation(
    appointment: Appointment,
    refundAmount?: number,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = appointment.patientId ? getPatientNotificationPreferences(appointment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    if (prefs.emailEnabled && appointment.patientEmail) {
      const emailContent = buildCancellationEmail(appointment, refundAmount);
      emailSent = await sendAndLogEmail({
        recipient: appointment.patientEmail,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'CANCELLATION_CONFIRMATION',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `cancellation_${appointment.id}_email`,
      });
    }

    if (prefs.smsEnabled && appointment.patientPhone) {
      const smsContent = buildCancellationSms(appointment, refundAmount);
      smsQueued = await sendAndLogSms({
        recipient: appointment.patientPhone,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'CANCELLATION_CONFIRMATION',
        message: smsContent.message,
        idempotencyKey: `cancellation_${appointment.id}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Consultation Cancelled';
      const refundText = refundAmount !== undefined && refundAmount > 0 
        ? ` Eligible refund: $${refundAmount.toFixed(2)}.` 
        : ' In accordance with hospital cancellation policy.';
      const message = `Your visit with ${appointment.doctorName} on ${appointment.date} at ${appointment.time} has been cancelled.${refundText}`;
      const created = addNotificationFn({
        userId: appointment.patientId,
        title,
        message,
        type: 'APPOINTMENT',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Refund Processed Alert
   */
  static async notifyRefund(
    payment: PaymentRecord,
    refundAmount: number,
    policyReason: string,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = payment.patientId ? getPatientNotificationPreferences(payment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    if (prefs.emailEnabled && payment.patientEmail) {
      const emailContent = buildRefundEmail(payment, refundAmount, policyReason);
      emailSent = await sendAndLogEmail({
        recipient: payment.patientEmail,
        patientId: payment.patientId,
        appointmentId: payment.appointmentId,
        eventType: 'REFUND_UPDATE',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `refund_${payment.id}_${Math.round(refundAmount * 100)}_email`,
      });
    }

    if (prefs.smsEnabled && payment.patientPhone) {
      const smsContent = buildRefundSms(payment, refundAmount);
      smsQueued = await sendAndLogSms({
        recipient: payment.patientPhone,
        patientId: payment.patientId,
        appointmentId: payment.appointmentId,
        eventType: 'REFUND_UPDATE',
        message: smsContent.message,
        idempotencyKey: `refund_${payment.id}_${Math.round(refundAmount * 100)}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Refund Processed';
      const message = `Refund of $${refundAmount.toFixed(2)} initiated to your original payment method (${payment.provider}). ${policyReason}`;
      const created = addNotificationFn({
        userId: payment.patientId,
        title,
        message,
        type: 'REFUND',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Automated Pre-Consultation Reminder (24h or 1h)
   */
  static async notifyReminder(
    reminder: AppointmentReminder,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = reminder.patientId ? getPatientNotificationPreferences(reminder.patientId) : { emailEnabled: true, smsEnabled: true, remindersEnabled: true };

    // Respect patient preference: remindersEnabled
    if (prefs.remindersEnabled === false) {
      console.log(`[REMINDER SUPPRESSED] Patient ${reminder.patientId} opted out of reminders.`);
      return { inAppId: '', emailSent: false, smsQueued: false };
    }

    let emailSent = false;
    let smsQueued = false;

    if (prefs.emailEnabled && reminder.patientEmail) {
      const emailContent = buildReminderEmail(reminder);
      emailSent = await sendAndLogEmail({
        recipient: reminder.patientEmail,
        patientId: reminder.patientId,
        appointmentId: reminder.appointmentId,
        eventType: 'UPCOMING_REMINDER',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `reminder_${reminder.id}_email`,
      });
    }

    if (prefs.smsEnabled && reminder.patientPhone) {
      const smsContent = buildReminderSms(reminder);
      smsQueued = await sendAndLogSms({
        recipient: reminder.patientPhone,
        patientId: reminder.patientId,
        appointmentId: reminder.appointmentId,
        eventType: 'UPCOMING_REMINDER',
        message: smsContent.message,
        idempotencyKey: `reminder_${reminder.id}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const is1H = reminder.type === 'REMINDER_1H';
      const title = is1H ? '1-Hour Visit Reminder' : '24-Hour Visit Reminder';
      const message = is1H
        ? `Your appointment with ${reminder.doctorName} begins in 1 hour at ${reminder.time}. Please proceed to the clinic desk.`
        : `Friendly reminder: You have an appointment tomorrow at ${reminder.time} with ${reminder.doctorName}.`;

      const created = addNotificationFn({
        userId: reminder.patientId,
        title,
        message,
        type: 'REMINDER',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }

  /**
   * Dispatches Doctor Leave / Session Cancellation Notice
   */
  static async notifyDoctorLeave(
    appointment: Appointment,
    reason: string,
    addNotificationFn?: (item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => NotificationItem
  ): Promise<NotificationResult> {
    const prefs = appointment.patientId ? getPatientNotificationPreferences(appointment.patientId) : { emailEnabled: true, smsEnabled: true };

    let emailSent = false;
    let smsQueued = false;

    if (prefs.emailEnabled && appointment.patientEmail) {
      const emailContent = buildDoctorLeaveEmail(appointment, reason);
      emailSent = await sendAndLogEmail({
        recipient: appointment.patientEmail,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'DOCTOR_LEAVE',
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        idempotencyKey: `doctor_leave_${appointment.id}_email`,
      });
    }

    if (prefs.smsEnabled && appointment.patientPhone) {
      const smsContent = buildDoctorLeaveSms(appointment, reason);
      smsQueued = await sendAndLogSms({
        recipient: appointment.patientPhone,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        eventType: 'DOCTOR_LEAVE',
        message: smsContent.message,
        idempotencyKey: `doctor_leave_${appointment.id}_sms`,
      });
    }

    let inAppId = `notif_${Date.now()}`;
    if (addNotificationFn) {
      const title = 'Doctor Session Rescheduled / Leave';
      const message = `Notice: ${appointment.doctorName}'s session on ${appointment.date} was cancelled due to: ${reason}. Please choose an alternative slot or receive a refund.`;
      const created = addNotificationFn({
        userId: appointment.patientId,
        title,
        message,
        type: 'APPOINTMENT',
        actionUrl: '/patient',
      });
      inAppId = created.id;
    }

    return { inAppId, emailSent, smsQueued };
  }
}
