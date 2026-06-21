import sys

content = """"use client";

import AppShell from "@/components/layout/AppShell";
import {
  Images, CheckCircle, Clock, Activity,
  TrendingUp, Plus, ArrowRight, Zap, Database,
  Target, BarChart2, Zap as ZapIcon, Pencil
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, projectsApi, autoAnnotateApi } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  completed: "#3b82f6",
  training: "#f59e0b",
  new: "#6b7280",
};

export default function DashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: analyticsApi.overview,
  });

  const { data: projectsData } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const { data: activeTasks } = useQuery({
    queryKey: ["active-tasks"],
    queryFn: autoAnnotateApi.getActiveTasks,
    refetchInterval: 3000,
  });

  const recentProjects = projectsData ? projectsData.slice(0, 4) : [];
  
  // Compute Top Cards
  const totalImages = stats?.kpis?.total_images || 0;
  const statusDist = stats?.status_distribution || [];
  const sourceDist = stats?.source_distribution || [];
  
  const annotated = statusDist.find(s => s.name === "annotated")?.value || 0;
  const autoApproved = statusDist.find(s => s.name === "auto_approved")?.value || 0;
  const unannotated = statusDist.find(s => s.name === "unannotated")?.value || 0;
  
  const manualAnns = sourceDist.find(s => s.name === "manual")?.value || 0;
  
  const totalAnnotatedImages = annotated + autoApproved;

  const STAT_CARDS = [
    {
      label: "Total Images",
      value: totalImages.toLocaleString("en-US"),
      icon: Images,
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.1)",
    },
    {
      label: "Annotated",
      value: totalAnnotatedImages.toLocaleString("en-US"),
      icon: CheckCircle,
      color: "#10b981",
      bg: "rgba(16,185,129,0.1)",
    },
    {
      label: "Unannotated",
      value: unannotated.toLocaleString("en-US"),
      icon: Clock,
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.1)",
    },
    {
      label: "Auto Annotated",
      value: autoApproved.toLocaleString("en-US"),
      icon: ZapIcon,
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.1)",
    },
    {
      label: "Manual Annotations",
      value: manualAnns.toLocaleString("en-US"),
      icon: Pencil,
      color: "#ec4899",
      bg: "rgba(236,72,153,0.1)",
    },
  ];

  return (
    <AppShell title="Dashboard">
      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
              Welcome back 👋
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              Here's an overview of your annotation workspace
            </p>
          </div>
          <Link href="/projects/new">
            <button className="btn-primary">
              <Plus size={15} /> New Project
            </button>
          </Link>
        </div>

        {/* Stat Cards (5 columns) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {STAT_CARDS.map((card) => (
            <div
              key={card.label}
              className="glass-card stat-card animate-fade-in"
              style={{ padding: 18 }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: card.bg,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <card.icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
                {card.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16 }}>

          {/* Recent Projects */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)" }}>
                Recent Projects
              </h2>
              <Link href="/projects">
                <button className="btn-ghost" style={{ fontSize: 12, padding: "5px 10px" }}>
                  View all <ArrowRight size={12} />
                </button>
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentProjects.map((p) => {
                const pct = p.total_images > 0 ? Math.round((p.annotated_images / p.total_images) * 100) : 0;
                const statusStr = p.active_model ? "active" : "new";
                
                return (
                  <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        padding: "14px 16px",
                        background: "var(--color-bg-surface)",
                        borderRadius: 10,
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                        transition: "border-color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 8, height: 8, borderRadius: "50%",
                              background: STATUS_COLORS[statusStr],
                              boxShadow: `0 0 6px ${STATUS_COLORS[statusStr]}`,
                            }}
                          />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                            {p.name}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {p.model_accuracy ? (
                            <span className="badge badge-green">mAP {(p.model_accuracy * 100).toFixed(0)}%</span>
                          ) : null}
                          <span className="badge badge-blue">{statusStr}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="progress-bar" style={{ flex: 1 }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
                          {p.annotated_images.toLocaleString("en-US")} / {p.total_images.toLocaleString("en-US")} ({pct}%)
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {recentProjects.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                  No projects yet. Create one to get started!
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Active Training */}
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Activity size={16} style={{ color: "#f59e0b" }} />
                <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)" }}>
                  Training Activity
                </h2>
                <span className="badge badge-yellow" style={{ marginLeft: "auto" }}>
                  {activeTasks?.length || 0} running
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {activeTasks?.map((job) => (
                  <div
                    key={job.project_id}
                    style={{
                      padding: "12px",
                      background: "var(--color-bg-surface)",
                      borderRadius: 8,
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
                        {job.project_name}
                      </span>
                      <span className="badge badge-purple">{job.model}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 6 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${job.progress}%`,
                          background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-muted)" }}>
                      <span>Images: {job.current}/{job.total}</span>
                      <span>ETA {job.eta}</span>
                    </div>
                  </div>
                ))}
                {(!activeTasks || activeTasks.length === 0) && (
                  <div style={{ padding: 10, textAlign: "center", color: "var(--color-text-muted)", fontSize: 12 }}>
                    No active auto-annotation or training tasks.
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 14 }}>
                Quick Actions
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: Plus, label: "New Project", href: "/projects/new", color: "#3b82f6" },
                  { icon: Zap, label: "Run Auto Annotation", href: "/auto-annotation", color: "#f59e0b" },
                  { icon: BarChart2, label: "View Analytics", href: "/analytics", color: "#8b5cf6" },
                  { icon: Database, label: "Export Dataset", href: "/projects", color: "#10b981" },
                ].map((action) => (
                  <Link key={action.label} href={action.href} style={{ textDecoration: "none" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "9px 12px",
                        background: "var(--color-bg-surface)",
                        borderRadius: 8,
                        border: "1px solid var(--color-border)",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = action.color;
                        e.currentTarget.style.background = `${action.color}10`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--color-border)";
                        e.currentTarget.style.background = "var(--color-bg-surface)";
                      }}
                    >
                      <action.icon size={15} style={{ color: action.color }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
                        {action.label}
                      </span>
                      <ArrowRight size={12} style={{ marginLeft: "auto", color: "var(--color-text-muted)" }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
"""

with open(r"D:\anotation\frontend\app\dashboard\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched dashboard/page.tsx")
