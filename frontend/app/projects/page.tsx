"use client";

import { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Plus, Search, Grid, List, MoreVertical,
  Images, Target, Calendar, Pencil, Trash2, Copy,
  FolderOpen, ChevronRight, Loader2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, Project } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: "Active",     color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  completed: { label: "Completed",  color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  training:  { label: "Training",   color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  new:       { label: "New",        color: "#6b7280", bg: "rgba(107,114,128,0.15)" },
};

const CLASS_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899"];

interface CreateModalProps {
  onClose: () => void;
  onCreate: (data: { name: string; description: string; classes: string[] }) => void;
  isLoading: boolean;
}

function CreateModal({ onClose, onCreate, isLoading }: CreateModalProps) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [classInput, setClassInput] = useState("");
  const [classes, setClasses] = useState<string[]>([]);

  const addClass = () => {
    const trimmed = classInput.trim().toLowerCase().replace(/\s+/g, "_");
    if (trimmed && !classes.includes(trimmed)) {
      setClasses([...classes, trimmed]);
      setClassInput("");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>
          Create New Project
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Project Name *
          </label>
          <input
            className="input-field"
            placeholder="e.g. Vehicle Detection"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Description
          </label>
          <textarea
            className="input-field"
            placeholder="Describe your project..."
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={2}
            style={{ resize: "vertical" }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Classes / Labels
          </label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="input-field"
              placeholder="Add class name (e.g. car)"
              value={classInput}
              onChange={(e) => setClassInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addClass()}
              style={{ flex: 1 }}
            />
            <button className="btn-primary" onClick={addClass}>
              <Plus size={14} />
            </button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {classes.map((cls, i) => (
              <span
                key={cls}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  background: `${CLASS_COLORS[i % CLASS_COLORS.length]}20`,
                  border: `1px solid ${CLASS_COLORS[i % CLASS_COLORS.length]}40`,
                  color: CLASS_COLORS[i % CLASS_COLORS.length],
                }}
              >
                {cls}
                <button
                  onClick={() => setClasses(classes.filter((c) => c !== cls))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose} disabled={isLoading}>Cancel</button>
          <button
            className="btn-primary"
            disabled={isLoading || !name.trim()}
            onClick={() => {
              if (name.trim()) {
                onCreate({ name: name.trim(), description: desc, classes });
              }
            }}
          >
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showCreate, setShowCreate] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowCreate(false);
      router.push(`/projects/${newProject.id}`);
    },
  });

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell
      breadcrumbs={[{ label: "Projects" }]}
      topbarActions={
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Project
        </button>
      }
    >
      <div style={{ padding: "24px" }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
            Projects
          </h1>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            {projects.length} projects · Manage your annotation datasets and models
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <Search
              size={14}
              style={{
                position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)",
                color: "var(--color-text-muted)",
              }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: 32 }}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div
            style={{
              display: "flex",
              background: "var(--color-bg-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                className="btn-icon"
                onClick={() => setView(v)}
                style={{
                  borderRadius: 0,
                  background: view === v ? "var(--color-bg-card)" : "transparent",
                  color: view === v ? "var(--color-text-primary)" : "var(--color-text-muted)",
                }}
              >
                {v === "grid" ? <Grid size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={30} className="animate-spin" style={{ color: "var(--color-text-muted)" }} />
          </div>
        ) : view === "grid" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
              gap: 16,
            }}
          >
            {/* New project card */}
            <div
              className="glass-card"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                border: "2px dashed var(--color-border)",
                background: "transparent",
                minHeight: 200,
                gap: 10,
                transition: "border-color 0.15s",
              }}
              onClick={() => setShowCreate(true)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "rgba(59,130,246,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Plus size={22} style={{ color: "#3b82f6" }} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)" }}>
                New Project
              </span>
            </div>

            {filtered.map((p) => {
              const pct = p.total_images > 0 ? Math.round((p.annotated_images / p.total_images) * 100) : 0;
              const st = STATUS_CONFIG[p.status || "new"] || STATUS_CONFIG.new;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} style={{ textDecoration: "none" }}>
                  <div
                    className="glass-card animate-fade-in"
                    style={{ padding: 18, cursor: "pointer", transition: "transform 0.15s, border-color 0.15s" }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-accent)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)";
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <div
                        style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <FolderOpen size={20} style={{ color: "#60a5fa" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          className="badge"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                        <button
                          className="btn-icon"
                          onClick={(e) => e.preventDefault()}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
                      {p.name}
                    </h3>
                    <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 14, lineHeight: 1.5, height: 36, overflow: "hidden" }}>
                      {p.description || "No description"}
                    </p>

                    {/* Classes */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14, height: 22, overflow: "hidden" }}>
                      {(p.classes || []).slice(0, 4).map((cls, i) => (
                        <span
                          key={cls}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "2px 7px", borderRadius: 10, fontSize: 11,
                            background: `${CLASS_COLORS[i % CLASS_COLORS.length]}15`,
                            color: CLASS_COLORS[i % CLASS_COLORS.length],
                          }}
                        >
                          <span
                            style={{
                              width: 5, height: 5, borderRadius: "50%",
                              background: CLASS_COLORS[i % CLASS_COLORS.length],
                            }}
                          />
                          {cls}
                        </span>
                      ))}
                      {(p.classes || []).length > 4 && (
                        <span style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "2px 6px" }}>
                          +{(p.classes || []).length - 4}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="progress-bar" style={{ marginBottom: 8 }}>
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Images size={11} /> {(p.total_images || 0).toLocaleString("en-US")} images
                      </span>
                      <span>{pct}% annotated</span>
                    </div>

                    {/* Footer */}
                    <div className="divider" />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--color-text-muted)" }}>
                        <Calendar size={11} /> {p.created_at}
                      </div>
                      {p.model_accuracy && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981" }}>
                          <Target size={11} /> mAP {(p.model_accuracy * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
                  {["Project", "Status", "Images", "Progress", "Accuracy", "Created", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px", fontSize: 11, fontWeight: 600,
                        color: "var(--color-text-muted)", textAlign: "left", letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const pct = p.total_images > 0 ? Math.round((p.annotated_images / p.total_images) * 100) : 0;
                  const st = STATUS_CONFIG[p.status || "new"] || STATUS_CONFIG.new;
                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: "1px solid var(--color-border)",
                        transition: "background 0.1s",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-surface)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      onClick={() => router.push(`/projects/${p.id}`)}
                    >
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{(p.description || "").slice(0, 40)}...</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                        {(p.total_images || 0).toLocaleString("en-US")}
                      </td>
                      <td style={{ padding: "12px 16px", minWidth: 120 }}>
                        <div className="progress-bar" style={{ marginBottom: 4 }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{pct}%</div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12 }}>
                        {p.model_accuracy ? (
                          <span style={{ color: "#10b981" }}>{(p.model_accuracy * 100).toFixed(1)}%</span>
                        ) : (
                          <span style={{ color: "var(--color-text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-muted)" }}>
                        {p.created_at}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button className="btn-icon" title="Edit" onClick={(e) => e.stopPropagation()}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn-icon" title="Duplicate" onClick={(e) => e.stopPropagation()}>
                            <Copy size={13} />
                          </button>
                          <button className="btn-icon" title="Delete" onClick={(e) => e.stopPropagation()}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          isLoading={createMutation.isPending}
          onClose={() => setShowCreate(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}
    </AppShell>
  );
}
