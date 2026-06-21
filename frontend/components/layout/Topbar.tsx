"use client";

import { Bell, Sun, Moon, HelpCircle, ChevronRight } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

interface TopbarProps {
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
  title?: string;
}

export default function Topbar({ breadcrumbs, actions, title }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <header
      style={{
        height: 56,
        background: "var(--color-bg-secondary)",
        borderBottom: "1px solid var(--color-border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumbs */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
        {breadcrumbs?.map((b, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {i > 0 && <ChevronRight size={13} style={{ color: "var(--color-text-muted)" }} />}
            <span
              style={{
                fontSize: 13,
                fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                color:
                  i === breadcrumbs.length - 1
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                cursor: b.href ? "pointer" : "default",
              }}
            >
              {b.label}
            </span>
          </span>
        ))}
        {title && !breadcrumbs && (
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>
            {title}
          </span>
        )}
      </div>

      {/* Actions slot */}
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{actions}</div>}

      {/* Right icons */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
        <button className="btn-icon" title="Toggle theme" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="btn-icon" title="Help">
          <HelpCircle size={16} />
        </button>
        <button className="btn-icon" title="Notifications" style={{ position: "relative" }}>
          <Bell size={16} />
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#3b82f6",
              border: "2px solid var(--color-bg-secondary)",
            }}
          />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 8,
            cursor: "pointer",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-surface)",
            marginLeft: 4,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "white",
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
              Admin
            </div>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>
              Local User
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
