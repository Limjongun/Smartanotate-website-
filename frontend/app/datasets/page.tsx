"use client";

import AppShell from "@/components/layout/AppShell";
import { Database, Plus, ChevronRight, X, Loader2, Upload, Download, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Dataset {
  id: string;
  name: string;
  project_id: string | null;
  total_images: number;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DatasetsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: datasets = [], isLoading } = useQuery<Dataset[]>({
    queryKey: ["datasets"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/datasets`);
      if (!res.ok) throw new Error("Failed to fetch datasets");
      return res.json();
    },
  });

  
  const handleDownload = async (datasetId: string, datasetName: string) => {
    try {
      setDownloadingId(datasetId);
      const res = await fetch(`${API_BASE}/datasets/${datasetId}/export`);
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${datasetName.replace(/\s+/g, "_")}_export.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert("Failed to download dataset: " + err);
    } finally {
      setDownloadingId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_BASE}/datasets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to create dataset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setShowModal(false);
      setNewDatasetName("");
    },
  });

  return (
    <AppShell breadcrumbs={[{ label: "Datasets" }]}>
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)" }}>Datasets</h1>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={15} /> New Dataset
          </button>
        </div>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Loader2 size={30} className="animate-spin text-muted" />
          </div>
        ) : (
          <div className="glass-card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
                  {["Name", "Project", "Images", "Created", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasets.map((ds) => (
                  <tr key={ds.id} style={{ borderBottom: "1px solid var(--color-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-surface)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 13, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Database size={14} style={{ color: "#3b82f6" }} />{ds.name}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>
                      {ds.project_id ? (
                        <span className="badge badge-blue">Project {ds.project_id}</span>
                      ) : (
                        <span className="badge" style={{ background: "var(--color-bg-surface)", color: "var(--color-text-muted)" }}>Standalone</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-text-secondary)" }}>{ds.total_images.toLocaleString("en-US")}</td>
                    <td style={{ padding: "12px 16px", fontSize: 11, color: "var(--color-text-muted)" }}>{ds.created_at}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Link href={`/datasets/${ds.id}`}>
                          <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                            Buka Dataset
                          </button>
                        </Link>
                        <Link href={`/datasets/${ds.id}`}>
                          <button className="btn-primary" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                            <Upload size={14} /> Upload Gambar
                          </button>
                        </Link>
                        <button 
                          className="btn-secondary" 
                          style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                          onClick={() => handleDownload(ds.id, ds.name)}
                          disabled={downloadingId === ds.id}
                        >
                          {downloadingId === ds.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                          {downloadingId === ds.id ? "Saving..." : "Save Dataset"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
                      No datasets found. Create one to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div className="glass-card" style={{ width: 400, padding: 24, position: "relative" }}>
            <button
              onClick={() => setShowModal(false)}
              style={{ position: "absolute", top: 16, right: 16, background: "transparent", border: "none", color: "var(--color-text-muted)", cursor: "pointer" }}
            >
              <X size={18} />
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>Create New Dataset</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 6 }}>Dataset Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="e.g. Traffic Camera Data"
                  autoFocus
                />
              </div>
              <button
                className="btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
                onClick={() => {
                  if (newDatasetName.trim()) createMutation.mutate(newDatasetName);
                }}
                disabled={createMutation.isPending || !newDatasetName.trim()}
              >
                {createMutation.isPending ? "Creating..." : "Create Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
