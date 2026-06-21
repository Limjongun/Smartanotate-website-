"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { User, Key, Mail, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await authApi.register(email, password, name);
      // Auto login after register
      const loginRes = await authApi.login(email, password);
      localStorage.setItem("token", loginRes.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>Create Account</h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>Join SmartAnnotate AI today</p>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {error && (
            <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: 13, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>Full Name</label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} />
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
                className="input-field" 
                style={{ paddingLeft: 36, width: "100%" }} 
                placeholder="John Doe"
              />
            </div>
          </div>

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
                placeholder="user@example.com"
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
                minLength={6}
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
            {loading ? "Creating account..." : "Sign Up"} <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
          Already have an account? <Link href="/login" style={{ color: "#3b82f6", textDecoration: "none", fontWeight: 500 }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
