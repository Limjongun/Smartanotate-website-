"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  Database,
  Images,
  Pencil,
  Zap,
  Activity,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  Cpu,
  BookOpen,
  PersonStanding,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",      label: "Dashboard",       icon: LayoutDashboard },
  { href: "/projects",       label: "Projects",        icon: FolderOpen      },
  { href: "/datasets",       label: "Datasets",        icon: Database        },
  { href: "/augmentation",   label: "Augmentation",    icon: Images          },
  { href: "/annotate",       label: "Annotate",        icon: Pencil          },
  { href: "/segment-annotate",label: "Segment Annotate", icon: Pencil          },
  { href: "/pose-annotate",  label: "Pose Annotate",   icon: PersonStanding  },
  { href: "/auto-annotation",label: "Auto Annotation", icon: Bot             },
  { href: "/guidelines",     label: "Guidelines",      icon: BookOpen        },
  { href: "/analytics",      label: "Analytics",       icon: BarChart2       },
  { href: "/settings",       label: "Settings",        icon: Settings        },
];

interface SidebarProps {
  storage?: { used: number; total: number };
  datasetProgress?: { annotated: number; remaining: number; total: number };
}

export default function Sidebar({ storage, datasetProgress }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const pct = datasetProgress
    ? Math.round((datasetProgress.annotated / datasetProgress.total) * 100)
    : 49;
  const storageUsed = storage ? Math.round((storage.used / storage.total) * 100) : 26;

  return (
    <aside
      className="sidebar"
      style={{
        width: collapsed ? 64 : 200,
        minWidth: collapsed ? 64 : 200,
        background: "var(--color-bg-secondary)",
        borderRight: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        transition: "width 0.25s ease",
        overflow: "hidden",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: "16px 12px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--color-border)",
          minHeight: 60,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontWeight: 800,
            fontSize: 16,
            color: "white",
          }}
        >
          S
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>
              SmartAnnotate
            </div>
            <div style={{ fontSize: 10, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
              AI Platform
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", overflow: "auto" }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} style={{ textDecoration: "none" }}>
              <div
                className="nav-link"
                style={{
                  ...(active
                    ? {
                        background: "rgba(59,130,246,0.12)",
                        color: "#60a5fa",
                      }
                    : {}),
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? "9px 0" : "9px 12px",
                }}
                title={collapsed ? label : undefined}
              >
                <Icon size={17} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>



      {/* Storage */}
      {!collapsed && (
        <div
          style={{
            padding: "10px 14px 12px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 6 }}>
            <span>Storage</span>
            <span>{storage ? `${storage.used} GB / ${storage.total} GB` : "128.4 GB / 500 GB"}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: `${storageUsed}%`, background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="btn-icon"
        style={{
          position: "absolute",
          top: 20,
          right: -12,
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: "50%",
          width: 22,
          height: 22,
          zIndex: 20,
        }}
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
