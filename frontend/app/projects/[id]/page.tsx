"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import {
  Upload, Plus, Zap, Download, Settings,
  Images as ImagesIcon, Target, Activity, MoreVertical,
  ChevronLeft, ChevronRight, Filter, Grid, List, Loader2,
  Database, X
} from "lucide-react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, datasetsApi, imagesApi, Project, ImageItem } from "@/lib/api";
import { useProjectStore } from "@/store/projectStore";

const CLASS_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#06b6d4"];

const STATUS_COLORS: Record<string, string> = {
  annotated: "#10b981",
  unannotated: "#6b7280",
  auto_approved: "#3b82f6",
  review_required: "#f59e0b",
  skipped: "#ef4444",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filterStatus, setFilterStatus] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const perPage = 18;

  const [showImportModal, setShowImportModal] = useState(false);

  const { setActiveProject } = useProjectStore();

  useEffect(() => {
    if (id) {
      setActiveProject(id);
    }
  }, [id, setActiveProject]);

  // Queries
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
    enabled: !!id,
  });

  // Fetch datasets
  const { data: datasets = [] } = useQuery({
    queryKey: ["datasets", id],
    queryFn: () => datasetsApi.list(id),
    enabled: !!id,
  });

  const activeDatasetId = datasets.length > 0 ? datasets[0].id : null;

  // Fetch images
  const { data: images = [], isLoading: isImagesLoading } = useQuery({
    queryKey: ["project-images", id],
    queryFn: () => imagesApi.listByProject(id),
    enabled: !!id,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      if (!activeDatasetId) throw new Error("No dataset selected");
      return imagesApi.upload(activeDatasetId, files);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-images", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
  });

  const { data: globalDatasets = [], isLoading: globalDatasetsLoading } = useQuery({
    queryKey: ["globalDatasets"],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/datasets`);
      if (!res.ok) throw new Error("Failed to fetch global datasets");
      return res.json();
    },
    enabled: showImportModal,
  });

  const importMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/datasets/${datasetId}/link`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: id })
      });
      if (!res.ok) throw new Error("Failed to link dataset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", id] });
      queryClient.invalidateQueries({ queryKey: ["project-images", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setShowImportModal(false);
    }
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMutation.mutate(Array.from(e.target.files));
    }
  }, [uploadMutation, id]);

  if (isProjectLoading || !project) {
    return (
      <AppShell breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: "Loading..." }]}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
          <Loader2 size={30} className="animate-spin text-muted" />
        </div>
      </AppShell>
    );
  }

  const pct = project.total_images > 0 ? Math.round((project.annotated_images / project.total_images) * 100) : 0;

  const filtered = filterStatus === "all"
    ? images
    : images.filter((i) => i.status === filterStatus);

  const paged = filtered.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(filtered.length / perPage);

  return (
    <AppShell
      breadcrumbs={[
        { label: "Projects", href: "/projects" },
        { label: project.name },
      ]}
      topbarActions={
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            className="btn-primary" 
            style={{ fontSize: 12, background: "linear-gradient(135deg, #10b981, #3b82f6)", border: "none" }}
            onClick={async () => {
              try {
                await projectsApi.downloadZip(project.id, project.name);
              } catch (err) {
                alert("Failed to download project zip");
              }
            }}
          >
            <Download size={14} /> Ready-to-Train ZIP
          </button>
          <button className="btn-ghost" style={{ fontSize: 12 }}>
            <Settings size={14} /> Settings
          </button>
          <Link href={`/auto-annotation`}>
            <button className="btn-primary" style={{ fontSize: 12 }}>
              <Zap size={14} /> Auto Annotate
            </button>
          </Link>
        </div>
      }
    >
      <div style={{ padding: "24px" }}>

        {/* Project header */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 4 }}>
                {project.name}
              </h1>
              <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                {project.description || "No description"}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(project.classes || []).map((cls, i) => (
                  <span
                    key={cls}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 20, fontSize: 12,
                      background: `${CLASS_COLORS[i % CLASS_COLORS.length]}20`,
                      color: CLASS_COLORS[i % CLASS_COLORS.length],
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                    {cls}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 120px)", gap: 12 }}>
              {[
                { label: "Total Images", value: (project.total_images || 0).toLocaleString("en-US"), color: "#3b82f6", icon: ImagesIcon },
                { label: "Model Accuracy", value: project.model_accuracy ? `${(project.model_accuracy * 100).toFixed(1)}%` : "—", color: "#10b981", icon: Target },
                { label: "Active Model", value: project.active_model || "—", color: "#8b5cf6", icon: Activity },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    padding: "12px",
                    background: "var(--color-bg-surface)",
                    borderRadius: 10,
                    border: "1px solid var(--color-border)",
                    textAlign: "center",
                  }}
                >
                  <stat.icon size={18} style={{ color: stat.color, marginBottom: 6 }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)" }}>{stat.value}</div>
                  <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 6 }}>
              <span>Annotation Progress</span>
              <span style={{ fontWeight: 600, color: "#60a5fa" }}>
                {(project.annotated_images || 0).toLocaleString("en-US")} / {(project.total_images || 0).toLocaleString("en-US")} ({pct}%)
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {[
                { label: "Auto Approved", count: images.filter(i => i.status === "auto_approved").length, color: "#3b82f6" },
                { label: "Annotated", count: project.annotated_images || 0, color: "#10b981" },
                { label: "Review Needed", count: images.filter(i => i.status === "review_required").length, color: "#f59e0b" },
                { label: "Unannotated", count: (project.total_images || 0) - (project.annotated_images || 0), color: "#6b7280" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--color-text-secondary)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                  {s.label} ({s.count})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Images section */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["all", "unannotated", "annotated", "auto_approved", "review_required"].map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1); }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  border: "1px solid",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  borderColor: filterStatus === s ? "var(--color-accent)" : "var(--color-border)",
                  background: filterStatus === s ? "rgba(59,130,246,0.1)" : "transparent",
                  color: filterStatus === s ? "#60a5fa" : "var(--color-text-secondary)",
                }}
              >
                {s === "all" ? "All" : s.replace("_", " ")}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-secondary"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}
              onClick={() => setShowImportModal(true)}
            >
              <Database size={14} /> Import Dataset
            </button>
            <label
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: activeDatasetId ? "var(--color-accent)" : "var(--color-bg-card)",
                color: activeDatasetId ? "white" : "var(--color-text-muted)",
                cursor: activeDatasetId ? "pointer" : "not-allowed",
                opacity: uploadMutation.isPending ? 0.7 : 1,
              }}
              title={!activeDatasetId ? "Please import a dataset first" : ""}
            >
              {uploadMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} 
              {uploadMutation.isPending ? "Uploading..." : "Upload Images"}
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleFileUpload} 
                disabled={uploadMutation.isPending || !activeDatasetId} 
                style={{ display: "none" }} 
              />
            </label>
            <div style={{ display: "flex", background: "var(--color-bg-surface)", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }}>
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
                  {v === "grid" ? <Grid size={14} /> : <List size={14} />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Image Grid */}
        {isImagesLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader2 size={24} className="animate-spin text-muted" />
          </div>
        ) : view === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
            {paged.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, color: "var(--color-text-muted)" }}>
                No images found.
              </div>
            )}
            {paged.map((img) => (
              <Link key={img.id} href={`/annotate/${img.id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    position: "relative",
                    borderRadius: 8,
                    overflow: "hidden",
                    border: "2px solid",
                    borderColor: STATUS_COLORS[img.status || "unannotated"] + "60",
                    cursor: "pointer",
                    transition: "border-color 0.15s, transform 0.15s",
                    aspectRatio: "3/2",
                    background: "var(--color-bg-surface)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = STATUS_COLORS[img.status || "unannotated"];
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.transform = "scale(1)";
                    (e.currentTarget as HTMLDivElement).style.borderColor = STATUS_COLORS[img.status || "unannotated"] + "60";
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.filename}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    loading="lazy"
                  />
                  {/* Status badge */}
                  <div
                    style={{
                      position: "absolute", top: 4, right: 4,
                      width: 8, height: 8, borderRadius: "50%",
                      background: STATUS_COLORS[img.status || "unannotated"],
                      boxShadow: `0 0 4px ${STATUS_COLORS[img.status || "unannotated"]}`,
                    }}
                  />
                  {/* Filename */}
                  <div
                    style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      padding: "6px 6px 4px",
                      background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                      fontSize: 10, color: "white",
                    }}
                  >
                    {img.filename.slice(-14)}
                  </div>
                  {img.annotation_count > 0 && (
                    <div
                      style={{
                        position: "absolute", top: 4, left: 4,
                        background: "rgba(0,0,0,0.6)", borderRadius: 4,
                        padding: "1px 5px", fontSize: 10, color: "white",
                      }}
                    >
                      {img.annotation_count}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: "hidden", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
                  {["#", "Filename", "Status", "Annotations", "Split", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textAlign: "left" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((img, i) => (
                  <tr
                    key={img.id}
                    style={{ borderBottom: "1px solid var(--color-border)", cursor: "pointer", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-surface)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    onClick={() => router.push(`/annotate/${img.id}`)}
                  >
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-text-muted)" }}>
                      {(page - 1) * perPage + i + 1}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-text-primary)", fontWeight: 500 }}>
                      {img.filename}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLORS[img.status || "unannotated"] }} />
                        <span style={{ color: STATUS_COLORS[img.status || "unannotated"] }}>{(img.status || "unannotated").replace("_", " ")}</span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {img.annotation_count}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="badge badge-blue">{img.split || "train"}</span>
                    </td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 4 }}>
                      <Link href={`/annotate/${img.id}`} style={{ textDecoration: "none" }}>
                        <button className="btn-icon" title="Annotate BBox">
                          <Target size={14} />
                        </button>
                      </Link>
                      <Link href={`/segment-annotate/${img.id}`} style={{ textDecoration: "none" }}>
                        <button className="btn-icon" title="Segment Annotate">
                          <Activity size={14} />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} of {filtered.length} images
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="btn-ghost"
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={14} /> Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page > 3 ? page - 2 + i : i + 1;
                if (p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    style={{
                      width: 32, height: 32, borderRadius: 6, fontSize: 12, cursor: "pointer",
                      border: `1px solid ${page === p ? "var(--color-accent)" : "var(--color-border)"}`,
                      background: page === p ? "rgba(59,130,246,0.15)" : "transparent",
                      color: page === p ? "#60a5fa" : "var(--color-text-secondary)",
                      fontWeight: page === p ? 600 : 400,
                    }}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                className="btn-ghost"
                style={{ padding: "5px 10px", fontSize: 12 }}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showImportModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="glass-card" style={{ width: 500, padding: 24, position: "relative", maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
            <button
              onClick={() => setShowImportModal(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Import Dataset</h2>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>
              Select a standalone dataset to link it to this project.
            </p>
            
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 8 }}>
              {globalDatasetsLoading ? (
                <div style={{ padding: 40, textAlign: "center" }}><Loader2 size={24} className="animate-spin text-muted" style={{ margin: "0 auto" }} /></div>
              ) : globalDatasets.filter((d: any) => !d.project_id).length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>No standalone datasets available.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <tbody>
                    {globalDatasets.filter((d: any) => !d.project_id).map((ds: any) => (
                      <tr key={ds.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)" }}>{ds.name}</div>
                          <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{ds.total_images} images &bull; Created {ds.created_at}</div>
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right" }}>
                          <button
                            className="btn-primary"
                            style={{ fontSize: 11, padding: "4px 10px", minHeight: 28 }}
                            onClick={() => importMutation.mutate(ds.id)}
                            disabled={importMutation.isPending}
                          >
                            {importMutation.isPending ? "Importing..." : "Import"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
