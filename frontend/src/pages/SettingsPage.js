import { useEffect, useState } from "react";
import PageHeader from "../components/PageHeader";
import api, { formatApiError } from "../lib/api";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  MessageCircle,
  Settings,
  Sparkles,
} from "../icons";
import {
  getDeviceInfo,
  getExistingPushSubscription,
  isPushSupported,
  requestAndSubscribePush,
  unsubscribePush,
} from "../lib/pushNotifications";

export default function SettingsPage() {
  const [deviceInfo, setDeviceInfo] = useState({ isIos: false, isAndroid: false, isStandalone: false, label: "Detecting..." });
  const [pushSupported, setPushSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testingDigest, setTestingDigest] = useState(false);

  const [ownerSettings, setOwnerSettings] = useState({
    owner_whatsapp: "+91 93735 74918",
    morning_digest_enabled: true,
    push_notifications_enabled: true,
    expiry_remind_days: [7, 3, 0],
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const dev = getDeviceInfo();
    setDeviceInfo(dev);
    setPushSupported(isPushSupported());

    // Check if push subscription is already active on this device
    getExistingPushSubscription().then((sub) => {
      setIsSubscribed(Boolean(sub));
    });

    // Load owner notification settings
    api
      .get("/api/v1/admin/owner-settings")
      .then((res) => {
        if (res.data) setOwnerSettings(res.data);
      })
      .catch(() => {});
  }, []);

  const handleEnablePush = async () => {
    setSubscribing(true);
    setNotice("");
    try {
      await requestAndSubscribePush();
      setIsSubscribed(true);
      setNotice("Lock screen notifications enabled! You will receive client plan expiry reminders on this phone.");
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setSubscribing(false);
    }
  };

  const handleDisablePush = async () => {
    setSubscribing(true);
    try {
      await unsubscribePush();
      setIsSubscribed(false);
      setNotice("Push notifications disabled on this device.");
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setSubscribing(false);
    }
  };

  const handleTestPush = async () => {
    setTestingPush(true);
    setNotice("");
    try {
      const res = await api.post("/api/v1/admin/push/test");
      if (res.data.sent > 0) {
        setNotice("Test notification sent! Check your phone lock screen / banner.");
      } else {
        setNotice("Test sent, but no active phone subscriptions found. Tap 'Enable Notifications' first.");
      }
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTestingPush(false);
    }
  };

  const handleTestDigest = async () => {
    setTestingDigest(true);
    setNotice("");
    try {
      const res = await api.post("/api/v1/admin/owner-digest/trigger");
      setNotice(
        `Daily 9 AM alert triggered! Sent push to ${res.data.push_result?.sent || 0} device(s). ${res.data.total_attention_count} client(s) need renewal attention.`
      );
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setTestingDigest(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setNotice("");
    try {
      await api.put("/api/v1/admin/owner-settings", ownerSettings);
      setNotice("Owner notification settings saved successfully.");
    } catch (err) {
      setNotice(formatApiError(err));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <section data-testid="settings-page">
      <PageHeader
        eyebrow="Studio Preferences & Alerts"
        title="Settings"
        description="Configure mobile push notifications (iPhone & Android), daily 9 AM WhatsApp digests, and studio details."
      />

      {notice && <p className="inline-notice" data-testid="settings-notice">{notice}</p>}

      <div className="settings-grid" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(300px, 1fr)" }}>
        {/* Left Column: Notification Configuration */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          {/* Mobile PWA Push Notifications Card */}
          <section className="settings-block" data-testid="push-notifications-card">
            <div className="section-heading">
              <BellRing size={19} style={{ color: "var(--sage)" }} />
              <h2>Phone Push Notifications (iPhone & Android)</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.5 }}>
              Receive lock screen notifications, sound alerts, and unread badges on your phone whenever client membership plans are expiring.
            </p>

            {/* Current Device Status */}
            <div
              style={{
                backgroundColor: "#f5f4ef",
                border: "1px solid var(--line)",
                borderRadius: "6px",
                padding: "12px 14px",
                marginBottom: "16px",
                fontSize: "13px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span><strong>Detected Device:</strong> {deviceInfo.label}</span>
                {isSubscribed ? (
                  <span style={{ color: "#166534", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={15} /> Active
                  </span>
                ) : (
                  <span style={{ color: "#854d0e", fontWeight: "600" }}>Not Activated</span>
                )}
              </div>

              {deviceInfo.isIos && !deviceInfo.isStandalone && (
                <div style={{ marginTop: "8px", color: "#b45309", fontSize: "12px" }}>
                  💡 <strong>iPhone tip:</strong> To enable lock screen push notifications on iPhone, make sure you opened this dashboard from your <strong>Home Screen icon</strong> (tap Safari Share button ⎋ → "Add to Home Screen").
                </div>
              )}
            </div>

            {/* Push Actions */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {!isSubscribed ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleEnablePush}
                  disabled={subscribing}
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
                >
                  <BellRing size={16} />
                  {subscribing ? "Subscribing…" : "Enable Lock Screen Notifications on this Phone"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={handleTestPush}
                    disabled={testingPush}
                    style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}
                  >
                    <Sparkles size={16} />
                    {testingPush ? "Sending test…" : "Send Test Notification to Phone"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleDisablePush}
                    disabled={subscribing}
                    style={{ fontSize: "12px" }}
                  >
                    Disable on this device
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Owner Daily WhatsApp Digest Configuration */}
          <section className="settings-block" data-testid="owner-whatsapp-digest-card">
            <div className="section-heading">
              <MessageCircle size={19} style={{ color: "#25D366" }} />
              <h2>Daily 9:00 AM Owner WhatsApp Digest</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px", lineHeight: 1.5 }}>
              Receive an automated morning summary of expiring memberships directly on the owner's WhatsApp number so you never miss an expiry even when away from the computer.
            </p>

            <form onSubmit={handleSaveSettings}>
              <label>
                Owner WhatsApp Mobile Number
                <input
                  type="text"
                  placeholder="+91 93735 74918"
                  value={ownerSettings.owner_whatsapp || ""}
                  onChange={(e) =>
                    setOwnerSettings({ ...ownerSettings, owner_whatsapp: e.target.value })
                  }
                  required
                />
                <small style={{ color: "var(--muted)", fontSize: "11px", display: "block", marginTop: "3px" }}>
                  Include country code (e.g. +91 for India).
                </small>
              </label>

              <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={ownerSettings.morning_digest_enabled}
                    onChange={(e) =>
                      setOwnerSettings({
                        ...ownerSettings,
                        morning_digest_enabled: e.target.checked,
                      })
                    }
                    style={{ width: "auto", margin: 0 }}
                  />
                  Send daily 9:00 AM Plan Expiry Digest
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontWeight: "normal", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={ownerSettings.push_notifications_enabled}
                    onChange={(e) =>
                      setOwnerSettings({
                        ...ownerSettings,
                        push_notifications_enabled: e.target.checked,
                      })
                    }
                    style={{ width: "auto", margin: 0 }}
                  />
                  Dispatch Web Push alerts to registered phone lock screens
                </label>
              </div>

              <div style={{ marginTop: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={savingSettings}
                >
                  {savingSettings ? "Saving…" : "Save Notification Preferences"}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleTestDigest}
                  disabled={testingDigest}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Sparkles size={15} />
                  {testingDigest ? "Dispatching…" : "Trigger Daily Alert Now"}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Column: Studio Profile & Security */}
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <section className="settings-block" data-testid="studio-profile-settings">
            <div className="section-heading">
              <Settings size={19} />
              <h2>Studio profile</h2>
            </div>
            <label>
              Studio name
              <input data-testid="studio-name-input" value="Divine Yoga Studio" readOnly />
            </label>
            <label>
              Studio WhatsApp business
              <input data-testid="studio-whatsapp-input" value="+91 93735 74918" readOnly />
            </label>
            <label>
              Studio hours
              <input
                data-testid="studio-hours-input"
                value="Mon–Sat · 7:15 AM–11:00 AM · 4:15–7:00 PM"
                readOnly
              />
            </label>
          </section>

          <section className="security-note" data-testid="security-settings-panel">
            <CheckCircle2 size={24} />
            <div>
              <p className="eyebrow">Private & Secure</p>
              <h2>Admin security</h2>
              <p>
                Your workspace uses a protected owner account with encrypted medical notes, audit logs, and secure PWA push authentication keys.
              </p>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}