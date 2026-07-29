import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import api, { formatApiError } from "../lib/api";
import { Plus, Search } from "../icons";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "+91",
    email: "",
    status: "active",
    batchId: "",
    whatsappOptIn: true,
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [clientsRes, batchesRes] = await Promise.all([
        api.get("/api/v1/admin/clients", { params: { search } }),
        api.get("/api/v1/admin/batches").catch(() => ({ data: [] })),
      ]);
      setClients(clientsRes.data);
      setBatches(batchesRes.data);
    } catch (error) {
      setNotice(formatApiError(error));
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openCreateModal = () => {
    setEditingClient(null);
    setFormData({
      fullName: "",
      phoneNumber: "+91",
      email: "",
      status: "active",
      batchId: "",
      whatsappOptIn: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (client) => {
    setEditingClient(client);
    setFormData({
      fullName: client.full_name || "",
      phoneNumber: client.phone_number || "+91",
      email: client.email || "",
      status: client.status || "active",
      batchId: client.batch_id || "",
      whatsappOptIn: client.whatsapp_opt_in ?? true,
    });
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        full_name: formData.fullName,
        phone_number: formData.phoneNumber,
        email: formData.email || null,
        batch_id: formData.batchId || null,
        whatsapp_opt_in: formData.whatsappOptIn,
        join_date: editingClient ? editingClient.join_date : new Date().toISOString().slice(0, 10),
        status: formData.status,
      };

      if (editingClient) {
        await api.patch(`/api/v1/admin/clients/${editingClient.id}`, payload);
        setNotice("Client updated successfully.");
      } else {
        await api.post("/api/v1/admin/clients", payload);
        setNotice("Client added successfully.");
      }

      setIsModalOpen(false);
      load();
    } catch (error) {
      setNotice(formatApiError(error));
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

  return (
    <section data-testid="clients-page">
      <PageHeader
        eyebrow="Client CRM"
        title="Clients"
        description="People, memberships, and their current studio journey."
        action={
          <button className="primary-button" data-testid="add-client-button" onClick={openCreateModal}>
            <Plus size={17} />Add client
          </button>
        }
      />
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            data-testid="client-search-input"
            value={search}
            placeholder="Search by name or number"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && load()}
          />
        </div>
        <button className="secondary-button" data-testid="client-search-button" onClick={load}>Search</button>
      </div>
      {notice && <p className="inline-notice" data-testid="client-notice">{notice}</p>}
      <div className="data-table-wrap">
        <table data-testid="clients-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Phone</th>
              <th>Batch</th>
              <th>Status</th>
              <th>WhatsApp</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} data-testid={`client-row-${client.id}`}>
                <td><strong>{client.full_name}</strong><small>{client.email || "No email added"}</small></td>
                <td>{client.phone_number}</td>
                <td>{client.batch_id ? (batches.find(b => b.id === client.batch_id)?.name || "Assigned batch") : "Unassigned"}</td>
                <td><span className={`status-chip ${client.status}`}>{client.status}</span></td>
                <td>{client.whatsapp_opt_in ? "Enabled" : "Paused"}</td>
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
            ))}
            {!clients.length && (
              <tr>
                <td colSpan="6" className="empty-cell" data-testid="clients-empty-state">No clients match this view.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClient ? "Edit Client" : "Add New Client"}
        subtitle="Register or manage a practitioner in your studio CRM."
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
            <label>Phone Number (E.164) *</label>
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

          <div className="modal-field">
            <label>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          <div className="modal-field">
            <label>Assigned Batch</label>
            <select
              value={formData.batchId}
              onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
            >
              <option value="">-- Select Batch (Optional) --</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>{batch.name} ({batch.instructor_name})</option>
              ))}
            </select>
          </div>

          <div className="modal-field-checkbox">
            <input
              type="checkbox"
              id="whatsappOptIn"
              checked={formData.whatsappOptIn}
              onChange={(e) => setFormData({ ...formData, whatsappOptIn: e.target.checked })}
            />
            <label htmlFor="whatsappOptIn">Enable WhatsApp reminders for this client</label>
          </div>

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Saving..." : (editingClient ? "Update Client" : "Save Client")}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}