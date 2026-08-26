import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import {
  Baby,
  CalendarDays,
  Clock,
  Download,
  Heart,
  Moon,
  Plus,
  Smile,
  Sparkles,
  Sun,
  Users,
  WalletCards,
} from "../icons";
import { downloadBatchRosterPdf, downloadAllClientsPdf } from "../lib/pdfGenerator";
import {
  calculateDuration,
  calculateEffectiveMonthlyRate,
  calculatePlanSavings,
  formatBatchTimeRange,
  formatScheduleDays,
  getCategoryStyle,
  getPlanBadgeInfo,
} from "../lib/batchUtils";

const PRESET_BATCHES = [
  {
    name: "Morning (Gents & Ladies)",
    categoryTag: "Morning Batch",
    instructorName: "Ananya Sharma",
    scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
    startTime: "07:15",
    endTime: "08:15",
    capacity: "20",
    description: "Energizing morning yoga flow for gents and ladies.",
  },
  {
    name: "Ladies Batch (Morning)",
    categoryTag: "Ladies Special",
    instructorName: "Pooja Deshmukh",
    scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
    startTime: "09:00",
    endTime: "10:00",
    capacity: "18",
    description: "Dedicated morning session focused on women's flexibility and health.",
  },
  {
    name: "Pregnancy Yoga",
    categoryTag: "Prenatal Yoga",
    instructorName: "Dr. Neha Kulkarni",
    scheduleDays: "Tue, Thu, Sat",
    startTime: "16:15",
    endTime: "17:00",
    capacity: "12",
    description: "Specialized prenatal yoga session for expectant mothers.",
  },
  {
    name: "Kids Yoga",
    categoryTag: "Kids Yoga",
    instructorName: "Snehal Patil",
    scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
    startTime: "17:00",
    endTime: "18:00",
    capacity: "15",
    description: "Fun yoga postures, balance games, and mindfulness for children.",
  },
  {
    name: "Ladies Batch (Evening)",
    categoryTag: "Ladies Special",
    instructorName: "Pooja Deshmukh",
    scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
    startTime: "18:00",
    endTime: "19:00",
    capacity: "18",
    description: "Evening relaxation, stress relief, and asanas exclusively for women.",
  },
  {
    name: "Gents & Ladies (Evening)",
    categoryTag: "Evening Batch",
    instructorName: "Rahul Verma",
    scheduleDays: "Mon, Wed, Fri",
    startTime: "19:00",
    endTime: "20:00",
    capacity: "20",
    description: "Dynamic evening Vinyasa and Hatha session for gents and ladies.",
  },
];

const PRESET_PLANS = [
  {
    name: "1 Month Plan",
    planType: "monthly",
    amount: "1800",
    durationDays: "30",
    description: "Standard 1-month flexible studio pass for all scheduled batches.",
  },
  {
    name: "3 Months Plan",
    planType: "quarterly",
    amount: "4500",
    durationDays: "90",
    description: "Quarterly pass with ₹1,500/month effective rate (Save ₹900 · 17% OFF).",
  },
  {
    name: "6 Months Plan",
    planType: "half_yearly",
    amount: "7800",
    durationDays: "180",
    description: "6 months pass with ₹1,300/month effective rate (Save ₹3,000 · 28% OFF).",
  },
  {
    name: "1 Year Plan",
    planType: "annual",
    amount: "12000",
    durationDays: "365",
    description: "Full 12 months annual pass with ₹1,000/month best value rate (Save ₹9,600 · 44% OFF).",
  },
];

const ALL_WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [clients, setClients] = useState([]);
  const [notice, setNotice] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingBatch, setEditingBatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const [planForm, setPlanForm] = useState({
    name: "",
    planType: "monthly",
    amount: "1800",
    durationDays: "30",
    description: "",
  });

  const [batchForm, setBatchForm] = useState({
    name: "",
    categoryTag: "Morning Batch",
    instructorName: "",
    scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
    startTime: "07:15",
    endTime: "08:15",
    capacity: "20",
    description: "",
  });

  const load = async () => {
    try {
      const [batchResponse, planResponse, clientsResponse] = await Promise.all([
        api.get("/api/v1/admin/batches"),
        api.get("/api/v1/admin/plans"),
        api.get("/api/v1/admin/clients").catch(() => ({ data: [] })),
      ]);
      setBatches(batchResponse.data);
      setPlans(planResponse.data);
      setClients(clientsResponse.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setPlanForm({
      name: "",
      planType: "monthly",
      amount: "1800",
      durationDays: "30",
      description: "",
    });
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || "",
      planType: plan.plan_type || "monthly",
      amount: String(plan.amount || ""),
      durationDays: String(plan.duration_days || "30"),
      description: plan.description || "",
    });
    setIsPlanModalOpen(true);
  };

  const applyPlanPreset = (preset) => {
    setPlanForm({
      name: preset.name,
      planType: preset.planType,
      amount: preset.amount,
      durationDays: preset.durationDays,
      description: preset.description,
    });
  };

  const handleSavePlan = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: planForm.name,
        amount: Number(planForm.amount),
        plan_type: planForm.planType,
        duration_days: Number(planForm.durationDays),
        description: planForm.description || "",
        is_active: true,
      };

      if (editingPlan) {
        await api.patch(`/api/v1/admin/plans/${editingPlan.id}`, payload);
        setNotice("Membership plan updated successfully.");
      } else {
        await api.post("/api/v1/admin/plans", payload);
        setNotice("Membership plan created successfully.");
      }

      setIsPlanModalOpen(false);
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to delete this membership plan?")) return;
    try {
      await api.delete(`/api/v1/admin/plans/${planId}`);
      setNotice("Plan deleted.");
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  const openCreateBatchModal = () => {
    setEditingBatch(null);
    setBatchForm({
      name: "",
      categoryTag: "Morning Batch",
      instructorName: "",
      scheduleDays: "Mon, Tue, Wed, Thu, Fri, Sat",
      startTime: "07:15",
      endTime: "08:15",
      capacity: "20",
      description: "",
    });
    setIsBatchModalOpen(true);
  };

  const openEditBatchModal = (batch) => {
    setEditingBatch(batch);
    setBatchForm({
      name: batch.name || "",
      categoryTag: batch.category_tag || "Morning Batch",
      instructorName: batch.instructor_name || "",
      scheduleDays: Array.isArray(batch.schedule_days)
        ? batch.schedule_days.join(", ")
        : (batch.schedule_days || "Mon, Tue, Wed, Thu, Fri, Sat"),
      startTime: batch.start_time || "07:15",
      endTime: batch.end_time || "08:15",
      capacity: String(batch.capacity || "20"),
      description: batch.description || "",
    });
    setIsBatchModalOpen(true);
  };

  const applyBatchPreset = (preset) => {
    setBatchForm({
      name: preset.name,
      categoryTag: preset.categoryTag,
      instructorName: preset.instructorName,
      scheduleDays: preset.scheduleDays,
      startTime: preset.startTime,
      endTime: preset.endTime,
      capacity: preset.capacity,
      description: preset.description,
    });
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const days = batchForm.scheduleDays.split(",").map((d) => d.trim()).filter(Boolean);
      const payload = {
        name: batchForm.name,
        category_tag: batchForm.categoryTag,
        description: batchForm.description || "",
        instructor_name: batchForm.instructorName,
        schedule_days: days.length ? days : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
        start_time: batchForm.startTime,
        end_time: batchForm.endTime,
        capacity: Number(batchForm.capacity),
        is_active: true,
      };

      if (editingBatch) {
        await api.patch(`/api/v1/admin/batches/${editingBatch.id}`, payload);
        setNotice("Batch updated successfully.");
      } else {
        await api.post("/api/v1/admin/batches", payload);
        setNotice("Batch created successfully.");
      }

      setIsBatchModalOpen(false);
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;
    try {
      await api.delete(`/api/v1/admin/batches/${batchId}`);
      setNotice("Batch deleted.");
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // Filter batches
  const filteredBatches = batches.filter((batch) => {
    if (activeFilter === "all") return true;
    const name = (batch.name || "").toLowerCase();
    const cat = (batch.category_tag || "").toLowerCase();
    const startHour = parseInt(batch.start_time?.split(":")[0] || "0", 10);

    if (activeFilter === "morning") {
      return startHour < 12 || name.includes("morning");
    }
    if (activeFilter === "evening") {
      return startHour >= 17 || name.includes("evening");
    }
    if (activeFilter === "special") {
      return name.includes("pregnancy") || name.includes("kid") || cat.includes("prenatal") || cat.includes("kid");
    }
    if (activeFilter === "ladies") {
      return name.includes("lad") || cat.includes("lad");
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState("all"); // "all", "batches", "plans"

  return (
    <section data-testid="batches-page">
      <PageHeader
        eyebrow="Studio operations"
        title="Batches & plans"
        description="Manage class schedules, instructor assignments, capacities, pricing tiers, and printable attendance rosters."
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="secondary-button"
              data-testid="export-all-batches-pdf"
              onClick={() => downloadAllClientsPdf(clients, batches)}
              title="Download full client directory grouped across all batches"
            >
              <Download size={16} /> Export Master PDF
            </button>
            <button className="secondary-button" onClick={openCreateBatchModal}>
              <Plus size={17} /> Add batch
            </button>
            <button className="primary-button" data-testid="add-plan-button" onClick={openCreatePlanModal}>
              <Plus size={17} /> Add plan
            </button>
          </div>
        }
      />

      {notice && <p className="inline-notice" data-testid="batches-notice">{notice}</p>}

      {/* Top View Mode Switcher Tabs */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: "14px", marginBottom: "22px" }}>
        <button
          type="button"
          className={`batch-filter-btn ${activeTab === "all" ? "active" : ""}`}
          style={{ fontSize: "13px", padding: "8px 16px" }}
          onClick={() => setActiveTab("all")}
        >
          <CalendarDays size={16} /> Overview (All)
        </button>
        <button
          type="button"
          className={`batch-filter-btn ${activeTab === "batches" ? "active" : ""}`}
          style={{ fontSize: "13px", padding: "8px 16px" }}
          onClick={() => setActiveTab("batches")}
        >
          <Users size={16} /> Class Batches ({batches.length})
        </button>
        <button
          type="button"
          className={`batch-filter-btn ${activeTab === "plans" ? "active" : ""}`}
          style={{
            fontSize: "13px",
            padding: "8px 16px",
            backgroundColor: activeTab === "plans" ? "var(--sage)" : "#f6fbf4",
            borderColor: "var(--sage)",
            color: activeTab === "plans" ? "#fff" : "var(--sage)",
            fontWeight: "700",
          }}
          onClick={() => setActiveTab("plans")}
        >
          <WalletCards size={16} /> 💳 Membership Plans & Pricing ({plans.length})
        </button>
      </div>

      {/* Class Batches Section */}
      {(activeTab === "all" || activeTab === "batches") && (
        <div style={{ marginBottom: "35px" }}>
          {/* Category Filter Tabs */}
          <div className="batch-filters-bar">
            <button
              type="button"
              className={`batch-filter-btn ${activeFilter === "all" ? "active" : ""}`}
              onClick={() => setActiveFilter("all")}
            >
              <CalendarDays size={14} /> All Batches ({batches.length})
            </button>
            <button
              type="button"
              className={`batch-filter-btn ${activeFilter === "morning" ? "active" : ""}`}
              onClick={() => setActiveFilter("morning")}
            >
              <Sun size={14} /> Morning Batches
            </button>
            <button
              type="button"
              className={`batch-filter-btn ${activeFilter === "evening" ? "active" : ""}`}
              onClick={() => setActiveFilter("evening")}
            >
              <Moon size={14} /> Evening Batches
            </button>
            <button
              type="button"
              className={`batch-filter-btn ${activeFilter === "ladies" ? "active" : ""}`}
              onClick={() => setActiveFilter("ladies")}
            >
              <Heart size={14} /> Ladies Batches
            </button>
            <button
              type="button"
              className={`batch-filter-btn ${activeFilter === "special" ? "active" : ""}`}
              onClick={() => setActiveFilter("special")}
            >
              <Sparkles size={14} /> Pregnancy & Kids
            </button>
          </div>

          <div className="section-heading">
            <CalendarDays size={19} />
            <h2>Active batches ({filteredBatches.length})</h2>
          </div>

      <div className="batch-grid">
        {filteredBatches.map((batch) => {
          const batchClients = clients.filter(
            (c) => c.batch_id === batch.id || c.batch_name === batch.name
          );
          const style = getCategoryStyle(batch.category_tag, batch.name);
          const timeRange = formatBatchTimeRange(batch.start_time, batch.end_time);
          const duration = calculateDuration(batch.start_time, batch.end_time);
          const daysSummary = formatScheduleDays(batch.schedule_days);
          const capacity = batch.capacity || 20;
          const enrolledCount = batchClients.length;
          const pct = Math.min(Math.round((enrolledCount / capacity) * 100), 100);
          const spotsLeft = Math.max(capacity - enrolledCount, 0);
          const Icon = getBatchIcon(batch);

          const daysArr = Array.isArray(batch.schedule_days)
            ? batch.schedule_days.map((d) => d.slice(0, 3))
            : (batch.schedule_days || "").split(",").map((d) => d.trim().slice(0, 3));

          return (
            <article
              className="batch-card"
              key={batch.id}
              data-testid={`batch-card-${batch.id}`}
              style={{ borderTop: `4px solid ${style.badgeColor}` }}
            >
              {/* Header: Category tag and Action buttons */}
              <div className="batch-header">
                <span className={`batch-category-badge ${style.tone}`}>
                  <Icon size={12} />
                  {batch.category_tag || style.label}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="table-action"
                    style={{ padding: "4px 8px", fontSize: "11px" }}
                    onClick={() => openEditBatchModal(batch)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="table-action"
                    style={{ padding: "4px 8px", fontSize: "11px", color: "#ac4932" }}
                    onClick={() => handleDeleteBatch(batch.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Title & Instructor */}
              <h3 className="batch-title">{batch.name}</h3>
              <div className="batch-instructor">
                <Users size={14} style={{ color: "var(--muted)" }} />
                <span>Instructor: <strong className="batch-instructor-name">{batch.instructor_name || "Assigned Trainer"}</strong></span>
              </div>

              {/* Formatted Timing Box */}
              <div className="batch-time-box">
                <div className="batch-time-main">
                  <Clock size={16} />
                  <strong>{timeRange}</strong>
                </div>
                {duration && <span className="batch-duration-badge">{duration}</span>}
              </div>

              {/* Days Schedule with Day Chips */}
              <div className="batch-days-wrap">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="batch-days-label">Schedule Days</span>
                  <span className="batch-days-summary">{daysSummary}</span>
                </div>
                <div className="day-chips-row">
                  {ALL_WEEK_DAYS.map((day) => {
                    const isActive = daysArr.includes(day);
                    return (
                      <span
                        key={day}
                        className={`day-chip ${isActive ? "active" : ""}`}
                        style={isActive ? { backgroundColor: style.badgeColor } : {}}
                      >
                        {day}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Description if present */}
              {batch.description && (
                <p style={{ color: "var(--muted)", fontSize: "12px", lineHeight: "1.5", margin: "8px 0" }}>
                  {batch.description}
                </p>
              )}

              {/* Capacity Progress Meter */}
              <div className="batch-capacity-wrap">
                <div className="batch-capacity-info">
                  <strong>{enrolledCount} / {capacity} Enrolled</strong>
                  <span>{spotsLeft > 0 ? `${spotsLeft} spots available` : "Full capacity"}</span>
                </div>
                <div className="capacity-progress-track">
                  <div
                    className={`capacity-progress-fill ${spotsLeft === 0 ? "full" : ""}`}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: spotsLeft === 0 ? "#ba5137" : style.badgeColor,
                    }}
                  />
                </div>
              </div>

              {/* PDF Roster Button */}
              <button
                type="button"
                className="secondary-button"
                data-testid={`download-batch-pdf-${batch.id}`}
                style={{
                  marginTop: "8px",
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: "12px",
                  gap: "7px",
                  display: "flex",
                  justifyContent: "center",
                  borderColor: style.borderColor,
                  color: style.badgeColor,
                  backgroundColor: style.bgColor,
                  fontWeight: "700",
                }}
                onClick={() => downloadBatchRosterPdf(batch, batchClients)}
                title={`Download ${batch.name} client attendance and roster PDF`}
              >
                <Download size={14} /> Download Batch Attendance PDF
              </button>
            </article>
          );
        })}
        {!filteredBatches.length && (
          <p className="empty-copy">No batches match the selected filter.</p>
        )}
      </div>
    </div>
  )}

      {/* Membership Plans & Pricing Section */}
      {(activeTab === "all" || activeTab === "plans") && (
        <div id="pricing-plans" style={{ marginTop: activeTab === "plans" ? "0" : "40px" }}>
          <div className="section-heading plan-heading" style={{ marginTop: activeTab === "plans" ? "0" : "30px", borderTop: activeTab === "plans" ? "none" : "1px solid var(--line)" }}>
            <WalletCards size={20} />
            <div>
              <h2>Membership Plans & Pricing ({plans.length})</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "2px" }}>
                Official studio membership rates, durations, and practitioner discount passes.
              </p>
            </div>
          </div>

          <div className="pricing-grid">
            {plans.map((plan) => {
              const badgeInfo = getPlanBadgeInfo(plan);
              const savings = calculatePlanSavings(plan.amount, plan.duration_days);
              const monthlyRate = calculateEffectiveMonthlyRate(plan.amount, plan.duration_days);

              return (
                <article
                  className={`pricing-card ${badgeInfo.popular ? "popular" : ""} ${badgeInfo.bestValue ? "best-value" : ""}`}
                  key={plan.id}
                  data-testid={`plan-row-${plan.id}`}
                  style={{ borderTop: `4px solid ${badgeInfo.color}` }}
                >
                  <div>
                    <div className="pricing-top-row">
                      <span className={`plan-duration-badge ${badgeInfo.tone}`}>
                        {plan.duration_days ? `${plan.duration_days} Days` : "Pass"}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "700",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          backgroundColor: badgeInfo.bgColor,
                          color: badgeInfo.color,
                          textTransform: "uppercase",
                        }}
                      >
                        {badgeInfo.tag}
                      </span>
                    </div>

                    <h3 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "8px" }}>
                      {plan.name}
                    </h3>

                    <div className="pricing-amount-box">
                      <div className="pricing-amount">
                        ₹{Number(plan.amount || 0).toLocaleString("en-IN")}
                      </div>
                      <div className="pricing-effective-rate">
                        {monthlyRate} effective
                      </div>
                    </div>

                    {savings && (
                      <div className="savings-chip">
                        <span>✨ {savings.formattedSaved} ({savings.formattedPct})</span>
                      </div>
                    )}

                    <p className="pricing-description">
                      {plan.description || "Studio group access pass."}
                    </p>
                  </div>

                  <div className="pricing-card-actions">
                    <button
                      type="button"
                      className="table-action"
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() => openEditPlanModal(plan)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="table-action"
                      style={{ padding: "5px 10px", fontSize: "12px", color: "#ac4932" }}
                      onClick={() => handleDeletePlan(plan.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
            {!plans.length && (
              <p className="empty-copy" style={{ padding: "20px" }}>
                No membership plans created yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plan Modal with Quick Presets */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={editingPlan ? "Edit Membership Plan" : "Add Membership Plan"}
        subtitle="Configure pricing tier and duration for your practitioners."
      >
        {/* Quick Studio Plan Presets */}
        {!editingPlan && (
          <div style={{ marginBottom: "16px", padding: "12px", background: "#faf9f5", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
              Quick Fill Studio Plans:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {PRESET_PLANS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPlanPreset(preset)}
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #d4d0c4",
                    background: "white",
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  {preset.name} (₹{preset.amount})
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSavePlan} className="modal-form">
          <div className="modal-field">
            <label>Plan Name *</label>
            <input
              type="text"
              placeholder="e.g. 1 Month Plan / 3 Months Plan"
              value={planForm.name}
              onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Plan Type</label>
            <select
              value={planForm.planType}
              onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
            >
              <option value="monthly">Monthly (30 Days)</option>
              <option value="quarterly">Quarterly (90 Days)</option>
              <option value="half_yearly">Half-Yearly (180 Days)</option>
              <option value="annual">Annual / 1 Year (365 Days)</option>
              <option value="drop_in_pack">Drop-in Pack</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Amount (₹) *</label>
            <input
              type="number"
              placeholder="1800"
              value={planForm.amount}
              onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Duration (Days) *</label>
            <input
              type="number"
              placeholder="30"
              value={planForm.durationDays}
              onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Description / Benefits</label>
            <textarea
              placeholder="e.g. 3 months unlimited access with ₹1,500/month effective rate."
              value={planForm.description}
              onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsPlanModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : editingPlan ? "Update Plan" : "Save Plan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Batch Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={editingBatch ? "Edit Class Batch" : "Add Class Batch"}
        subtitle="Schedule studio batch details and timings."
      >
        {/* Quick Studio Presets */}
        {!editingBatch && (
          <div style={{ marginBottom: "16px", padding: "12px", background: "#faf9f5", borderRadius: "8px", border: "1px solid var(--line)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
              Quick Fill Studio Batches:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {PRESET_BATCHES.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyBatchPreset(preset)}
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid #d4d0c4",
                    background: "white",
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSaveBatch} className="modal-form">
          <div className="modal-field">
            <label>Batch Name *</label>
            <input
              type="text"
              placeholder="e.g. Morning (Gents & Ladies)"
              value={batchForm.name}
              onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Category Tag</label>
            <select
              value={batchForm.categoryTag}
              onChange={(e) => setBatchForm({ ...batchForm, categoryTag: e.target.value })}
            >
              <option value="Morning Batch">Morning Batch</option>
              <option value="Ladies Special">Ladies Special</option>
              <option value="Prenatal Yoga">Prenatal Yoga (Pregnancy)</option>
              <option value="Kids Yoga">Kids Yoga</option>
              <option value="Evening Batch">Evening Batch</option>
              <option value="General Yoga">General Yoga</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Instructor Name *</label>
            <input
              type="text"
              placeholder="e.g. Ananya Sharma / Pooja Deshmukh"
              value={batchForm.instructorName}
              onChange={(e) => setBatchForm({ ...batchForm, instructorName: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Schedule Days (comma-separated)</label>
            <input
              type="text"
              placeholder="Mon, Tue, Wed, Thu, Fri, Sat"
              value={batchForm.scheduleDays}
              onChange={(e) => setBatchForm({ ...batchForm, scheduleDays: e.target.value })}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>
              e.g. &quot;Mon, Tue, Wed, Thu, Fri, Sat&quot; or &quot;Tue, Thu, Sat&quot; or &quot;Mon, Wed, Fri&quot;
            </small>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Start Time (24h HH:MM)</label>
              <input
                type="text"
                placeholder="07:15"
                value={batchForm.startTime}
                onChange={(e) => setBatchForm({ ...batchForm, startTime: e.target.value })}
                required
              />
            </div>
            <div className="modal-field">
              <label>End Time (24h HH:MM)</label>
              <input
                type="text"
                placeholder="08:15"
                value={batchForm.endTime}
                onChange={(e) => setBatchForm({ ...batchForm, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Capacity (Max Practitioners)</label>
            <input
              type="number"
              placeholder="20"
              value={batchForm.capacity}
              onChange={(e) => setBatchForm({ ...batchForm, capacity: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Description / Notes</label>
            <textarea
              placeholder="Brief description of the batch focus..."
              value={batchForm.description}
              onChange={(e) => setBatchForm({ ...batchForm, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsBatchModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : editingBatch ? "Update Batch" : "Save Batch"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}