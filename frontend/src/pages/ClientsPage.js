import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import api, { formatApiError } from "../lib/api";
import { Plus, Search } from "../icons";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const load = async () => { try { setClients((await api.get("/api/v1/admin/clients", { params: { search } })).data); } catch (error) { setNotice(formatApiError(error)); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  const addClient = async () => {
    const fullName = window.prompt("Client full name");
    const phoneNumber = window.prompt("Phone in E.164 format, e.g. +919876543210");
    if (!fullName || !phoneNumber) return;
    try { await api.post("/api/v1/admin/clients", { full_name: fullName, phone_number: phoneNumber, whatsapp_opt_in: true, join_date: new Date().toISOString().slice(0, 10), status: "trial" }); setNotice("Client added successfully."); load(); } catch (error) { setNotice(formatApiError(error)); }
  };
  return <section data-testid="clients-page"><PageHeader eyebrow="Client CRM" title="Clients" description="People, memberships, and their current studio journey." action={<button className="primary-button" data-testid="add-client-button" onClick={addClient}><Plus size={17} />Add client</button>} /><div className="toolbar"><div className="search-box"><Search size={17} /><input data-testid="client-search-input" value={search} placeholder="Search by name or number" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && load()} /></div><button className="secondary-button" data-testid="client-search-button" onClick={load}>Search</button></div>{notice && <p className="inline-notice" data-testid="client-notice">{notice}</p>}<div className="data-table-wrap"><table data-testid="clients-table"><thead><tr><th>Client</th><th>Phone</th><th>Batch</th><th>Status</th><th>WhatsApp</th></tr></thead><tbody>{clients.map((client) => <tr key={client.id} data-testid={`client-row-${client.id}`}><td><strong>{client.full_name}</strong><small>{client.email || "No email added"}</small></td><td>{client.phone_number}</td><td>{client.batch_id ? "Assigned batch" : "Unassigned"}</td><td><span className={`status-chip ${client.status}`}>{client.status}</span></td><td>{client.whatsapp_opt_in ? "Enabled" : "Paused"}</td></tr>)}{!clients.length && <tr><td colSpan="5" className="empty-cell" data-testid="clients-empty-state">No clients match this view.</td></tr>}</tbody></table></div></section>;
}