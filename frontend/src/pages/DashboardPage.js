import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import api, { formatApiError } from "../lib/api";
import {
  AlertTriangle,
  ArrowUpRight,
  Baby,
  BellRing,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Heart,
  MessageCircle,
  Moon,
  Send,
  Smile,
  Sparkles,
  Sun,
  Users,
  WalletCards,
} from "../icons";
import {
  calculateDuration,
  calculateEffectiveMonthlyRate,
  calculatePlanSavings,
  formatBatchTimeRange,
  formatScheduleDays,
  getCategoryStyle,
  getPlanBadgeInfo,
} from "../lib/batchUtils";
import { updateAppBadge } from "../lib/pushNotifications";
import WhatsAppReminderModal from "../components/WhatsAppReminderModal";

const formatRupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

const getBatchIcon = (batch) => {
  const name = (batch.name || "").toLowerCase();
  const cat = (batch.category_tag || "").toLowerCase();
  if (name.includes("pregnancy") || cat.includes("prenatal")) return Baby;
  if (name.includes("kid") || cat.includes("kid")) return Smile;
  if (name.includes("lad") || cat.includes("lad")) return Heart;
  if (name.includes("morning") || (batch.start_time && parseInt(batch.start_time, 10) < 12)) return Sun;
  if (name.includes("evening") || (batch.start_time && parseInt(batch.start_time, 10) >= 17)) return Moon;
  return Sparkles;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [expiries, setExpiries] = useState({
    expiring_today: [],
    expiring_soon: [],
    expired: [],
    total_attention_count: 0,
  });
  const [expiryTab, setExpiryTab] = useState("all");
  const [whatsappClient, setWhatsappClient] = useState(null);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const loadData = () => {
    Promise.all([
      api.get("/api/v1/admin/dashboard/summary"),
      api.get("/api/v1/admin/payments", { params: { status: "overdue" } }),
      api.get("/api/v1/admin/batches").catch(() => ({ data: [] })),
      api.get("/api/v1/admin/plans").catch(() => ({ data: [] })),
      api.get("/api/v1/admin/clients").catch(() => ({ data: [] })),
      api.get("/api/v1/admin/clients/expiring").catch(() => ({
        data: { expiring_today: [], expiring_soon: [], expired: [], total_attention_count: 0 },
      })),
    ])
      .then(([summaryRes, paymentsRes, batchesRes, plansRes, clientsRes, expiriesRes]) => {
        setSummary(summaryRes.data);
        setPayments(paymentsRes.data.slice(0, 4));
        setBatches(batchesRes.data);
        setPlans(plansRes.data);
        setClients(clientsRes.data);
        setExpiries(expiriesRes.data);
        // Sync app badge on iPhone / Android home screen
        updateAppBadge(expiriesRes.data.total_attention_count || 0);
      })
      .catch((error) => setNotice(formatApiError(error)));
  };

  useEffect(() => {
    loadData();
  }, []);

  const todayFormatted = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const expiringCount = expiries.total_attention_count || summary?.total_expiring_attention || 0;

  const cards = summary
    ? [
        ["Collected this month", formatRupees(summary.total_collected), CircleDollarSign, "sage"],
        ["Total pending", formatRupees(summary.total_pending), WalletCards, "amber"],
        ["Overdue accounts", summary.overdue_count, ArrowUpRight, "coral"],
        ["Expiring plans", expiringCount, BellRing, expiringCount > 0 ? "coral" : "sage"],
        ["Reminders today", summary.reminders_today, MessageCircle, "ink"],
      ]
    : [];


  return (
    <section data-testid="dashboard-page">
      <PageHeader
        eyebrow={todayFormatted}
        title="A clear view of your studio."
        description="Here’s what needs your attention today, your active class schedule, and studio fee structure."
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link to="/batches" className="secondary-button" data-testid="dashboard-batches-link">
              <CalendarDays size={16} />
              View batches & plans
            </Link>
            <Link to="/clients" className="primary-button" data-testid="dashboard-add-client-link">
              <Users size={17} />
              Add client
            </Link>
          </div>
        }
      />

      {notice && <p className="inline-notice" data-testid="dashboard-notice">{notice}</p>}

      {/* Primary Metrics */}
      <div className="metric-grid">
        {cards.map(([label, value, Icon, tone]) => (
          <article className={`metric-card ${tone}`} key={label} data-testid={`metric-${label.toLowerCase().replaceAll(" ", "-")}`}>
            <div>
              <p>{label}</p>
              <strong>{value}</strong>
            </div>
            <span><Icon size={21} /></span>
          </article>
        ))}
      </div>

      {/* 2-Column: Overdue Payments & Studio Pulse */}
      <div className="dashboard-grid">
        <section className="overview-panel" data-testid="payment-attention-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Payment attention</p>
              <h2>Overdue payments</h2>
            </div>
            <Link to="/finances" data-testid="view-all-finances-link">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="mini-table">
            {payments.map((payment) => (
              <div className="mini-row" key={payment.id} data-testid={`overdue-payment-${payment.id}`}>
                <div className="person-dot">{payment.client?.full_name?.[0]}</div>
                <div>
                  <strong>{payment.client?.full_name}</strong>
                  <small>Due {payment.due_date} · {payment.days_overdue} days late</small>
                </div>
                <b>{formatRupees(payment.amount_due - payment.amount_paid)}</b>
                <span className="status-chip overdue">Overdue</span>
              </div>
            ))}
            {!payments.length && <p className="empty-copy" data-testid="no-overdue-payments">Nothing overdue right now.</p>}
          </div>
        </section>

        <aside className="studio-note" data-testid="studio-insight-panel">
          <p className="eyebrow">Studio pulse</p>
          <h2>{summary?.active_clients || 0} active practitioners</h2>
          <p>Your current projected monthly revenue is <strong>{formatRupees(summary?.projected_revenue)}</strong> across {batches.length} scheduled batches.</p>
          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <Link to="/batches" className="text-link" style={{ color: "#ffffff", fontWeight: "700" }}>
              Explore class schedules & rosters <ArrowUpRight size={15} />
            </Link>
            <Link to="/reminders" className="text-link" data-testid="open-reminders-link">
              Review reminder queue <ArrowUpRight size={15} />
            </Link>
          </div>
        </aside>
      </div>

      {/* Plan Expiries & Renewal Radar (iPhone & Android Home Screen Focus) */}
      <section className="overview-panel" style={{ marginTop: "24px", marginBottom: "24px" }} data-testid="plan-expiries-panel">
        <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "3px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", backgroundColor: "#fef3c7", color: "#92400e", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "12px" }}>
                <BellRing size={12} /> Renewal Radar
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted)" }}>Phone Alerts · iOS & Android</span>
            </div>
            <h2 style={{ fontSize: "20px" }}>
              Plan Expiry Attention ({expiringCount})
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <Link to="/reminders" className="text-link" style={{ fontSize: "12px" }}>
              Reminder Queue <ArrowUpRight size={14} />
            </Link>
            <Link to="/settings" className="secondary-button" style={{ fontSize: "11px", padding: "5px 10px" }}>
              🔔 Push Settings
            </Link>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "8px", margin: "12px 0 16px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setExpiryTab("all")}
            className={expiryTab === "all" ? "primary-button" : "secondary-button"}
            style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px" }}
          >
            All Attention ({expiries.total_attention_count})
          </button>
          <button
            type="button"
            onClick={() => setExpiryTab("soon")}
            className={expiryTab === "soon" ? "primary-button" : "secondary-button"}
            style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px" }}
          >
            Expiring in 7 Days ({expiries.expiring_soon.length})
          </button>
          <button
            type="button"
            onClick={() => setExpiryTab("today")}
            className={expiryTab === "today" ? "primary-button" : "secondary-button"}
            style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px" }}
          >
            Due Today ({expiries.expiring_today.length})
          </button>
          <button
            type="button"
            onClick={() => setExpiryTab("expired")}
            className={expiryTab === "expired" ? "primary-button" : "secondary-button"}
            style={{ fontSize: "12px", padding: "5px 12px", borderRadius: "20px" }}
          >
            Recently Expired ({expiries.expired.length})
          </button>
        </div>

        {/* Expiry Cards / List */}
        <div className="mini-table">
          {(expiryTab === "soon"
            ? expiries.expiring_soon
            : expiryTab === "today"
            ? expiries.expiring_today
            : expiryTab === "expired"
            ? expiries.expired
            : [
                ...expiries.expiring_today,
                ...expiries.expiring_soon,
                ...expiries.expired,
              ]
          ).map((item) => {
            const isToday = item.days_diff === 0;
            const isSoon = item.days_diff > 0;
            const statusLabel = isToday
              ? "Expires Today"
              : isSoon
              ? `In ${item.days_diff}d (${item.renewal_date})`
              : `Expired ${Math.abs(item.days_diff)}d ago`;

            const badgeBg = isToday ? "#fee2e2" : isSoon ? "#fef3c7" : "#f3f4f6";
            const badgeColor = isToday ? "#b91c1c" : isSoon ? "#92400e" : "#4b5563";

            return (
              <div
                className="mini-row"
                key={item.id}
                data-testid={`expiring-client-${item.id}`}
                style={{ gridTemplateColumns: "34px minmax(0,1.5fr) auto auto", gap: "10px" }}
              >
                <div className="person-dot">{item.full_name?.[0] || "P"}</div>
                <div>
                  <strong>{item.full_name}</strong>
                  <small>
                    {item.batch_name || "General Batch"} · <b>{item.plan_name || "Membership Plan"}</b>
                  </small>
                </div>
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "3px 8px",
                      borderRadius: "10px",
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      display: "inline-block",
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappClient(item);
                      setIsWhatsappModalOpen(true);
                    }}
                    className="secondary-button"
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      backgroundColor: "#edf7eb",
                      borderColor: "#b9deb0",
                      color: "#275e18",
                      fontWeight: "700",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                      borderRadius: "6px",
                    }}
                    title={`Send 1-click WhatsApp renewal reminder to ${item.full_name}`}
                  >
                    <MessageCircle size={14} /> Send WhatsApp
                  </button>
                </div>
              </div>
            );
          })}
          {!(
            (expiryTab === "soon"
              ? expiries.expiring_soon
              : expiryTab === "today"
              ? expiries.expiring_today
              : expiryTab === "expired"
              ? expiries.expired
              : [
                  ...expiries.expiring_today,
                  ...expiries.expiring_soon,
                  ...expiries.expired,
                ]
            ).length
          ) && (
            <p className="empty-copy" style={{ padding: "20px 0", textAlign: "center" }}>
              ✨ No memberships in this category right now. All practitioners are active!
            </p>
          )}
        </div>
      </section>

      {/* Studio Batches & Daily Schedule Section */}
      <section className="dashboard-schedule-panel" data-testid="dashboard-batches-panel">

        <div className="panel-heading">
          <div>
            <p className="eyebrow" style={{ color: "var(--sage)", fontWeight: "700" }}>Class operations</p>
            <h2 style={{ fontSize: "20px" }}>Studio Batches & Daily Schedule</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
              6 scheduled class batches formatted with timing, days, instructor, and capacity.
            </p>
          </div>
          <Link to="/batches" className="secondary-button" style={{ fontSize: "12px", padding: "7px 12px" }}>
            Manage & Export Rosters <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="schedule-grid-compact">
          {batches.map((batch) => {
            const style = getCategoryStyle(batch.category_tag, batch.name);
            const timeRange = formatBatchTimeRange(batch.start_time, batch.end_time);
            const duration = calculateDuration(batch.start_time, batch.end_time);
            const daysText = formatScheduleDays(batch.schedule_days);
            const enrolled = clients.filter(
              (c) => c.batch_id === batch.id || c.batch_name === batch.name
            ).length;
            const capacity = batch.capacity || 20;
            const pct = Math.min(Math.round((enrolled / capacity) * 100), 100);
            const Icon = getBatchIcon(batch);

            return (
              <article
                className="schedule-mini-card"
                key={batch.id}
                data-testid={`dashboard-batch-${batch.id}`}
                style={{ borderLeft: `4px solid ${style.badgeColor}` }}
              >
                <div className="schedule-mini-top">
                  <span className={`batch-category-badge ${style.tone}`}>
                    <Icon size={12} />
                    {batch.category_tag || style.label}
                  </span>
                  {duration && (
                    <span className="batch-duration-badge">{duration}</span>
                  )}
                </div>

                <div>
                  <h3 className="schedule-mini-title">{batch.name}</h3>
                  <div className="schedule-mini-time" style={{ marginTop: "6px" }}>
                    <Clock size={14} style={{ color: "var(--sage)" }} />
                    <span>{timeRange}</span>
                  </div>
                </div>

                <div className="schedule-mini-meta">
                  <span style={{ fontWeight: "600", color: "#454440" }}>
                    {daysText}
                  </span>
                  <span>{batch.instructor_name || "Instructor"}</span>
                </div>

                {/* Capacity meter */}
                <div style={{ marginTop: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--muted)", marginBottom: "4px" }}>
                    <span>{enrolled} enrolled</span>
                    <span>{capacity} capacity</span>
                  </div>
                  <div className="capacity-progress-track" style={{ height: "4px" }}>
                    <div
                      className="capacity-progress-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: style.badgeColor,
                      }}
                    />
                  </div>
                </div>
              </article>
            );
          })}
          {!batches.length && (
            <p className="empty-copy">No batches loaded. Please refresh or check batch settings.</p>
          )}
        </div>
      </section>

      {/* Studio Fee Structure & Membership Pricing Section */}
      <section className="dashboard-fees-panel" data-testid="dashboard-fees-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow" style={{ color: "var(--sage)", fontWeight: "700" }}>Pricing & Memberships</p>
            <h2 style={{ fontSize: "20px" }}>Studio Fee Structure & Plans</h2>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
              Standard practitioner membership tiers (1 Month, 3 Months, 6 Months, 1 Year).
            </p>
          </div>
          <Link to="/batches" className="secondary-button" style={{ fontSize: "12px", padding: "7px 12px" }}>
            Configure Pricing <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="fees-grid-compact">
          {plans.map((plan) => {
            const badgeInfo = getPlanBadgeInfo(plan);
            const savings = calculatePlanSavings(plan.amount, plan.duration_days);
            const monthlyRate = calculateEffectiveMonthlyRate(plan.amount, plan.duration_days);

            return (
              <article
                className={`fee-mini-card ${badgeInfo.popular ? "popular" : ""} ${badgeInfo.bestValue ? "best-value" : ""}`}
                key={plan.id}
                data-testid={`dashboard-plan-${plan.id}`}
                style={{ borderTop: `3px solid ${badgeInfo.color}` }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "3px 7px",
                        borderRadius: "4px",
                        backgroundColor: badgeInfo.bgColor,
                        color: badgeInfo.color,
                        textTransform: "uppercase",
                      }}
                    >
                      {plan.duration_days ? `${plan.duration_days} Days` : "Pass"}
                    </span>
                    {savings && (
                      <span className="savings-chip" style={{ fontSize: "10px", padding: "2px 6px", margin: 0 }}>
                        {savings.formattedPct}
                      </span>
                    )}
                  </div>
                  <h3 className="fee-mini-title">{plan.name}</h3>
                  <div className="fee-mini-price">
                    ₹{Number(plan.amount || 0).toLocaleString("en-IN")}
                  </div>
                  <div className="fee-mini-effective">
                    {monthlyRate} effective rate
                  </div>
                </div>

                {plan.description && (
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "10px", marginBottom: 0, lineHeight: 1.4 }}>
                    {plan.description}
                  </p>
                )}
              </article>
            );
          })}
          {!plans.length && (
            <p className="empty-copy">No membership plans loaded.</p>
          )}
        </div>
      </section>

      {/* 1-Click WhatsApp Reminder Modal for Expiring Client */}
      {isWhatsappModalOpen && (
        <WhatsAppReminderModal
          isOpen={isWhatsappModalOpen}
          onClose={() => {
            setIsWhatsappModalOpen(false);
            setWhatsappClient(null);
          }}
          client={whatsappClient}
          onSuccess={() => {
            loadData();
          }}
        />
      )}
    </section>
  );
}