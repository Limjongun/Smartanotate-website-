import sys

content = """"use client";

import AppShell from "@/components/layout/AppShell";
import { Settings, User, Key, Bell, Palette, Database, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";

export default function SettingsPage() {
  const [autoApprove, setAutoApprove] = useState(90);
  const [reviewThreshold, setReviewThreshold] = useState(70);
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [autoRetrain, setAutoRetrain] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user profile from API
  const { data: user, isLoading: isUserLoading } = useQuery({
    queryKey: ["auth-me"],
    queryFn: authApi.me,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save delay
    await new Promise(r => setTimeout(r, 800));
    setIsSaving(false);
    alert("Settings saved successfully!");
  };

  return (
    <AppShell breadcrumbs={[{ label: "Settings" }]}>
      <div style={{ padding: "24px", maxWidth: 720 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>Settings</h1>

        {/* Profile */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <User size={16} style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Profile</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Name</label>
              <input 
                className="input-field" 
                value={isUserLoading ? "Loading..." : name} 
                onChange={(e) => setName(e.target.value)}
                disabled={isUserLoading}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 5 }}>Email</label>
              <input 
                className="input-field" 
                value={isUserLoading ? "Loading..." : email} 
                readOnly
                disabled
                title="Email cannot be changed"
              />
            </div>
          </div>
        </div>

        {/* Active Learning Thresholds */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Settings size={16} style={{ color: "#f59e0b" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Active Learning Thresholds</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Auto Approve Threshold</span>
                <span style={{ color: "#10b981", fontWeight: 600 }}>≥ {autoApprove}%</span>
              </label>
              <input type="range" min={50} max={100} value={autoApprove} onChange={(e) => setAutoApprove(Number(e.target.value))} style={{ width: "100%", accentColor: "#10b981" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span>Review Required Threshold</span>
                <span style={{ color: "#f59e0b", fontWeight: 600 }}>≥ {reviewThreshold}%</span>
              </label>
              <input type="range" min={20} max={90} value={reviewThreshold} onChange={(e) => setReviewThreshold(Number(e.target.value))} style={{ width: "100%", accentColor: "#f59e0b" }} />
            </div>
            <div style={{ padding: "10px 14px", background: "var(--color-bg-surface)", borderRadius: 8, border: "1px solid var(--color-border)" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6 }}>Preview:</div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="badge badge-green">≥{autoApprove}%: Auto Approve</span>
                <span className="badge badge-yellow">{reviewThreshold}–{autoApprove - 1}%: Review</span>
                <span className="badge badge-red">&lt;{reviewThreshold}%: Manual</span>
              </div>
            </div>
          </div>
        </div>

        {/* Toggles */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Bell size={16} style={{ color: "#8b5cf6" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>Preferences</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "Notifications", desc: "Get notified when training completes", value: notifications, set: setNotifications },
              { label: "Dark Mode", desc: "Use dark theme (recommended)", value: darkMode, set: setDarkMode },
              { label: "Auto Retrain", desc: "Automatically start retraining when new labels are added", value: autoRetrain, set: setAutoRetrain },
            ].map((t) => (
              <div key={t.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{t.desc}</div>
                </div>
                <div
                  onClick={() => t.set(!t.value)}
                  style={{
                    width: 38, height: 20, borderRadius: 10,
                    background: t.value ? "#3b82f6" : "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    position: "relative", cursor: "pointer", transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 14, height: 14, borderRadius: "50%", background: "white",
                      position: "absolute", top: 2,
                      left: t.value ? 20 : 3,
                      transition: "left 0.2s",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="btn-ghost" onClick={() => {
            setAutoApprove(90); setReviewThreshold(70); setNotifications(true); setDarkMode(true); setAutoRetrain(true);
          }}>Reset to Defaults</button>
          <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
"""

with open(r"D:\anotation\frontend\app\settings\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched settings/page.tsx")
