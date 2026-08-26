import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { AlertCircle, Download, MessageCircle, Plus, Search, Sparkles, Users, WalletCards } from "../icons";
import { downloadAllClientsPdf } from "../lib/pdfGenerator";
import { formatBatchTimeRange, formatScheduleDays } from "../lib/batchUtils";
import WhatsAppReminderModal from "../components/WhatsAppReminderModal";

const formatRupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedBatchFilter, setSelectedBatchFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [whatsappClient, setWhatsappClient] = useState(null);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "+91",
    email: "",
    status: "active",
    batchId: "",
    planId: "",
    joinDate: new Date().toISOString().slice(0, 10),
    initialPaymentStatus: "paid",
    initialAmountPaid: "",
    paymentMethod: "UPI",
    whatsappOptIn: true,
    notes: "",
  });

  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [clientsRes, batchesRes, plansRes] = await Promise.all([
        api.get("/api/v1/admin/clients", { params: { search } }),
        api.get("/api/v1/admin/batches").catch(() => ({ data: [] })),
        api.get("/api/v1/admin/plans").catch(() => ({ data: [] })),
      ]);
      setClients(clientsRes.data || []);
      setBatches(batchesRes.data || []);
      setPlans(plansRes.data || []);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute calculated amounts for modal live preview
  const selectedPlan = plans.find((p) => p.id === formData.planId) || plans[0];
  const calculatedFee = selectedPlan ? selectedPlan.amount : 0;
  const calculatedDuration = selectedPlan ? (selectedPlan.duration_days || 30) : 30;

  const calculateRenewalDate = () => {
    if (!formData.joinDate) return "";
    try {
      const d = new Date(formData.joinDate);
      d.setDate(d.getDate() + calculatedDuration);
      return d.toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };

  const nextRenewalFormatted = calculateRenewalDate();

  const openCreateModal = () => {
    setEditingClient(null);
    setModalError("");
    const defaultBatch = batches.length ? batches[0].id : "";
    const defaultPlan = plans.length ? plans[0].id : "";
    setFormData({
      fullName: "",
      phoneNumber: "+91",
      email: "",
      status: "active",
      batchId: defaultBatch,
      planId: defaultPlan,
      joinDate: new Date().toISOString().slice(0, 10),
      initialPaymentStatus: "paid",
      initialAmountPaid: "",
      paymentMethod: "UPI",
      whatsappOptIn: true,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setModalError("");
    setFormData({
      fullName: client.full_name || "",
      phoneNumber: client.phone_number || "+91",
      email: client.email || "",
      status: client.status || "active",
      batchId: client.batch_id || (batches.length ? batches[0].id : ""),
      planId: client.plan_id || (plans.length ? plans[0].id : ""),
      joinDate: client.join_date || new Date().toISOString().slice(0, 10),
      initialPaymentStatus: "paid",
      initialAmountPaid: "",
      paymentMethod: "UPI",
      whatsappOptIn: client.whatsapp_opt_in ?? true,
      notes: client.notes || "",
    });
    setIsModalOpen(true);
  };

  const handlePlanChange = (planId) => {
    setFormData((prev) => ({
      ...prev,
      planId,
      initialAmountPaid: "",
    }));
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    setModalError("");

    if (!formData.fullName || formData.fullName.trim().length < 2) {
      setModalError("Please enter practitioner full name (at least 2 characters).");
      return;
    }

    let cleanPhone = (formData.phoneNumber || "").replace(/[\s\-()]/g, "");
    if (!cleanPhone || cleanPhone === "+91" || cleanPhone === "+") {
      setModalError("Please enter a valid WhatsApp phone number.");
      return;
    }
    if (cleanPhone.startsWith("0") && cleanPhone.length === 11) {
      cleanPhone = "+91" + cleanPhone.slice(1);
    } else if (cleanPhone.length === 10 && !cleanPhone.startsWith("+")) {
      cleanPhone = "+91" + cleanPhone;
    } else if (!cleanPhone.startsWith("+") && /^\d+$/.test(cleanPhone)) {
      cleanPhone = "+" + cleanPhone;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      setModalError("Please enter a valid phone number with country code (e.g. +91 9876543210).");
      return;
    }

    const effectiveBatchId = formData.batchId || (batches.length ? batches[0].id : null);
    const effectivePlanId = formData.planId || (plans.length ? plans[0].id : null);

    if (formData.initialPaymentStatus === "partial") {
      const pVal = Number(formData.initialAmountPaid);
      if (isNaN(pVal) || pVal <= 0) {
        setModalError("Please enter a valid partial amount paid (greater than ₹0).");
        return;
      }
    }

    setBusy(true);
    try {
      const payload = {
        full_name: formData.fullName.trim(),
        phone_number: cleanPhone,
        email: formData.email && formData.email.trim() ? formData.email.trim() : null,
        batch_id: effectiveBatchId,
        plan_id: effectivePlanId,
        join_date: formData.joinDate || new Date().toISOString().slice(0, 10),
        status: formData.status,
        whatsapp_opt_in: Boolean(formData.whatsappOptIn),
        initial_payment_status: formData.initialPaymentStatus,
        initial_amount_paid:
          formData.initialPaymentStatus === "partial" && formData.initialAmountPaid
            ? Number(formData.initialAmountPaid)
            : null,
        payment_method: formData.paymentMethod,
        notes: formData.notes && formData.notes.trim() ? formData.notes.trim() : null,
      };

      if (editingClient) {
        await api.patch(`/api/v1/admin/clients/${editingClient.id}`, payload);
        setNotice("Client updated successfully.");
      } else {
        await api.post("/api/v1/admin/clients", payload);
        setNotice("Client registered successfully with automatic plan invoice!");
      }

      setIsModalOpen(false);
      load();
    } catch (error) {
      const errDetail = formatApiError(error);
      setModalError(errDetail);
      setNotice(errDetail);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm("Are you sure you want to delete this client record?")) return;
    try {
      await api.delete(`/api/v1/admin/clients/${clientId}`);
      setNotice("Client deleted.");
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  const displayedClients = clients.filter((client) => {
    if (!selectedBatchFilter) return true;
    const selectedBatch = batches.find((b) => b.id === selectedBatchFilter);
    return (
      client.batch_id === selectedBatchFilter ||
      (selectedBatch && client.batch_name === selectedBatch.name)
    );
  });

  return (
    <section data-testid="clients-page">
      <PageHeader
        eyebrow="Client CRM & Rosters"
        title="Practitioners & Memberships"
        description="Register new clients, assign class batches, select membership pricing, and manage automated renewal notices."
        action={
          <button className="primary-button" data-testid="add-client-button" onClick={openCreateModal}>
            <Plus size={17} /> Add client
          </button>
        }
      />

      <div className="toolbar" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div className="search-box" style={{ maxWidth: "300px" }}>
          <Search size={17} />
          <input
            data-testid="client-search-input"
            value={search}
            placeholder="Search by name or number"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load()}
          />
        </div>

        <select
          data-testid="client-batch-filter"
          value={selectedBatchFilter}
          onChange={(e) => setSelectedBatchFilter(e.target.value)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "6px",
            padding: "0 12px",
            height: "42px",
            fontSize: "13px",
            color: "var(--ink)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="">All Batches ({batches.length})</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name} · {formatBatchTimeRange(batch.start_time, batch.end_time)}
            </option>
          ))}
        </select>

        <button className="secondary-button" data-testid="client-search-button" onClick={load}>
          Search
        </button>

        <button
          className="secondary-button"
          data-testid="download-clients-pdf-button"
          onClick={() => downloadAllClientsPdf(clients, batches, selectedBatchFilter)}
          title="Download PDF report of practitioners"
          style={{ marginLeft: "auto" }}
        >
          <Download size={16} /> Export PDF Roster
        </button>
      </div>

      {notice && <p className="inline-notice" data-testid="client-notice">{notice}</p>}

      <div className="data-table-wrap">
        <table data-testid="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Phone</th>
              <th>Assigned Batch</th>
              <th>Membership Plan</th>
              <th>Renewal Date</th>
              <th>Status</th>
              <th>WhatsApp Action</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {displayedClients.map((client) => {
              let batchObj = null;
              if (client.batch_id) {
                batchObj = batches.find((b) => b.id === client.batch_id);
              } else if (client.batch_name) {
                batchObj = batches.find((b) => b.name === client.batch_name);
              }
              const batchDisplayName = batchObj ? batchObj.name : (client.batch_name || "Unassigned");
              const batchTime = batchObj ? formatBatchTimeRange(batchObj.start_time, batchObj.end_time) : null;

              let planObj = null;
              if (client.plan_id) {
                planObj = plans.find((p) => p.id === client.plan_id);
              } else if (client.plan_name) {
                planObj = plans.find((p) => p.name === client.plan_name);
              }
              const planDisplayName = planObj ? planObj.name : (client.plan_name || "1 Month Plan");
              const planAmount = planObj ? planObj.amount : 1800;

              const whatsappUrl = getWhatsAppDirectUrl({
                phoneNumber: client.phone_number,
                clientName: client.full_name,
                planName: planDisplayName,
                batchName: batchDisplayName,
                amount: planAmount,
                dueDate: client.next_renewal_date || "Soon",
                reminderType: "renewal_upcoming",
              });

              return (
                <tr key={client.id} data-testid={`client-row-${client.id}`}>
                  <td>
                    <strong>{client.full_name}</strong>
                    <small>{client.email || "No email added"}</small>
                  </td>
                  <td>{client.phone_number}</td>
                  <td>
                    <strong>{batchDisplayName}</strong>
                    {batchTime && (
                      <small style={{ color: "var(--muted)", fontSize: "11px", display: "block" }}>
                        {batchTime}
                      </small>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: "700", color: "var(--ink)" }}>{planDisplayName}</span>
                    <small style={{ color: "var(--sage)", fontSize: "11px", display: "block", fontWeight: "600" }}>
                      {formatRupees(planAmount)}
                    </small>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--ink)" }}>
                      {client.next_renewal_date || "Active"}
                    </span>
                  </td>
                  <td>
                    <span className={`status-chip ${client.status}`}>{client.status}</span>
                  </td>
                  <td>
                    {client.whatsapp_opt_in ? (
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsappClient({
                            ...client,
                            batch_name: batchDisplayName,
                            batch_time: batchTime,
                            plan_name: planDisplayName,
                            plan_amount: planAmount,
                          });
                          setIsWhatsappModalOpen(true);
                        }}
                        className="secondary-button"
                        style={{
                          padding: "5px 9px",
                          fontSize: "11px",
                          gap: "5px",
                          backgroundColor: "#f0f8ed",
                          borderColor: "#b6ddaa",
                          color: "#2e681c",
                          fontWeight: "700",
                          display: "inline-flex",
                          alignItems: "center",
                          cursor: "pointer",
                        }}
                        title={`Choose message template & send WhatsApp reminder to ${client.full_name}`}
                      >
                        <MessageCircle size={13} /> Chat / Reminder
                      </button>
                    ) : (
                      <small style={{ color: "var(--muted)", fontSize: "11px" }}>Opted out</small>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        className="table-action"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => openEditModal(client)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table-action"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "#ac4932" }}
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!displayedClients.length && (
              <tr>
                <td colSpan="8" className="empty-cell" data-testid="clients-empty-state">
                  No clients match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Smart Client Onboarding Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? "Edit Practitioner Profile" : "Register New Practitioner"}
        subtitle="Onboard a client with batch schedule, membership plan, and automated fee setup."
      >
        <form onSubmit={handleSaveClient} className="modal-form">
          <div className="modal-field">
            <label>Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Aarohi Mehta"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>WhatsApp Phone Number (with +91) *</label>
            <input
              type="tel"
              placeholder="+919876543210"
              value={formData.phoneNumber}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="client@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {/* Batch Selector */}
          <div className="modal-field">
            <label>1. Select Assigned Batch *</label>
            <select
              value={formData.batchId}
              onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
              required
            >
              <option value="">-- Choose Batch --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name} · {formatBatchTimeRange(batch.start_time, batch.end_time)} ({formatScheduleDays(batch.schedule_days)})
                </option>
              ))}
            </select>
          </div>

          {/* Membership Plan Selector */}
          <div className="modal-field">
            <label>2. Select Membership Pricing Plan *</label>
            <select
              value={formData.planId}
              onChange={(e) => handlePlanChange(e.target.value)}
              required
            >
              <option value="">-- Choose Membership Plan --</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — ₹{Number(plan.amount).toLocaleString("en-IN")} ({plan.duration_days} Days)
                </option>
              ))}
            </select>
          </div>

          {/* Live Automatic Fee & Renewal Preview Box */}
          {selectedPlan && (
            <div
              style={{
                backgroundColor: "#f4f8ee",
                border: "1px solid #c9e0b8",
                borderRadius: "8px",
                padding: "12px 14px",
                margin: "4px 0 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <Sparkles size={14} style={{ color: "var(--sage)" }} />
                <strong style={{ fontSize: "12px", color: "var(--ink)" }}>
                  Automatic Plan Calculations
                </strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>Fee Amount Due:</span>
                  <strong style={{ fontSize: "16px", color: "var(--ink)", fontFamily: "Outfit, sans-serif" }}>
                    {formatRupees(calculatedFee)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "var(--muted)", display: "block" }}>Duration & Renewal:</span>
                  <strong style={{ color: "var(--ink)" }}>
                    {calculatedDuration} Days (Due {nextRenewalFormatted})
                  </strong>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Join / Start Date *</label>
              <input
                type="date"
                value={formData.joinDate}
                onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                required
              />
            </div>

            <div className="modal-field">
              <label>Initial Payment Status</label>
              <select
                value={formData.initialPaymentStatus}
                onChange={(e) => setFormData({ ...formData, initialPaymentStatus: e.target.value })}
              >
                <option value="paid">Paid in Full ({formatRupees(calculatedFee)})</option>
                <option value="pending">Payment Pending (₹0 Paid)</option>
                <option value="partial">Partial Payment</option>
              </select>
            </div>
          </div>

          {formData.initialPaymentStatus !== "pending" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="modal-field">
                <label>Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Net Banking / Transfer</option>
                </select>
              </div>

              {formData.initialPaymentStatus === "partial" && (
                <div className="modal-field">
                  <label>Amount Paid (₹)</label>
                  <input
                    type="number"
                    placeholder="Enter partial amount"
                    value={formData.initialAmountPaid}
                    onChange={(e) => setFormData({ ...formData, initialAmountPaid: e.target.value })}
                    required
                  />
                </div>
              )}
            </div>
          )}

          <div className="modal-field">
            <label>Notes / Health Goals</label>
            <textarea
              placeholder="e.g. Regular morning flow, interested in breathing techniques..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div className="modal-field-checkbox">
            <input
              type="checkbox"
              id="whatsappOptIn"
              checked={formData.whatsappOptIn}
              onChange={(e) => setFormData({ ...formData, whatsappOptIn: e.target.checked })}
            />
            <label htmlFor="whatsappOptIn">
              Enable automated WhatsApp renewal & payment reminders
            </label>
          </div>

          {modalError && (
            <div
              style={{
                backgroundColor: "#fff1f0",
                border: "1px solid #ffccc7",
                borderRadius: "8px",
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#cf1322",
                fontSize: "13px",
                fontWeight: "500",
                marginTop: "4px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{modalError}</span>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Registering..." : editingClient ? "Update Client" : "Register & Create Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Interactive WhatsApp Reminder & Message Selector Modal */}
      <WhatsAppReminderModal
        isOpen={isWhatsappModalOpen}
        onClose={() => setIsWhatsappModalOpen(false)}
        client={whatsappClient}
        onSuccess={(msg) => setNotice(msg)}
      />
    </section>
  );
}