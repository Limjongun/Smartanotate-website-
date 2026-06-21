"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import { Loader2, Layers, Image as ImageIcon, CheckCircle, Database } from "lucide-react";
import AppShell from "@/components/layout/AppShell";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function AnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: analyticsApi.overview,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <AppShell title="Analytics">
      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
            Global Analytics
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            Overview of all projects, datasets, and annotations across the platform.
          </p>
        </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <div className="glass-card stat-card animate-fade-in" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
            <Database size={24} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)" }}>{stats.kpis.total_projects}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Projects</div>
          </div>
        </div>
        
        <div className="glass-card stat-card animate-fade-in" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
            <Layers size={24} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)" }}>{stats.kpis.total_datasets}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Datasets</div>
          </div>
        </div>

        <div className="glass-card stat-card animate-fade-in" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b" }}>
            <ImageIcon size={24} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)" }}>{stats.kpis.total_images}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Images</div>
          </div>
        </div>

        <div className="glass-card stat-card animate-fade-in" style={{ padding: 18, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(139,92,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#8b5cf6" }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)" }}>{stats.kpis.total_annotations}</div>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Annotations</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Class Distribution Chart */}
        <div className="glass-card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 24 }}>Class Distribution</h2>
          <div style={{ height: 400 }}>
            {stats.class_distribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.class_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="var(--color-text-muted)" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis 
                    stroke="var(--color-text-muted)" 
                    fontSize={12} 
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: "var(--color-bg-tertiary)" }}
                    contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-border)", borderRadius: 8, color: "var(--color-text-primary)" }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.class_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>No annotations yet</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Source Distribution */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 24 }}>Annotation Sources</h2>
            <div style={{ height: 200 }}>
              {stats.source_distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.source_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.source_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-border)", borderRadius: 8, color: "var(--color-text-primary)" }}
                    />
                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>No data available</div>
              )}
            </div>
          </div>

          {/* Image Status Distribution */}
          <div className="glass-card" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 24 }}>Image Status</h2>
            <div style={{ height: 200 }}>
              {stats.status_distribution.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.status_distribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.status_distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-border)", borderRadius: 8, color: "var(--color-text-primary)" }}
                    />
                    <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)" }}>No data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  );
}
