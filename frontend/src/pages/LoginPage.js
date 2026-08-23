import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Leaf } from "../icons";
import { useAuth } from "../components/AuthProvider";
import api, { formatApiError } from "../lib/api";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("admin@divineyogastudio.in");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await api.post("/api/v1/auth/login", { email, password });
      setUser(response.data);
      navigate("/");
    } catch (requestError) {
      setError(formatApiError(requestError));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="login-screen" data-testid="login-screen">
      <section className="login-intro">
        <div className="brand-mark">
          <img
            src="/logo.png"
            alt="Divine Yoga Studio Logo"
            style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "8px", background: "white", padding: "2px", flexShrink: 0 }}
          />
          <span>divine<span>yoga</span></span>
        </div>
        <div>
          <p className="eyebrow">Private studio workspace</p>
          <h1>Clarity for every client, payment, and practice.</h1>
          <p>Your calm command centre for Divine Yoga Studio.</p>
        </div>
        <div className="login-quote">“Teach from presence. Manage with ease.”</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit} data-testid="login-form">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
            <img
              src="/logo.png"
              alt="Divine Yoga Studio"
              style={{ width: "48px", height: "48px", objectFit: "contain", borderRadius: "10px", border: "1px solid var(--line)" }}
            />
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Admin sign in</p>
              <h2 style={{ margin: 0, fontSize: "24px" }}>Welcome back</h2>
            </div>
          </div>
          <p>Use your private studio account to continue.</p>
          <label htmlFor="email">Email address</label>
          <input id="email" data-testid="login-email-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" data-testid="login-password-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength="10" required />
          {error && <p className="form-error" data-testid="login-error-message">{error}</p>}
          <button className="primary-button" data-testid="login-submit-button" disabled={busy}>
            {busy ? "Signing in…" : "Enter workspace"}
          </button>
        </form>
      </section>
    </main>
  );
}