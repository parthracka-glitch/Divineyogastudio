/**
 * Batch & Membership Plan time, pricing, and visual formatting helpers for Divine Yoga Studio.
 */

/**
 * Converts a 24-hour time string ("07:15", "16:15") or passes through 12-hour format into clean "7:15 AM", "4:15 PM".
 */
export function formatTime12h(timeStr) {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  if (trimmed.includes("AM") || trimmed.includes("PM") || trimmed.includes("am") || trimmed.includes("pm")) {
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length < 2) return trimmed;

  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return trimmed;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHours}:${minutes} ${period}`;
}

/**
 * Formats start and end times into a clean range: "7:15 AM – 8:15 AM"
 */
export function formatBatchTimeRange(startTime, endTime) {
  if (!startTime) return "";
  const formattedStart = formatTime12h(startTime);
  if (!endTime) return formattedStart;
  const formattedEnd = formatTime12h(endTime);
  return `${formattedStart} – ${formattedEnd}`;
}

/**
 * Calculates duration in minutes/hours between two "HH:MM" times.
 */
export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return "";
  try {
    const [h1, m1] = startTime.split(":").map(Number);
    const [h2, m2] = endTime.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60;
    if (diff === 60) return "1 hr";
    if (diff > 60 && diff % 60 === 0) return `${diff / 60} hrs`;
    if (diff > 60) return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    return `${diff} mins`;
  } catch {
    return "";
  }
}

/**
 * Summarizes schedule days into a clean, human-readable string.
 * e.g., ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] -> "Mon – Sat"
 *       ["Tue", "Thu", "Sat"] -> "Tue, Thu & Sat"
 *       ["Mon", "Wed", "Fri"] -> "Mon, Wed & Fri"
 */
export function formatScheduleDays(scheduleDays) {
  if (!scheduleDays) return "All Week";
  const days = Array.isArray(scheduleDays)
    ? scheduleDays
    : scheduleDays.split(",").map((d) => d.trim()).filter(Boolean);

  if (days.length === 0) return "Flexible Schedule";
  if (days.length >= 7) return "Daily (Mon – Sun)";
  
  const normalized = days.map((d) => d.slice(0, 3));
  const weekDaysMonSat = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekDaysMonFri = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  if (normalized.length === 6 && weekDaysMonSat.every((d) => normalized.includes(d))) {
    return "Mon – Sat";
  }
  if (normalized.length === 5 && weekDaysMonFri.every((d) => normalized.includes(d))) {
    return "Mon – Fri";
  }

  if (days.length === 3) {
    return `${days[0]}, ${days[1]} & ${days[2]}`;
  }

  return days.join(", ");
}

/**
 * Maps batch name and category tag to a curated visual theme.
 */
export function getCategoryStyle(categoryTag = "", batchName = "") {
  const combined = `${categoryTag} ${batchName}`.toLowerCase();

  if (combined.includes("pregnancy") || combined.includes("prenatal")) {
    return {
      tone: "prenatal",
      label: "Prenatal Yoga",
      badgeColor: "#a35314",
      bgColor: "#fef6ee",
      borderColor: "#fbdab9",
      iconType: "pregnancy",
      description: "Tue, Thu & Sat Special",
    };
  }

  if (combined.includes("kid")) {
    return {
      tone: "kids",
      label: "Kids Yoga",
      badgeColor: "#176384",
      bgColor: "#edf7fc",
      borderColor: "#c1e4f3",
      iconType: "kids",
      description: "Fun & Mindfulness for Youth",
    };
  }

  if (combined.includes("lad") || combined.includes("women")) {
    return {
      tone: "ladies",
      label: "Ladies Special",
      badgeColor: "#7d365b",
      bgColor: "#fbf0f5",
      borderColor: "#f3d1e1",
      iconType: "ladies",
      description: "Dedicated Women's Wellness",
    };
  }

  if (combined.includes("morning") || (combined.includes("gents") && combined.includes("7:15"))) {
    return {
      tone: "morning",
      label: "Morning Batch",
      badgeColor: "#3e5c26",
      bgColor: "#f2f7ec",
      borderColor: "#d1e6c3",
      iconType: "sun",
      description: "Gents & Ladies Energizing Flow",
    };
  }

  if (combined.includes("evening") || (combined.includes("gents") && combined.includes("7:00"))) {
    return {
      tone: "evening",
      label: "Evening Batch",
      badgeColor: "#384a6b",
      bgColor: "#f0f4fa",
      borderColor: "#d0dcef",
      iconType: "moon",
      description: "Mon, Wed & Fri Vinyasa",
    };
  }

  return {
    tone: "general",
    label: categoryTag || "Yoga Batch",
    badgeColor: "#4a5d23",
    bgColor: "#f6f8f2",
    borderColor: "#dbe5ce",
    iconType: "lotus",
    description: "General Group Session",
  };
}

/**
 * Returns time of day slot ("Morning", "Afternoon", "Evening") based on startTime.
 */
export function getTimeOfDaySlot(startTime) {
  if (!startTime) return "All";
  const hours = parseInt(startTime.split(":")[0], 10);
  if (isNaN(hours)) return "All";
  if (hours < 12) return "Morning";
  if (hours < 17) return "Afternoon";
  return "Evening";
}

/**
 * Formats a clean select label for client batch assignment dropdowns.
 */
export function getBatchSelectLabel(batch) {
  if (!batch) return "";
  const timeRange = formatBatchTimeRange(batch.start_time, batch.end_time);
  const days = formatScheduleDays(batch.schedule_days);
  return `${batch.name} · ${timeRange} (${days})`;
}

/**
 * Calculates effective monthly rate given total plan amount and duration in days.
 */
export function calculateEffectiveMonthlyRate(amount, durationDays = 30) {
  if (!amount || !durationDays) return "";
  const months = durationDays / 30;
  const perMonth = Math.round(amount / (months || 1));
  return `₹${perMonth.toLocaleString("en-IN")}/mo`;
}

/**
 * Calculates savings against base ₹1,800/month rate.
 */
export function calculatePlanSavings(amount, durationDays = 30, baseMonthly = 1800) {
  if (!amount || !durationDays || durationDays <= 30) return null;
  const months = Math.round(durationDays / 30);
  const expectedStandardCost = months * baseMonthly;
  const savedAmount = expectedStandardCost - amount;
  if (savedAmount <= 0) return null;
  const pct = Math.round((savedAmount / expectedStandardCost) * 100);
  return {
    savedAmount,
    formattedSaved: `Save ₹${savedAmount.toLocaleString("en-IN")}`,
    percentage: pct,
    formattedPct: `${pct}% OFF`,
  };
}

/**
 * Returns badge and tag information for a membership plan.
 */
export function getPlanBadgeInfo(plan = {}) {
  const duration = Number(plan.duration_days || 30);
  if (duration >= 360) {
    return {
      tag: "Best Value",
      badgeText: "44% OFF · Best Value",
      tone: "best-value",
      color: "#166487",
      bgColor: "#edf7fc",
      borderColor: "#bfe3f3",
      popular: false,
      bestValue: true,
    };
  }
  if (duration >= 170) {
    return {
      tag: "High Savings",
      badgeText: "28% OFF · 6 Months",
      tone: "high-savings",
      color: "#7f2b5a",
      bgColor: "#fdf0f6",
      borderColor: "#f6ccdf",
      popular: false,
      bestValue: false,
    };
  }
  if (duration >= 80) {
    return {
      tag: "Most Popular",
      badgeText: "17% OFF · Most Popular",
      tone: "popular",
      color: "#a44f12",
      bgColor: "#fdf5ec",
      borderColor: "#f9dab7",
      popular: true,
      bestValue: false,
    };
  }
  return {
    tag: "Flexible",
    badgeText: "Monthly Pass",
    tone: "flexible",
    color: "#355320",
    bgColor: "#f0f7ea",
    borderColor: "#cde4bd",
    popular: false,
    bestValue: false,
  };
}
