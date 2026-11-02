/**
 * Reusable Healthcare Notification Templates for Medrella HMS
 * Produces responsive HTML emails and concise, HIPAA-compliant SMS texts.
 * Notice: Omits sensitive medical conditions/diagnoses per privacy regulations.
 */

import { Appointment, PaymentRecord, BillingInvoice, AppointmentReminder } from '../types';
import { formatConsultationWindow } from '../timeUtils';

export interface EmailTemplateOutput {
  subject: string;
  html: string;
  text: string;
}

export interface SmsTemplateOutput {
  message: string;
}

// Common email shell wrapper with clean clinical styling
function wrapHtmlEmail(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; color: #1e293b; }
    .container { max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0f172a 0%, #064e3b 100%); padding: 32px; text-align: center; color: #ffffff; }
    .logo { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .logo-badge { color: #34d399; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 1.5px; margin-top: 6px; }
    .content { padding: 36px 32px; }
    .token-badge { display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; font-size: 13px; font-weight: 800; padding: 6px 14px; border-radius: 9999px; margin-bottom: 20px; }
    .detail-card { background-color: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #64748b; font-weight: 500; }
    .detail-value { color: #0f172a; font-weight: 700; text-align: right; }
    .btn { display: inline-block; background-color: #059669; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; text-align: center; margin-top: 10px; }
    .footer { padding: 24px 32px; background-color: #f8fafc; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Medrella Health</div>
      <div class="logo-badge">Clinical Healthcare &amp; Outpatient System</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>This is an automated operational notification from Medrella Clinical System.</p>
      <p>Need assistance? Contact support@medrella.com or visit the patient portal.</p>
    </div>
  </div>
</body>
</html>`;
}

// 1. Booking Confirmation
export function buildBookingConfirmationEmail(
  appt: Appointment,
  payment?: PaymentRecord
): EmailTemplateOutput {
  const windowStr = formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time);
  const tokenStr = `Token #OPD-${String(appt.tokenNumber || 1).padStart(2, '0')}`;
  const feeStr = payment ? `Paid (${payment.currency} ${payment.amount})` : 'Confirmed';

  const subject = `Confirmed: Outpatient Visit with ${appt.doctorName} (${tokenStr})`;

  const bodyContent = `
    <div class="token-badge">${tokenStr}</div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Appointment Confirmed!</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${appt.patientName}, your outpatient consultation at Medrella has been successfully confirmed.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Consulting Specialist:</span>
        <span class="detail-value">${appt.doctorName} (${appt.doctorSpecialty})</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${appt.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Consultation Window:</span>
        <span class="detail-value">${windowStr}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Queue Token:</span>
        <span class="detail-value" style="color: #059669;">${tokenStr}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Status:</span>
        <span class="detail-value">${feeStr}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Booking Reference:</span>
        <span class="detail-value" style="font-family: monospace;">${appt.id}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #64748b;">
      Please arrive 10 minutes prior to your consultation window. Automated reminder alerts will be sent 24 hours and 1 hour before your visit.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      <a href="http://localhost:3000/patient" class="btn">View in Patient EHR</a>
    </div>
  `;

  const text = `Medrella Health - Appointment Confirmed
Dear ${appt.patientName},
Your visit with ${appt.doctorName} (${appt.doctorSpecialty}) is confirmed for ${appt.date} (${windowStr}).
Queue Token: ${tokenStr}
Booking Ref: ${appt.id}
Payment: ${feeStr}
Please arrive 10 mins prior. Manage your booking at: http://localhost:3000/patient`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildBookingConfirmationSms(appt: Appointment): SmsTemplateOutput {
  const windowStr = formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time);
  const tokenStr = `#OPD-${String(appt.tokenNumber || 1).padStart(2, '0')}`;
  return {
    message: `Medrella: Visit confirmed with ${appt.doctorName} on ${appt.date} (${windowStr}). Token ${tokenStr}. Arrive 10m early. Details: http://localhost:3000/patient`,
  };
}

// 2. Rescheduling Confirmation
export function buildRescheduleEmail(
  appt: Appointment,
  previousDate?: string,
  previousTime?: string
): EmailTemplateOutput {
  const newWindowStr = formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time);
  const tokenStr = `Token #OPD-${String(appt.tokenNumber || 1).padStart(2, '0')}`;
  const subject = `Rescheduled: Visit with ${appt.doctorName} moved to ${appt.date}`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8;">
      Rescheduled Notice
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Appointment Successfully Rescheduled</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${appt.patientName}, your consultation has been updated to your chosen new slot.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Specialist:</span>
        <span class="detail-value">${appt.doctorName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Previous Slot:</span>
        <span class="detail-value" style="color: #94a3b8; text-decoration: line-through;">${previousDate || 'Prior date'} at ${previousTime || 'prior time'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">New Date:</span>
        <span class="detail-value" style="color: #059669;">${appt.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">New Time Window:</span>
        <span class="detail-value" style="color: #059669;">${newWindowStr}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">New OPD Token:</span>
        <span class="detail-value">${tokenStr}</span>
      </div>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="http://localhost:3000/patient" class="btn">View Rescheduled Visit</a>
    </div>
  `;

  const text = `Medrella Health - Appointment Rescheduled
Dear ${appt.patientName},
Your visit with ${appt.doctorName} was rescheduled from ${previousDate} to ${appt.date} (${newWindowStr}).
New Token: ${tokenStr}.
Manage visit: http://localhost:3000/patient`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildRescheduleSms(
  appt: Appointment,
  previousDate?: string,
  previousTime?: string
): SmsTemplateOutput {
  const newWindowStr = formatConsultationWindow(appt.startTime, appt.endTime, appt.timeSlot || appt.time);
  const tokenStr = `#OPD-${String(appt.tokenNumber || 1).padStart(2, '0')}`;
  return {
    message: `Medrella: Your visit with ${appt.doctorName} was moved to ${appt.date} (${newWindowStr}). Token ${tokenStr}. Details: http://localhost:3000/patient`,
  };
}

// 3. Cancellation & Refund Notice
export function buildCancellationEmail(
  appt: Appointment,
  refundAmount?: number,
  reason?: string
): EmailTemplateOutput {
  const subject = `Cancelled: Appointment with ${appt.doctorName} on ${appt.date}`;
  const refundDetail =
    refundAmount && refundAmount > 0
      ? `<div class="detail-row">
          <span class="detail-label">Eligible Refund Amount:</span>
          <span class="detail-value" style="color: #059669;">$${refundAmount.toFixed(2)} (Processed)</span>
        </div>`
      : `<div class="detail-row">
          <span class="detail-label">Refund Policy:</span>
          <span class="detail-value">Per hospital policy (<24h / Non-refundable)</span>
        </div>`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #fef2f2; border-color: #fecaca; color: #b91c1c;">
      Cancelled
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Appointment Cancellation Notice</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${appt.patientName}, your appointment scheduled for ${appt.date} has been cancelled.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Doctor:</span>
        <span class="detail-value">${appt.doctorName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Scheduled Slot:</span>
        <span class="detail-value">${appt.date} • ${appt.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason || 'Patient request'}</span>
      </div>
      ${refundDetail}
    </div>

    <p style="font-size: 13px; color: #64748b;">
      All scheduled reminders for this visit have been cancelled. If an eligible refund was initiated, please allow 5-7 business days for banking settlement.
    </p>
  `;

  const text = `Medrella Health - Appointment Cancelled
Dear ${appt.patientName}, your visit with ${appt.doctorName} on ${appt.date} at ${appt.time} is cancelled.
${refundAmount && refundAmount > 0 ? `Refund of $${refundAmount.toFixed(2)} initiated.` : ''}
Reminders cancelled. Details: http://localhost:3000/patient`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildCancellationSms(appt: Appointment, refundAmount?: number): SmsTemplateOutput {
  const refundText = refundAmount && refundAmount > 0 ? ` Refund of $${refundAmount.toFixed(2)} initiated.` : '';
  return {
    message: `Medrella: Your visit with ${appt.doctorName} on ${appt.date} has been cancelled.${refundText} Reminders deactivated.`,
  };
}

// 4. Pre-Consultation Reminders (24H & 1H)
export function buildReminderEmail(reminder: AppointmentReminder): EmailTemplateOutput {
  const is1H = reminder.type === 'REMINDER_1H';
  const subject = is1H
    ? `Reminder: Visit with ${reminder.doctorName} begins in 1 hour (${reminder.time})`
    : `Reminder: Tomorrow's visit with ${reminder.doctorName} at ${reminder.time}`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #fffbeb; border-color: #fde68a; color: #b45309;">
      ${is1H ? '⚡ 1-Hour Reminder' : '📅 Tomorrow Reminder'}
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">
      ${is1H ? 'Your Appointment Starts Soon!' : 'Upcoming Consultation Reminder'}
    </h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      ${
        is1H
          ? `Your consultation with ${reminder.doctorName} begins in approximately 1 hour. Please proceed to the clinic desk.`
          : `This is a friendly reminder of your scheduled consultation tomorrow with ${reminder.doctorName}.`
      }
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Physician:</span>
        <span class="detail-value">${reminder.doctorName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Consultation Date:</span>
        <span class="detail-value">${reminder.date}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Time:</span>
        <span class="detail-value" style="color: #059669;">${reminder.time}</span>
      </div>
    </div>

    <div style="text-align: center; margin-top: 24px;">
      <a href="http://localhost:3000/patient" class="btn">View in Patient Portal</a>
    </div>
  `;

  const text = `Medrella Health - Visit Reminder
${is1H ? 'Your visit starts in 1 hour!' : 'Upcoming visit reminder for tomorrow.'}
Doctor: ${reminder.doctorName}
Time: ${reminder.date} at ${reminder.time}
Portal: http://localhost:3000/patient`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildReminderSms(reminder: AppointmentReminder): SmsTemplateOutput {
  const is1H = reminder.type === 'REMINDER_1H';
  return {
    message: is1H
      ? `Medrella Reminder: Your visit with ${reminder.doctorName} is in 1 hour at ${reminder.time}. Please proceed to clinic. http://localhost:3000/patient`
      : `Medrella Reminder: Visit tomorrow with ${reminder.doctorName} at ${reminder.time}. Manage: http://localhost:3000/patient`,
  };
}

// 5. Doctor Leave / Session Cancellation Notice
export function buildDoctorLeaveEmail(appt: Appointment, reason: string): EmailTemplateOutput {
  const subject = `Urgent: Physician Schedule Change for ${appt.date} (${appt.doctorName})`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #fef2f2; border-color: #fecaca; color: #b91c1c;">
      Doctor Schedule Notice
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Urgent: Session Reschedule Notice</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${appt.patientName}, ${appt.doctorName} has an unforeseen clinical schedule change (${reason}). Your appointment on ${appt.date} at ${appt.time} cannot proceed at this scheduled time.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Doctor:</span>
        <span class="detail-value">${appt.doctorName}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Original Slot:</span>
        <span class="detail-value">${appt.date} at ${appt.time}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Reason:</span>
        <span class="detail-value">${reason}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #64748b;">
      Please select a priority replacement slot at no additional fee, or request a complete 100% refund.
    </p>

    <div style="text-align: center; margin-top: 24px;">
      <a href="http://localhost:3000/patient" class="btn">Select New Priority Slot</a>
    </div>
  `;

  const text = `Medrella Health - Doctor Schedule Change
Dear ${appt.patientName}, ${appt.doctorName} is on leave on ${appt.date} (${reason}).
Please reschedule your visit at no charge or request a refund: http://localhost:3000/patient`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildDoctorLeaveSms(appt: Appointment, reason: string): SmsTemplateOutput {
  return {
    message: `Medrella Notice: ${appt.doctorName} is unavailable on ${appt.date} (${reason}). Please pick a free replacement slot: http://localhost:3000/patient`,
  };
}

// 6. Payment Receipt
export function buildPaymentReceiptEmail(
  payment: PaymentRecord,
  invoice?: BillingInvoice
): EmailTemplateOutput {
  const invNumber = invoice?.invoiceNumber || `INV-${payment.id.substring(4, 10)}`;
  const subject = `Payment Receipt: ${invNumber} (${payment.currency} ${payment.amount.toFixed(2)})`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #ecfdf5; border-color: #a7f3d0; color: #047857;">
      Payment Received
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Payment Receipt</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${payment.patientName}, we have received your payment for consultation services.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Invoice Number:</span>
        <span class="detail-value" style="font-family: monospace;">${invNumber}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Amount Paid:</span>
        <span class="detail-value" style="color: #059669;">${payment.currency} ${payment.amount.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Gateway:</span>
        <span class="detail-value">${payment.provider}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Transaction Ref:</span>
        <span class="detail-value" style="font-family: monospace;">${payment.transactionReference || payment.id}</span>
      </div>
    </div>
  `;

  const text = `Medrella Health - Payment Receipt ${invNumber}
Amount: ${payment.currency} ${payment.amount.toFixed(2)}
Gateway: ${payment.provider}
Ref: ${payment.transactionReference || payment.id}`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildPaymentReceiptSms(payment: PaymentRecord): SmsTemplateOutput {
  return {
    message: `Medrella: Payment of ${payment.currency} ${payment.amount.toFixed(2)} received via ${payment.provider}. Ref: ${payment.transactionReference || payment.id}.`,
  };
}

// 7. Refund Processed
export function buildRefundEmail(
  payment: PaymentRecord,
  refundAmount: number,
  policyReason: string
): EmailTemplateOutput {
  const subject = `Refund Initiated: ${payment.currency} ${refundAmount.toFixed(2)} via ${payment.provider}`;

  const bodyContent = `
    <div class="token-badge" style="background-color: #eff6ff; border-color: #bfdbfe; color: #1d4ed8;">
      Refund Initiated
    </div>
    <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">Refund Confirmation</h2>
    <p style="font-size: 14px; color: #475569; line-height: 1.6;">
      Dear ${payment.patientName}, a refund has been initiated to your original payment method.
    </p>

    <div class="detail-card">
      <div class="detail-row">
        <span class="detail-label">Refund Amount:</span>
        <span class="detail-value" style="color: #059669;">${payment.currency} ${refundAmount.toFixed(2)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Gateway:</span>
        <span class="detail-value">${payment.provider}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Policy Tier:</span>
        <span class="detail-value">${policyReason}</span>
      </div>
    </div>

    <p style="font-size: 13px; color: #64748b;">
      The refunded funds should appear in your source bank or card account within 5-7 business days depending on your financial institution.
    </p>
  `;

  const text = `Medrella Health - Refund Confirmation
Amount: ${payment.currency} ${refundAmount.toFixed(2)}
Gateway: ${payment.provider}
Reason: ${policyReason}
Settlement timeframe: 5-7 business days.`;

  return { subject, html: wrapHtmlEmail(subject, bodyContent), text };
}

export function buildRefundSms(payment: PaymentRecord, refundAmount: number): SmsTemplateOutput {
  return {
    message: `Medrella: Refund of ${payment.currency} ${refundAmount.toFixed(2)} initiated via ${payment.provider}. Expected in 5-7 business days.`,
  };
}
