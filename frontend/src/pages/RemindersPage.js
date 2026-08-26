import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { CheckCircle2, MessageCircle, Plus, Sparkles } from "../icons";
import WhatsAppReminderModal from "../components/WhatsAppReminderModal";

const formatRupees = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

export default function RemindersPage() {
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [notice, setNotice] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [whatsappPayment, setWhatsappPayment] = useState(null);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    triggerType: "overdue",
    offsetDays: "3",
    messageBody: "Namaste {name}, your fee of ₹{amount} is due on {due_date}. Thank you.",
  });

  const load = async () => {
    try {
      const [templateResponse, logResponse, paymentsResponse] = await Promise.all([
        api.get("/api/v1/admin/reminders/templates"),
        api.get("/api/v1/admin/reminders/logs"),
        api.get("/api/v1/admin/payments", { params: { status: "overdue" } }).catch(() => ({ data: [] })),
      ]);
      setTemplates(templateResponse.data);
      setLogs(logResponse.data);
      setPendingPayments(paymentsResponse.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      triggerType: "overdue",
      offsetDays: "3",
      messageBody: "Namaste {name}, your fee of ₹{amount} is due on {due_date}. Thank you.",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      triggerType: template.trigger_type,
      offsetDays: String(template.offset_days),
      messageBody: template.message_body,
    });
    setIsModalOpen(true);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name: formData.name,
        trigger_type: formData.triggerType,
        offset_days: Number(formData.offsetDays),
        message_body: formData.messageBody,
        is_active: true,
      };

      if (editingTemplate) {
        await api.put(`/api/v1/admin/reminders/templates/${editingTemplate.id}`, payload);
        setNotice("Template updated successfully.");
      } else {
        await api.post("/api/v1/admin/reminders/templates", payload);
        setNotice("Template created successfully.");
      }

      setIsModalOpen(false);
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to delete this reminder template?")) return;
    try {
      await api.delete(`/api/v1/admin/reminders/templates/${templateId}`);
      setNotice("Template deleted.");
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  return (
    <section data-testid="reminders-page">
      <PageHeader
        eyebrow="WhatsApp Reminder Engine"
        title="Reminders & Notifications"
        description="Automate 3-stage renewal reminders (T-3 Days, Due Today, Overdue) and send 1-click personalized WhatsApp messages."
        action={
          <button className="primary-button" data-testid="add-reminder-template-button" onClick={openCreateModal}>
            <Plus size={17} /> New template
          </button>
        }
      />

      {notice && <p className="inline-notice" data-testid="reminder-notice">{notice}</p>}

      {/* Immediate Attention & 1-Click WhatsApp Section */}
      {pendingPayments.length > 0 && (
        <section style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "20px", marginBottom: "25px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} style={{ color: "var(--sage)" }} />
              <h2 style={{ fontSize: "17px", margin: 0 }}>Instant WhatsApp Renewal Follow-Ups ({pendingPayments.length})</h2>
            </div>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>Click to open pre-filled WhatsApp chat</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
            {pendingPayments.map((p) => {
              const balance = p.amount_due - p.amount_paid;

              return (
                <div
                  key={p.id}
                  style={{
                    background: "#faf9f6",
                    border: "1px solid #e5e2d8",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "14px", color: "var(--ink)", display: "block" }}>
                      {p.client?.full_name || "Practitioner"}
                    </strong>
                    <small style={{ color: "var(--muted)", fontSize: "11px" }}>
                      Due {p.due_date} · {formatRupees(balance)} pending
                    </small>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setWhatsappPayment(p);
                      setIsWhatsappModalOpen(true);
                    }}
                    className="secondary-button"
                    style={{
                      padding: "6px 11px",
                      fontSize: "11px",
                      backgroundColor: "#edf7eb",
                      borderColor: "#b9deb0",
                      color: "#275e18",
                      fontWeight: "700",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      cursor: "pointer",
                    }}
                    title={`Choose message template & send WhatsApp reminder to ${p.client?.full_name}`}
                  >
                    <MessageCircle size={14} /> Send WhatsApp
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2-Column: Active Templates & Delivery Log */}
      <div className="reminder-layout">
        <section>
          <div className="section-heading">
            <MessageCircle size={19} />
            <h2>Active templates & triggers</h2>
          </div>
          <div className="template-stack">
            {templates.map((template) => (
              <article className="template-card" key={template.id} data-testid={`template-card-${template.id}`}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span className="tag" style={{ textTransform: "capitalize" }}>
                      {template.trigger_type?.replaceAll("_", " ")} ({template.offset_days} days)
                    </span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        type="button"
                        className="table-action"
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => openEditModal(template)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table-action"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "#ac4932" }}
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <h3>{template.name}</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "12px", color: "var(--muted)", lineHeight: 1.5 }}>
                    {template.message_body}
                  </p>
                </div>
              </article>
            ))}
            {!templates.length && <p className="empty-copy">No reminder templates created yet.</p>}
          </div>
        </section>

        <section className="queue-panel" data-testid="reminder-log-panel">
          <div className="section-heading">
            <CheckCircle2 size={19} />
            <h2>Delivery & automation log</h2>
          </div>
          {logs.length ? (
            logs.map((log) => (
              <div className="queue-row" key={log.id} data-testid={`reminder-log-${log.id}`}>
                <div className="person-dot">{log.client_name?.[0]}</div>
                <div>
                  <strong>{log.client_name}</strong>
                  <small>{log.message_preview}</small>
                </div>
                <span className={`status-chip ${log.delivery_status}`}>{log.delivery_status}</span>
              </div>
            ))
          ) : (
            <div className="empty-log" data-testid="reminder-logs-empty-state">
              <MessageCircle size={32} style={{ color: "var(--sage)", margin: "30px auto 10px", display: "block", opacity: 0.6 }} />
              <p>No automated messages dispatched today.</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTemplate ? "Edit Template" : "New Reminder Template"}
        subtitle="Configure the automated message and trigger rules."
      >
        <form onSubmit={handleSaveTemplate} className="modal-form">
          <div className="modal-field">
            <label>Template Name *</label>
            <input
              type="text"
              placeholder="e.g. 3-Day Advance Renewal Alert"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Trigger Stage *</label>
              <select
                value={formData.triggerType}
                onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
              >
                <option value="before_due">Before Due Date (Advance Notice)</option>
                <option value="on_due">On Due Date (Due Today)</option>
                <option value="overdue">After Due Date (Overdue Alert)</option>
              </select>
            </div>

            <div className="modal-field">
              <label>Offset (Days) *</label>
              <input
                type="number"
                placeholder="3"
                value={formData.offsetDays}
                onChange={(e) => setFormData({ ...formData, offsetDays: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="modal-field">
            <label>Message Content *</label>
            <textarea
              value={formData.messageBody}
              onChange={(e) => setFormData({ ...formData, messageBody: e.target.value })}
              rows={4}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", marginTop: "4px" }}>
              Available placeholders: {"{name}"}, {"{amount}"}, {"{due_date}"}, {"{studio_name}"}
            </small>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : editingTemplate ? "Update Template" : "Save Template"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Interactive WhatsApp Reminder & Message Selector Modal */}
      <WhatsAppReminderModal
        isOpen={isWhatsappModalOpen}
        onClose={() => setIsWhatsappModalOpen(false)}
        client={whatsappPayment?.client}
        payment={whatsappPayment}
        onSuccess={(msg) => {
          setNotice(msg);
          load();
        }}
      />
    </section>
  );
}