import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { CheckCircle2, MessageCircle, Plus } from "../icons";

export default function RemindersPage() {
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [notice, setNotice] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    triggerType: "overdue",
    offsetDays: "3",
    messageBody: "Namaste {name}, your fee of ₹{amount} is due on {due_date}. Thank you.",
  });

  const load = async () => {
    try {
      const [templateResponse, logResponse] = await Promise.all([
        api.get("/api/v1/admin/reminders/templates"),
        api.get("/api/v1/admin/reminders/logs"),
      ]);
      setTemplates(templateResponse.data);
      setLogs(logResponse.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/v1/admin/reminders/templates", {
        name: formData.name,
        trigger_type: formData.triggerType,
        offset_days: Number(formData.offsetDays),
        message_body: formData.messageBody,
        is_active: true,
      });
      setNotice("Template saved successfully.");
      setIsModalOpen(false);
      setFormData({
        name: "",
        triggerType: "overdue",
        offsetDays: "3",
        messageBody: "Namaste {name}, your fee of ₹{amount} is due on {due_date}. Thank you.",
      });
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="reminders-page">
      <PageHeader
        eyebrow="WhatsApp reminder engine"
        title="Reminders"
        description="Messages are safely queued and logged until your WATI connection is added."
        action={
          <button className="primary-button" data-testid="add-reminder-template-button" onClick={() => setIsModalOpen(true)}>
            <Plus size={17} />New template
          </button>
        }
      />
      {notice && <p className="inline-notice" data-testid="reminder-notice">{notice}</p>}
      <div className="reminder-layout">
        <section>
          <div className="section-heading">
            <MessageCircle size={19} />
            <h2>Active templates</h2>
          </div>
          <div className="template-stack">
            {templates.map((template) => (
              <article className="template-card" key={template.id} data-testid={`template-card-${template.id}`}>
                <div>
                  <span className="tag">{template.trigger_type?.replaceAll("_", " ")}</span>
                  <h3>{template.name}</h3>
                  <p>{template.message_body}</p>
                </div>
                <small>{template.offset_days} day{template.offset_days === 1 ? "" : "s"} offset</small>
              </article>
            ))}
          </div>
        </section>
        <section className="queue-panel" data-testid="reminder-log-panel">
          <div className="section-heading">
            <CheckCircle2 size={19} />
            <h2>Queue & delivery log</h2>
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
              <img src="https://images.pexels.com/photos/4464468/pexels-photo-4464468.jpeg" alt="Zen stones" />
              <p>No messages have been queued yet.</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Reminder Template"
        subtitle="Configure automated WhatsApp reminder messages."
      >
        <form onSubmit={handleCreateTemplate} className="modal-form">
          <div className="modal-field">
            <label>Template Name *</label>
            <input
              type="text"
              placeholder="e.g. Overdue payment notice"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Trigger Event</label>
            <select
              value={formData.triggerType}
              onChange={(e) => setFormData({ ...formData, triggerType: e.target.value })}
            >
              <option value="overdue">Overdue Payment</option>
              <option value="before_due">Before Due Date</option>
              <option value="due_date">On Due Date</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Offset Days</label>
            <input
              type="number"
              placeholder="3"
              value={formData.offsetDays}
              onChange={(e) => setFormData({ ...formData, offsetDays: e.target.value })}
              required
            />
          </div>

          <div className="modal-field">
            <label>Message Body *</label>
            <textarea
              placeholder="Namaste {name}, your fee of ₹{amount} is due..."
              value={formData.messageBody}
              onChange={(e) => setFormData({ ...formData, messageBody: e.target.value })}
              required
            />
            <small style={{ color: "var(--muted)", fontSize: "11px" }}>
              Available placeholders: <code>{"{name}"}</code>, <code>{"{amount}"}</code>, <code>{"{due_date}"}</code>, <code>{"{month}"}</code>, <code>{"{studio_name}"}</code>
            </small>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : "Save Template"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}