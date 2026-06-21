"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Key, Mail, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.dev");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(email, password);
      localStorage.setItem("token", res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-bg-primary)" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: 400, padding: "40px 32px", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg, #3b82f6, #8b5cf6)", 
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            color: "white", fontSize: 24, fontWeight: 800
          }}>
            S
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>Welcome Back</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Sign in to continue to SmartAnnotate AI</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Email</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                className="input-field" 
                style={{ paddingLeft: 36, width: "100%" }} 
                placeholder="admin@local.dev"
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <Key size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required
                className="input-field" 
                style={{ paddingLeft: 36, width: "100%" }} 
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary" 
            style={{ width: "100%", justifyContent: "center", marginTop: 8, height: 44, fontSize: 14 }}
          >
            {loading ? "Signing in..." : "Sign In"} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
          Don't have an account? <Link href="/register" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 500 }}>Sign Up</Link>
        </div>
      </div>
    </div>
  );
}
