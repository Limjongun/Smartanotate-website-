import AppShell from "@/components/layout/AppShell";
import Link from "next/link";
import { MousePointerClick, FolderOpen } from "lucide-react";

export default function SegmentAnnotateIndex() {
  return (
    <AppShell breadcrumbs={[{ label: "Segment Annotate" }]}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "80vh", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <MousePointerClick size={32} style={{ color: "#3b82f6" }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 12 }}>
          Select an Image for Segmentation
        </h1>
        <p style={{ fontSize: 14, color: "var(--color-text-secondary)", maxWidth: 400, marginBottom: 32 }}>
          The segmentation workspace requires a specific image. Please select a project or dataset, then click on an image to start segmenting.
        </p>
        <Link href="/projects" style={{ textDecoration: "none" }}>
          <button className="btn-primary" style={{ padding: "10px 24px", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={18} /> Go to Projects
          </button>
        </Link>
      </div>
    </AppShell>
  );
}
