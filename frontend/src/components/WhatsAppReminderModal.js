import { useEffect, useState } from "react";
import Modal from "./Modal";
import api, { formatApiError } from "../lib/api";
import {
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  Sparkles,
  Users,
  CalendarDays,
  CreditCard,
  Layers,
  AlertCircle,
} from "../icons";
import {
  DEFAULT_STUDIO_TEMPLATES,
  normalizePhoneForWhatsApp,
  renderTemplateMessage,
} from "../lib/whatsappUtils";

export default function WhatsAppReminderModal({
  isOpen,
  onClose,
  client,
  payment,
  onSuccess,
}) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Extract client & payment context
  const clientName = client?.full_name || client?.name || payment?.client_name || "Practitioner";
  const rawPhone = client?.phone_number || payment?.phone_number || "";
  const cleanPhone = normalizePhoneForWhatsApp(rawPhone);
  const planName = client?.plan_name || payment?.plan_name || "Yoga Membership";
  const batchName = client?.batch_name || "";
  const batchTime = client?.batch_time || "";
  const rawAmount =
    payment?.amount_due != null
      ? payment.amount_due - (payment.amount_paid || 0)
      : client?.initial_amount_paid || client?.plan_amount || 1800;
  const dueDate =
    payment?.due_date || client?.next_renewal_date || client?.join_date || "Scheduled Date";

  const variables = {
    name: clientName,
    clientName,
    plan: planName,
    planName,
    batch: batchName || "Assigned Batch",
    batchName: batchName || "Assigned Batch",
    batchTime,
    amount: rawAmount,
    dueDate,
    due_date: dueDate,
    renewal_date: dueDate,
    next_renewal_date: dueDate,
    studioName: "Divine Yoga Studio",
    studio_name: "Divine Yoga Studio",
    phone: rawPhone,
  };

  // Load custom database templates & combine with built-in presets
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setCopied(false);

    api
      .get("/api/v1/admin/reminders/templates")
      .then((res) => {
        const dbTemplates = Array.isArray(res.data) ? res.data : [];
        // Merge DB templates with presets without duplicates by name
        const combined = [...dbTemplates];
        DEFAULT_STUDIO_TEMPLATES.forEach((preset) => {
          if (!combined.some((t) => t.name?.toLowerCase() === preset.name.toLowerCase())) {
            combined.push(preset);
          }
        });
        setTemplates(combined);

        // Auto-select first template (or overdue template if payment is overdue)
        const initialTemplate =
          (payment?.payment_status === "overdue"
            ? combined.find((t) => t.trigger_type === "overdue" || t.name?.toLowerCase().includes("overdue"))
            : null) || combined[0];

        if (initialTemplate) {
          setSelectedTemplateId(initialTemplate.id);
          setCustomMessage(renderTemplateMessage(initialTemplate.message_body, variables));
        }
      })
      .catch(() => {
        setTemplates(DEFAULT_STUDIO_TEMPLATES);
        const initial = DEFAULT_STUDIO_TEMPLATES[0];
        setSelectedTemplateId(initial.id);
        setCustomMessage(renderTemplateMessage(initial.message_body, variables));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, client, payment]);

  const handleSelectTemplate = (template) => {
    setSelectedTemplateId(template.id);
    setCustomMessage(renderTemplateMessage(template.message_body, variables));
  };

  const handleCopyMessage = () => {
    if (!customMessage) return;
    navigator.clipboard?.writeText(customMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = async () => {
    if (!cleanPhone) {
      setError("This client does not have a valid mobile phone number recorded.");
      return;
    }
    if (!customMessage.trim()) {
      setError("Please select or compose a message before sending.");
      return;
    }

    setSending(true);
    setError("");

    try {
      // Find template name
      const activeTemplate = templates.find((t) => t.id === selectedTemplateId);
      const templateName = activeTemplate ? activeTemplate.name : "Custom WhatsApp Notice";

      // Log direct manual dispatch in CRM
      await api
        .post("/api/v1/admin/reminders/log-direct", {
          client_id: client?.id || payment?.client_id || "direct",
          client_name: clientName,
          phone_number: rawPhone,
          template_name: templateName,
          message_text: customMessage,
          payment_id: payment?.id || null,
        })
        .catch((err) => {
          console.warn("Could not log reminder to audit:", err);
        });

      // Construct direct wa.me link
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(customMessage)}`;

      // Open WhatsApp in new tab / native application
      window.open(waUrl, "_blank", "noopener,noreferrer");

      if (onSuccess) {
        onSuccess(`WhatsApp chat opened for ${clientName}!`);
      }
      onClose();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSending(false);
    }
  };

  const insertPlaceholder = (tag) => {
    setCustomMessage((prev) => `${prev} ${tag}`);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Send WhatsApp Notice / Reminder"
      subtitle={`Compose and dispatch personalized messages directly to ${clientName} on WhatsApp.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Client Profile Card */}
        <div
          style={{
            background: "#f7f9f2",
            border: "1px solid #dbe5cb",
            borderRadius: "10px",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--sage)", letterSpacing: "0.05em" }}>
                Recipient Practitioner
              </span>
              <h4 style={{ margin: "2px 0 0", fontSize: "16px", color: "var(--ink)", fontWeight: "700" }}>
                {clientName}
              </h4>
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "white",
                border: "1px solid #cbd7b1",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: "700",
                color: "#2e681c",
              }}
            >
              <MessageCircle size={14} />
              <span>{rawPhone || "No phone number"}</span>
            </div>
          </div>

          {/* Mini Metadata Badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px" }}>
            {batchName && (
              <span
                style={{
                  background: "#edf3e5",
                  color: "#355320",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Users size={12} /> {batchName}
              </span>
            )}
            {planName && (
              <span
                style={{
                  background: "#f5f4ef",
                  color: "#43423e",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <Layers size={12} /> {planName} (₹{Number(rawAmount || 0).toLocaleString("en-IN")})
              </span>
            )}
            {dueDate && (
              <span
                style={{
                  background: "#fff5e5",
                  color: "#8e5411",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  fontWeight: "600",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <CalendarDays size={12} /> Renewal / Due: {dueDate}
              </span>
            )}
          </div>
        </div>

        {/* Template Selector Section */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              1. Select Message Template
            </label>
            <span style={{ fontSize: "11px", color: "var(--sage)", fontWeight: "600" }}>
              {templates.length} Designs Available
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "8px",
              maxHeight: "160px",
              overflowY: "auto",
              padding: "2px",
            }}
          >
            {templates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelectTemplate(template)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "4px",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: isSelected ? "2px solid var(--sage)" : "1px solid var(--line)",
                    background: isSelected ? "#f4f7ee" : "var(--surface)",
                    color: isSelected ? "var(--sage)" : "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                    <Sparkles size={12} style={{ color: isSelected ? "var(--sage)" : "#9c9a92", flexShrink: 0 }} />
                    <strong style={{ fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {template.name}
                    </strong>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--muted)", textTransform: "capitalize" }}>
                    {template.trigger_type ? template.trigger_type.replace("_", " ") : "Studio notice"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Message Box & Live Preview */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              2. Review & Customize Message
            </label>
            <button
              type="button"
              onClick={handleCopyMessage}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background: "transparent",
                border: "none",
                color: copied ? "#2e681c" : "var(--sage)",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                padding: "2px 6px",
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy Text"}
            </button>
          </div>

          {/* WhatsApp Preview Bubble */}
          <div
            style={{
              background: "#eef5ea",
              border: "1px solid #d0dfba",
              borderRadius: "10px",
              padding: "12px 14px",
              position: "relative",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--sage)", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.05em" }}>
              Live WhatsApp Draft
            </div>
            <textarea
              rows={8}
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Type your message to the practitioner..."
              style={{
                width: "100%",
                background: "white",
                border: "1px solid #ccd8b8",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "14px",
                fontFamily: "inherit",
                lineHeight: "1.55",
                color: "var(--ink)",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {/* Quick Variable Tag Pills */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "8px" }}>
              <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "700", textTransform: "uppercase" }}>
                Insert tag:
              </span>
              {[
                { label: "+ Name", tag: "{name}" },
                { label: "+ Fee", tag: "₹{amount}" },
                { label: "+ Due Date", tag: "{due_date}" },
                { label: "+ Plan", tag: "{plan}" },
                { label: "+ Batch", tag: "{batch}" },
              ].map((item) => (
                <button
                  key={item.tag}
                  type="button"
                  onClick={() => insertPlaceholder(item.tag)}
                  style={{
                    background: "white",
                    border: "1px solid #c2d6a7",
                    borderRadius: "4px",
                    padding: "2px 6px",
                    fontSize: "11px",
                    color: "var(--sage)",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
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
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginTop: "6px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSendWhatsApp}
            disabled={sending || !cleanPhone}
            style={{
              backgroundColor: "#25D366",
              borderColor: "#20b858",
              color: "white",
              fontWeight: "700",
              fontSize: "14px",
              padding: "11px 20px",
              borderRadius: "8px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid transparent",
              cursor: sending || !cleanPhone ? "not-allowed" : "pointer",
              boxShadow: "0 4px 12px rgba(37, 211, 102, 0.25)",
              transition: "all 0.18s ease",
            }}
          >
            <MessageCircle size={18} />
            {sending ? "Opening..." : "Open in WhatsApp & Send"}
            <ExternalLink size={14} style={{ opacity: 0.8 }} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
