import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { Download, MessageCircle, Plus } from "../icons";

export default function FinancesPage() {
  const [payments, setPayments] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState("overdue");
  const [notice, setNotice] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    clientId: "",
    amountDue: "",
    amountPaid: "0",
    dueDate: new Date().toISOString().slice(0, 10),
    paymentStatus: "pending",
    notes: "Monthly membership fee",
  });

  const load = async () => {
    try {
      const [paymentsRes, clientsRes] = await Promise.all([
        api.get("/api/v1/admin/payments", { params: filter ? { status: filter } : {} }),
        api.get("/api/v1/admin/clients").catch(() => ({ data: [] })),
      ]);
      setPayments(paymentsRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [filter]);

  const handleCreatePayment = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/v1/admin/payments", {
        client_id: paymentForm.clientId,
        amount_due: Number(paymentForm.amountDue),
        amount_paid: Number(paymentForm.amountPaid),
        due_date: paymentForm.dueDate,
        payment_status: Number(paymentForm.amountPaid) >= Number(paymentForm.amountDue) ? "paid" : paymentForm.paymentStatus,
        notes: paymentForm.notes,
      });
      setNotice("Payment record created successfully.");
      setIsModalOpen(false);
      setPaymentForm({
        clientId: "",
        amountDue: "",
        amountPaid: "0",
        dueDate: new Date().toISOString().slice(0, 10),
        paymentStatus: "pending",
        notes: "Monthly membership fee",
      });
      load();
    } catch (error) {
      setNotice(formatApiError(error));
    } finally {
      setBusy(false);
    }
  };

  const queue = async (paymentId) => {
    try {
      const result = await api.post("/api/v1/admin/reminders/send-manual", { payment_ids: [paymentId] });
      setNotice(result.data.results[0].status === "queued" ? "Reminder safely queued." : result.data.results[0].reason);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  const exportLedger = async () => {
    const response = await api.get("/api/v1/admin/payments/export", { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = "divine-yoga-ledger.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <section data-testid="finances-page">
      <PageHeader
        eyebrow="Finance tracker"
        title="Payments"
        description="A complete ledger for every fee, due date, and follow-up."
        action={
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="secondary-button" data-testid="export-ledger-button" onClick={exportLedger}>
              <Download size={17} />Export ledger
            </button>
            <button className="primary-button" onClick={() => setIsModalOpen(true)}>
              <Plus size={17} />Record fee / payment
            </button>
          </div>
        }
      />
      <div className="tab-bar" data-testid="payment-filter-tabs">
        {[["overdue", "Overdue"], ["pending", "Pending"], ["paid", "Paid"], ["", "All"]].map(([value, label]) => (
          <button
            key={label}
            data-testid={`payment-filter-${label.toLowerCase()}`}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {notice && <p className="inline-notice" data-testid="finance-notice">{notice}</p>}
      <div className="data-table-wrap">
        <table data-testid="payments-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Due date</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} data-testid={`payment-row-${payment.id}`}>
                <td>
                  <strong>{payment.client?.full_name || "Practitioner"}</strong>
                  <small>{payment.client?.phone_number}</small>
                </td>
                <td>
                  {payment.due_date}
                  <small>{payment.days_overdue ? `${payment.days_overdue} days overdue` : ""}</small>
                </td>
                <td>₹{(payment.amount_due - payment.amount_paid).toLocaleString("en-IN")}</td>
                <td><span className={`status-chip ${payment.payment_status}`}>{payment.payment_status}</span></td>
                <td>
                  <button
                    className="table-action"
                    data-testid={`send-reminder-${payment.id}`}
                    onClick={() => queue(payment.id)}
                    disabled={!payment.client?.whatsapp_opt_in}
                    title={!payment.client?.whatsapp_opt_in ? "WhatsApp reminders are disabled for this client" : "Queue a WhatsApp reminder"}
                  >
                    <MessageCircle size={16} />Remind
                  </button>
                </td>
              </tr>
            ))}
            {!payments.length && (
              <tr>
                <td colSpan="5" className="empty-cell" data-testid="payments-empty-state">No payments in this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Payment / Fee"
        subtitle="Log a due fee or payment record for a client."
      >
        <form onSubmit={handleCreatePayment} className="modal-form">
          <div className="modal-field">
            <label>Select Client *</label>
            <select
              value={paymentForm.clientId}
              onChange={(e) => setPaymentForm({ ...paymentForm, clientId: e.target.value })}
              required
            >
              <option value="">-- Choose Client --</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.full_name} ({client.phone_number})</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Amount Due (₹) *</label>
              <input
                type="number"
                placeholder="2500"
                value={paymentForm.amountDue}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountDue: e.target.value })}
                required
              />
            </div>
            <div className="modal-field">
              <label>Amount Paid (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={paymentForm.amountPaid}
                onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="modal-field">
              <label>Due Date *</label>
              <input
                type="date"
                value={paymentForm.dueDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, dueDate: e.target.value })}
                required
              />
            </div>
            <div className="modal-field">
              <label>Status</label>
              <select
                value={paymentForm.paymentStatus}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentStatus: e.target.value })}
              >
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>

          <div className="modal-field">
            <label>Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Monthly renewal fee"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : "Save Record"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}