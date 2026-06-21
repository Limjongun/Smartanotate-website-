"use client";

import AppShell from "@/components/layout/AppShell";
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, Loader2, Layers } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface BBox { x: number; y: number; w: number; h: number }
interface Point { x: number; y: number }
interface AnnotationObj {
  id: string;
  classId: number;
  className: string;
  type: "bbox" | "polygon" | "segmentation";
  bbox?: BBox;
  polygon?: Point[];
  confidence?: number;
  source: string;
  visible: boolean;
  selected: boolean;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#14b8a6", "#f97316"];

export default function DatasetImagePreview() {
  const params = useParams();
  const datasetId = params.datasetId as string;
  const imageId = params.imageId as string;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showMasks, setShowMasks] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Fetch Image Details
  const { data: imgDetail, isLoading: imgLoading } = useQuery({
    queryKey: ["image", imageId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/images/detail/${imageId}`);
      if (!res.ok) throw new Error("Failed to fetch image");
      return res.json();
    },
  });

  // Fetch Annotations
  const { data: rawAnns = [], isLoading: annsLoading } = useQuery({
    queryKey: ["annotations", imageId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/annotations/${imageId}`);
      if (!res.ok) throw new Error("Failed to fetch annotations");
      return res.json();
    },
  });

  const [annotations, setAnnotations] = useState<AnnotationObj[]>([]);
  const [projectClasses, setProjectClasses] = useState<{id: number, name: string, color: string}[]>([]);

  // We need to fetch the project classes if this dataset is linked to a project
  const projectId = imgDetail?.project_id;
  const { data: project } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      return res.json();
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (project?.classes) {
      setProjectClasses(project.classes);
    }
  }, [project]);

  useEffect(() => {
    if (rawAnns.length > 0) {
      setAnnotations(rawAnns.map((a: any) => ({
        id: a.id,
        classId: a.class_id,
        className: a.class_name,
        type: a.type || "bbox",
        bbox: a.bbox,
        polygon: a.polygon,
        confidence: a.confidence,
        source: a.source,
        visible: true,
        selected: false,
      })));
    }
  }, [rawAnns]);

  // Canvas drawing
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw image
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Draw annotations
    annotations.filter(a => a.visible).forEach((ann) => {
      const cls = projectClasses.find((c) => c.id === ann.classId) || projectClasses[0];
      const color = cls?.color || COLORS[ann.classId % COLORS.length] || "#3b82f6";
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      if (ann.type === "polygon" && ann.polygon && ann.polygon.length > 0) {
        ctx.beginPath();
        ctx.moveTo(ann.polygon[0].x * canvas.width, ann.polygon[0].y * canvas.height);
        for (let i = 1; i < ann.polygon.length; i++) {
          ctx.lineTo(ann.polygon[i].x * canvas.width, ann.polygon[i].y * canvas.height);
        }
        ctx.closePath();
        if (showMasks) {
          ctx.fillStyle = color + "40";
          ctx.fill();
        }
        ctx.stroke();

        // Label
        const minX = Math.min(...ann.polygon.map(p => p.x * canvas.width));
        const minY = Math.min(...ann.polygon.map(p => p.y * canvas.height));
        ctx.fillStyle = color;
        ctx.fillRect(minX, minY - 16, ctx.measureText(ann.className).width + 8, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText(ann.className, minX + 4, minY - 4);
        
      } else if (ann.type === "bbox" && ann.bbox) {
        const x = ann.bbox.x * canvas.width;
        const y = ann.bbox.y * canvas.height;
        const w = ann.bbox.w * canvas.width;
        const h = ann.bbox.h * canvas.height;

        if (showMasks) {
          ctx.fillStyle = color + "20";
          ctx.fillRect(x, y, w, h);
        }
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = color;
        ctx.fillRect(x, y - 16, ctx.measureText(ann.className).width + 8, 16);
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText(ann.className, x + 4, y - 4);
      }
    });

    ctx.restore();
  }, [annotations, pan, zoom, projectClasses, showMasks]);

  useEffect(() => {
    if (!imgDetail?.url) return;
    const img = new Image();
    img.src = imgDetail.url;
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
  }, [imgDetail?.url, draw]);

  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan((prev) => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
      draw();
    }
  };
  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const zoomSensitivity = 0.001;
      const zoomDelta = e.deltaY * -zoomSensitivity;
      setZoom((z) => Math.min(Math.max(0.1, z + zoomDelta), 5));
    }
  };

  if (imgLoading || annsLoading) {
    return (
      <AppShell breadcrumbs={[{ label: "Datasets", href: "/datasets" }, { label: "Preview" }]}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", padding: 50 }}>
          <Loader2 size={30} className="animate-spin text-muted" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumbs={[
      { label: "Datasets", href: "/datasets" },
      { label: "Dataset", href: `/datasets/${datasetId}` },
      { label: imgDetail?.filename || "Preview" }
    ]}>
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href={`/datasets/${datasetId}`}>
              <button className="btn-icon"><ArrowLeft size={16} /></button>
            </Link>
            <h1 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>{imgDetail?.filename} (Preview)</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/annotate/${imgDetail?.id}`} style={{ textDecoration: "none" }}>
              <button className="btn-secondary" style={{ padding: "4px 12px", fontSize: 12 }}>
                Annotate
              </button>
            </Link>
            <Link href={`/segment-annotate/${imgDetail?.id}`} style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "4px 12px", fontSize: 12 }}>
                Segment
              </button>
            </Link>
            <div style={{ width: 1, height: 24, background: "var(--color-border)", margin: "0 4px" }} />
            <button className={`btn-icon ${showMasks ? "active" : ""}`} onClick={() => setShowMasks(!showMasks)} title="Toggle Masks">
              <Layers size={16} />
            </button>
            <div style={{ width: 1, height: 24, background: "var(--color-border)", margin: "0 4px" }} />
            <button className="btn-icon" onClick={() => setZoom(z => Math.max(0.1, z - 0.2))}><ZoomOut size={16} /></button>
            <div style={{ display: "flex", alignItems: "center", fontSize: 12, width: 40, justifyContent: "center", fontWeight: 500 }}>
              {Math.round(zoom * 100)}%
            </div>
            <button className="btn-icon" onClick={() => setZoom(z => Math.min(5, z + 0.2))}><ZoomIn size={16} /></button>
            <button className="btn-icon" onClick={() => { setZoom(1); setPan({x:0, y:0}); }}><Maximize2 size={16} /></button>
          </div>
        </div>

        <div 
          ref={containerRef}
          style={{ flex: 1, background: "#0a0a0a", position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : "grab" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: `translate(-50%, -50%)`,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 20px 40px rgba(0,0,0,0.5)"
          }}>
            <canvas 
              ref={canvasRef}
              width={imgDetail?.width || 800}
              height={imgDetail?.height || 600}
              style={{ display: "block" }}
            />
          </div>
        </div>

      </div>
    </AppShell>
  );
}
