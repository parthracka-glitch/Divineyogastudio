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
 * Builds a formatted WhatsApp message based on reminder type and client / payment context.
 */
export function buildWhatsAppMessage({
  clientName = "Practitioner",
  planName = "Yoga Membership",
  batchName = "",
  amount = 1800,
  dueDate = "",
  reminderType = "renewal_upcoming", // "renewal_upcoming", "due_today", "overdue", "welcome"
}) {
  const formattedAmount = `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  const greeting = `Namaste ${clientName} 🙏`;
  const studioSignature = `\n\nWarm regards,\n*Divine Yoga Studio*\n📍 Studio Reception & Wellness Team`;

  switch (reminderType) {
    case "renewal_upcoming":
      return (
        `${greeting}\n\n` +
        `This is a gentle advance reminder that your *${planName}*${batchName ? ` for *${batchName}*` : ""} is scheduled for renewal on *${dueDate}*.\n\n` +
        `📌 *Renewal Amount:* ${formattedAmount}\n` +
        `🧘 *Validity:* Full access to scheduled studio sessions.\n\n` +
        `To continue your daily wellness practice without interruption, kindly complete your renewal via UPI or at the studio reception.${studioSignature}`
      );

    case "due_today":
      return (
        `${greeting}\n\n` +
        `Your *${planName}* fee of *${formattedAmount}* is due today (*${dueDate}*).\n\n` +
        `Kindly complete the fee payment today to keep your attendance active in your batch${batchName ? ` (*${batchName}*)` : ""}.\n\n` +
        `Thank you for being a valued part of Divine Yoga Studio!${studioSignature}`
      );

    case "overdue":
      return (
        `${greeting}\n\n` +
        `We hope you are enjoying your yoga practice! 🌸\n\n` +
        `This is a friendly reminder that your *${planName}* fee of *${formattedAmount}* was due on *${dueDate}* and is currently pending.\n\n` +
        `Please clear the dues at your earliest convenience via UPI or at the studio front desk. If you have already paid, please ignore this note or share your receipt screenshot.${studioSignature}`
      );

    case "welcome":
    default:
      return (
        `${greeting}\n\n` +
        `Welcome to the *Divine Yoga Studio* family! 🕉️✨\n\n` +
        `Here are your registration details:\n` +
        `• *Batch:* ${batchName || "Assigned Batch"}\n` +
        `• *Plan:* ${planName}\n` +
        `• *Fee:* ${formattedAmount}\n` +
        (dueDate ? `• *Next Renewal:* ${dueDate}\n\n` : "\n") +
        `Please bring your personal yoga mat and water bottle. We look forward to seeing you on the mat!${studioSignature}`
      );
  }
}

/**
 * Returns a direct "https://wa.me/..." URL with pre-encoded message text.
 */
export function getWhatsAppDirectUrl({
  phoneNumber,
  clientName,
  planName,
  batchName,
  amount,
  dueDate,
  reminderType = "renewal_upcoming",
}) {
  const cleanPhone = normalizePhoneForWhatsApp(phoneNumber);
  if (!cleanPhone) return "#";
  const message = buildWhatsAppMessage({
    clientName,
    planName,
    batchName,
    amount,
    dueDate,
    reminderType,
  });
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}
