"use client";

import AppShell from "@/components/layout/AppShell";
import { Upload, ArrowLeft, Image as ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function DatasetDetailPage() {
  const params = useParams();
  const id = params.datasetId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all datasets to find this one's details (or could have a dedicated endpoint)
  const { data: datasets = [], isLoading: isLoadingDs } = useQuery({
    queryKey: ["datasets"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/datasets`);
      if (!res.ok) throw new Error("Failed to fetch datasets");
      return res.json();
    },
  });

  const dataset = datasets.find((d: any) => d.id === id);

  const { data: images = [], isLoading: isLoadingImgs, refetch: refetchImages } = useQuery({
    queryKey: ["dataset-images", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/images/${id}`);
      if (!res.ok) throw new Error("Failed to fetch images");
      return res.json();
    },
    enabled: !!id,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploading(true);
    
    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append("files", e.target.files[i]);
    }
    
    try {
      const res = await fetch(`${API_BASE}/datasets/${id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["dataset-images", id] });
        queryClient.invalidateQueries({ queryKey: ["datasets"] });
      } else {
        console.error("Upload failed");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoadingDs) {
    return (
      <AppShell breadcrumbs={[{ label: "Datasets", href: "/datasets" }, { label: "Loading..." }]}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 50 }}>
          <Loader2 size={30} className="animate-spin text-muted" />
        </div>
      </AppShell>
    );
  }

  if (!dataset) {
    return (
      <AppShell breadcrumbs={[{ label: "Datasets", href: "/datasets" }, { label: "Not Found" }]}>
        <div style={{ padding: 40, textAlign: "center" }}>Dataset not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[{ label: "Datasets", href: "/datasets" }, { label: dataset.name }]}>
      <div style={{ padding: "24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Link href="/datasets">
                <button className="btn-icon"><ArrowLeft size={16} /></button>
              </Link>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>{dataset.name}</h1>
              {dataset.project_id ? (
                <span className="badge badge-blue">Linked to Project {dataset.project_id}</span>
              ) : (
                <span className="badge" style={{ background: "var(--color-bg-surface)", color: "var(--color-text-muted)" }}>Standalone Dataset</span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginLeft: 44 }}>
              Created on {dataset.created_at} &bull; {images.length} images
            </p>
          </div>
          
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="file"
              multiple
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button className="btn-primary" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {isUploading ? "Uploading..." : "Upload Images"}
            </button>
          </div>
        </div>

        {/* Images Grid */}
        <div className="glass-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>
            Images
          </h2>
          
          {isLoadingImgs ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
              <Loader2 size={30} className="animate-spin text-muted" />
            </div>
          ) : images.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", border: "1px dashed var(--color-border)", borderRadius: 12 }}>
              <ImageIcon size={40} style={{ color: "var(--color-text-muted)", margin: "0 auto 12px", opacity: 0.5 }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>No images yet</p>
              <p style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Upload some images to start building your dataset.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
              {images.map((img: any) => (
                <Link href={`/datasets/${id}/preview/${img.id}`} key={img.id}>
                  <div className="image-card" style={{ cursor: "pointer", transition: "transform 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"} onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}>
                    <div className="image-card-img" style={{ backgroundImage: `url(${img.url})`, aspectRatio: "4/3", backgroundSize: "cover", backgroundPosition: "center" }} />
                    <div className="image-card-content" style={{ padding: "10px 12px" }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {img.filename}
                      </p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <span className={`badge ${img.status === "annotated" ? "badge-green" : "badge-gray"}`} style={{ fontSize: 10 }}>
                          {img.status === "annotated" ? "Annotated" : "Unannotated"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
