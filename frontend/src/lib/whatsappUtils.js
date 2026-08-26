/**
 * WhatsApp message and direct click-to-chat link generators for Divine Yoga Studio.
 */

/**
 * Normalizes an Indian or international phone number into clean digits (e.g. "919876543210").
 */
export function normalizePhoneForWhatsApp(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits;
}

/**
 * Built-in default message templates with rich studio branding.
 */
export const DEFAULT_STUDIO_TEMPLATES = [
  {
    id: "preset-renewal-upcoming",
    name: "Advance Renewal Reminder",
    category: "Renewal",
    trigger_type: "before_due",
    message_body: `Namaste {name} 🙏

This is a gentle advance reminder that your *{plan}* for *{batch}* at {studio_name} is scheduled for renewal on *{due_date}*.

📌 *Renewal Amount:* ₹{amount}
🧘 *Validity:* Full access to scheduled studio sessions.

To continue your daily wellness practice without interruption, kindly complete your renewal via UPI or at the studio front desk.

Warm regards,
*Divine Yoga Studio* 🌿
📍 Studio Reception & Wellness Team`,
  },
  {
    id: "preset-due-today",
    name: "Fee Due Today",
    category: "Payment",
    trigger_type: "on_due",
    message_body: `Namaste {name} 🙏

Your *{plan}* fee of *₹{amount}* is due today (*{due_date}*).

Kindly complete the fee payment today to keep your attendance active in your batch (*{batch}*).

Thank you for being a valued part of {studio_name}!

Warm regards,
*Divine Yoga Studio* 🌿
📍 Studio Reception & Wellness Team`,
  },
  {
    id: "preset-overdue",
    name: "Overdue Payment Notice",
    category: "Overdue",
    trigger_type: "overdue",
    message_body: `Namaste {name} 🙏

We hope you are enjoying your yoga practice! 🌸

This is a friendly reminder that your *{plan}* fee of *₹{amount}* was due on *{due_date}* and is currently pending.

Please clear the dues at your earliest convenience via UPI or at the studio front desk. If you have already paid, please ignore this message.

Warm regards,
*Divine Yoga Studio* 🌿
📍 Studio Reception & Wellness Team`,
  },
  {
    id: "preset-welcome",
    name: "Welcome & Registration Details",
    category: "Welcome",
    trigger_type: "welcome",
    message_body: `Namaste {name} 🙏

Welcome to the *Divine Yoga Studio* family! 🕉️✨

Here are your registered practice details:
• *Batch:* {batch} ({batch_time})
• *Plan:* {plan}
• *Fee:* ₹{amount}
• *Next Renewal:* {due_date}

Please bring your personal yoga mat and water bottle. We look forward to seeing you on the mat!

Warm regards,
*Divine Yoga Studio* 🌿
📍 Studio Reception & Wellness Team`,
  },
  {
    id: "preset-schedule",
    name: "Batch Schedule & Timings",
    category: "Schedule",
    trigger_type: "info",
    message_body: `Namaste {name} 🙏

This is an update regarding your yoga session schedule:

• *Batch:* {batch}
• *Timings:* {batch_time}
• *Studio:* {studio_name}

Kindly arrive 5-10 minutes prior to your session for breathing and preparation. See you on the mat!

Warm regards,
*Divine Yoga Studio* 🌿
📍 Studio Reception & Wellness Team`,
  },
];

/**
 * Replaces placeholder variables in a template body with client/payment details.
 */
export function renderTemplateMessage(templateBody = "", variables = {}) {
  if (!templateBody) return "";

  const name = variables.name || variables.clientName || variables.full_name || "Practitioner";
  const plan = variables.plan || variables.planName || variables.plan_name || "Yoga Membership";
  const batch = variables.batch || variables.batchName || variables.batch_name || "Assigned Batch";
  const batchTime = variables.batchTime || variables.batch_time || "";
  const rawAmount = variables.amount ?? variables.amount_due ?? 1800;
  const amount = Number(rawAmount || 0).toLocaleString("en-IN");
  const dueDate = variables.dueDate || variables.due_date || variables.renewal_date || variables.next_renewal_date || "Scheduled Date";
  const studioName = variables.studioName || variables.studio_name || "Divine Yoga Studio";
  const instructor = variables.instructor || variables.instructor_name || "Divine Yoga Instructor";
  const phone = variables.phone || variables.phoneNumber || variables.phone_number || "";

  let result = templateBody;

  // Replace common placeholders
  result = result.replace(/\{name\}|\{client_name\}|\{practitioner\}/gi, name);
  result = result.replace(/\{plan\}|\{plan_name\}|\{membership\}/gi, plan);
  result = result.replace(/\{batch\}|\{batch_name\}/gi, batch);
  result = result.replace(/\{batch_time\}|\{timing\}|\{time\}/gi, batchTime || "Scheduled Time");
  result = result.replace(/\{amount\}|\{fee\}|\{price\}/gi, amount);
  result = result.replace(/\{due_date\}|\{renewal_date\}|\{next_renewal\}/gi, dueDate);
  result = result.replace(/\{studio_name\}|\{studio\}/gi, studioName);
  result = result.replace(/\{instructor\}|\{instructor_name\}/gi, instructor);
  result = result.replace(/\{phone\}|\{phone_number\}/gi, phone);
  result = result.replace(/\{month\}/gi, String(dueDate).slice(0, 7) || "Current Month");

  return result;
}

/**
 * Backward compatibility helper for legacy calls.
 */
export function buildWhatsAppMessage({
  clientName = "Practitioner",
  planName = "Yoga Membership",
  batchName = "",
  amount = 1800,
  dueDate = "",
  reminderType = "renewal_upcoming",
}) {
  const match = DEFAULT_STUDIO_TEMPLATES.find((t) => t.trigger_type === reminderType) || DEFAULT_STUDIO_TEMPLATES[0];
  return renderTemplateMessage(match.message_body, {
    clientName,
    planName,
    batchName,
    amount,
    dueDate,
  });
}

/**
 * Returns a direct "https://wa.me/..." URL with pre-encoded message text.
 */
export function getWhatsAppDirectUrl({
  phoneNumber,
  messageText,
  clientName,
  planName,
  batchName,
  amount,
  dueDate,
  reminderType = "renewal_upcoming",
}) {
  const cleanPhone = normalizePhoneForWhatsApp(phoneNumber);
  if (!cleanPhone) return "#";
  const finalMessage =
    messageText ||
    buildWhatsAppMessage({
      clientName,
      planName,
      batchName,
      amount,
      dueDate,
      reminderType,
    });
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`;
}
