import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { CalendarDays, Plus, WalletCards } from "../icons";

export default function BatchesPage() {
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [notice, setNotice] = useState("");
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingBatch, setEditingBatch] = useState(null);
  const [busy, setBusy] = useState(false);

  const [planForm, setPlanForm] = useState({
    name: "",
    planType: "monthly",
    amount: "",
    durationDays: "30",
  });

  const [batchForm, setBatchForm] = useState({
    name: "",
    categoryTag: "Mat Yoga",
    instructorName: "",
    scheduleDays: "Mon, Wed, Fri",
    startTime: "07:30",
    endTime: "08:30",
    capacity: "15",
  });

  const load = async () => {
    try {
      const [batchResponse, planResponse] = await Promise.all([
        api.get("/api/v1/admin/batches"),
        api.get("/api/v1/admin/plans"),
      ]);
      setBatches(batchResponse.data);
      setPlans(planResponse.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openCreatePlanModal = () => {
    setEditingPlan(null);
    setPlanForm({ name: "", planType: "monthly", amount: "", durationDays: "30" });
    setIsPlanModalOpen(true);
  };

  const openEditPlanModal = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name || "",
      planType: plan.plan_type || "monthly",
      amount: String(plan.amount || ""),
      durationDays: String(plan.duration_days || "30"),
    });
    setIsPlanModalOpen(true);
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
        is_active: true,
      };

      if (editingPlan) {
        await api.patch(`/api/v1/admin/plans/${editingPlan.id}`, payload);
        setNotice("Plan updated successfully.");
      } else {
        await api.post("/api/v1/admin/plans", payload);
        setNotice("Plan created successfully.");
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
    setBatchForm({ name: "", categoryTag: "Mat Yoga", instructorName: "", scheduleDays: "Mon, Wed, Fri", startTime: "07:30", endTime: "08:30", capacity: "15" });
    setIsBatchModalOpen(true);
  };

  const openEditBatchModal = (batch) => {
    setEditingBatch(batch);
    setBatchForm({
      name: batch.name || "",
      categoryTag: batch.category_tag || "Mat Yoga",
      instructorName: batch.instructor_name || "",
      scheduleDays: Array.isArray(batch.schedule_days) ? batch.schedule_days.join(", ") : (batch.schedule_days || "Mon, Wed, Fri"),
      startTime: batch.start_time || "07:30",
      endTime: batch.end_time || "08:30",
      capacity: String(batch.capacity || "15"),
    });
    setIsBatchModalOpen(true);
  };

  const handleSaveBatch = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const days = batchForm.scheduleDays.split(",").map(d => d.trim()).filter(Boolean);
      const payload = {
        name: batchForm.name,
        category_tag: batchForm.categoryTag,
        instructor_name: batchForm.instructorName,
        schedule_days: days.length ? days : ["Mon", "Wed", "Fri"],
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

  return (
    <section data-testid="batches-page">
      <PageHeader
        eyebrow="Studio operations"
        title="Batches & plans"
        description="Keep class schedules and pricing self-serviceable."
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="secondary-button" onClick={openCreateBatchModal}>
              <Plus size={17} />Add batch
            </button>
            <button className="primary-button" data-testid="add-plan-button" onClick={openCreatePlanModal}>
              <Plus size={17} />Add plan
            </button>
          </div>
        }
      />
      {notice && <p className="inline-notice" data-testid="batches-notice">{notice}</p>}
      
      <div className="section-heading">
        <CalendarDays size={19} />
        <h2>Active batches</h2>
      </div>
      <div className="batch-grid">
        {batches.map((batch) => (
          <article className="batch-card" key={batch.id} data-testid={`batch-card-${batch.id}`}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="tag">{batch.category_tag}</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  className="table-action"
                  style={{ padding: "3px 6px", fontSize: "10px" }}
                  onClick={() => openEditBatchModal(batch)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="table-action"
                  style={{ padding: "3px 6px", fontSize: "10px", color: "#ac4932" }}
                  onClick={() => handleDeleteBatch(batch.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <h3>{batch.name}</h3>
            <p>{batch.instructor_name} · {Array.isArray(batch.schedule_days) ? batch.schedule_days.join(" · ") : batch.schedule_days}</p>
            <strong>{batch.start_time}—{batch.end_time}</strong>
            <small>{batch.capacity} places · {batch.is_active ? "Active" : "Paused"}</small>
          </article>
        ))}
        {!batches.length && <p className="empty-copy">No batches registered yet.</p>}
      </div>

      <div className="section-heading plan-heading">
        <WalletCards size={19} />
        <h2>Membership plans</h2>
      </div>
      <div className="plan-list">
        {plans.map((plan) => (
          <div className="plan-row" key={plan.id} data-testid={`plan-row-${plan.id}`}>
            <div>
              <strong>{plan.name}</strong>
              <small>{plan.plan_type?.replaceAll("_", " ")} · {plan.duration_days} days</small>
            </div>
            <b>₹{plan.amount?.toLocaleString("en-IN")}</b>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                className="table-action"
                style={{ padding: "4px 8px", fontSize: "11px" }}
                onClick={() => openEditPlanModal(plan)}
              >
                Edit
              </button>
              <button
                type="button"
                className="table-action"
                style={{ padding: "4px 8px", fontSize: "11px", color: "#ac4932" }}
                onClick={() => handleDeletePlan(plan.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {!plans.length && <p className="empty-copy" style={{ padding: "20px" }}>No membership plans created yet.</p>}
      </div>

      {/* Plan Modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={editingPlan ? "Edit Membership Plan" : "Add Membership Plan"}
        subtitle="Configure pricing tier for your practitioners."
      >
        <form onSubmit={handleSavePlan} className="modal-form">
          <div className="modal-field">
            <label>Plan Name *</label>
            <input
              type="text"
              placeholder="e.g. Monthly Unlimited"
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
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="per_session">Per Session</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Amount (₹) *</label>
            <input
              type="number"
              placeholder="2500"
              value={planForm.amount}
              onChange={(e) => setPlanForm({ ...planForm, amount: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Duration (Days)</label>
            <input
              type="number"
              placeholder="30"
              value={planForm.durationDays}
              onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsPlanModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : (editingPlan ? "Update Plan" : "Save Plan")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Batch Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={editingBatch ? "Edit Class Batch" : "Add Class Batch"}
        subtitle="Schedule studio batch details."
      >
        <form onSubmit={handleSaveBatch} className="modal-form">
          <div className="modal-field">
            <label>Batch Name *</label>
            <input
              type="text"
              placeholder="e.g. Morning Flow"
              value={batchForm.name}
              onChange={(e) => setBatchForm({ ...batchForm, name: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Category Tag</label>
            <input
              type="text"
              placeholder="e.g. Mat Yoga / Aerial Yoga / Hatha"
              value={batchForm.categoryTag}
              onChange={(e) => setBatchForm({ ...batchForm, categoryTag: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Instructor Name *</label>
            <input
              type="text"
              placeholder="e.g. Varsha Kakade"
              value={batchForm.instructorName}
              onChange={(e) => setBatchForm({ ...batchForm, instructorName: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Schedule Days (comma separated)</label>
            <input
              type="text"
              placeholder="Mon, Wed, Fri"
              value={batchForm.scheduleDays}
              onChange={(e) => setBatchForm({ ...batchForm, scheduleDays: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Start Time</label>
              <input
                type="text"
                placeholder="07:30"
                value={batchForm.startTime}
                onChange={(e) => setBatchForm({ ...batchForm, startTime: e.target.value })}
                required
              />
            </div>
            <div className="modal-field">
              <label>End Time</label>
              <input
                type="text"
                placeholder="08:30"
                value={batchForm.endTime}
                onChange={(e) => setBatchForm({ ...batchForm, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Capacity (Places)</label>
            <input
              type="number"
              placeholder="18"
              value={batchForm.capacity}
              onChange={(e) => setBatchForm({ ...batchForm, capacity: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsBatchModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : (editingBatch ? "Update Batch" : "Save Batch")}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}