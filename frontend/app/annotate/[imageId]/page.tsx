"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  MousePointer2, Square, Pentagon, Brush, Eraser, Wand2,
  Move, Undo2, Redo2, Save, Download, Eye, EyeOff,
  Plus, Trash2, MoreVertical, CheckCircle, Zap, SkipForward,
  Layers, SlidersHorizontal, Loader2, FileText, X, FileJson, Activity, PersonStanding
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imagesApi, annotationsApi, projectsApi, Annotation, ImageItem } from "@/lib/api";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tool = "select" | "bbox" | "polygon" | "mask" | "brush" | "eraser" | "wand" | "pan" | "zoom";

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
  source: "manual" | "auto" | "reviewed";
  visible: boolean;
  selected: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#14b8a6", "#f97316"];

const TOOLS: { id: Tool; icon: React.ElementType; label: string; key: string }[] = [
  { id: "select",  icon: MousePointer2, label: "Select",     key: "V" },
  { id: "bbox",    icon: Square,        label: "Box",        key: "B" },
  { id: "polygon", icon: Pentagon,      label: "Polygon",    key: "P" },
  { id: "mask",    icon: Layers,        label: "Mask",       key: "M" },
  { id: "brush",   icon: Brush,         label: "Brush",      key: "/" },
  { id: "eraser",  icon: Eraser,        label: "Eraser",     key: "E" },
  { id: "wand",    icon: Wand2,         label: "Magic Wand", key: "W" },
  { id: "pan",     icon: Move,          label: "Pan",        key: "Space" },
  { id: "zoom",    icon: ZoomIn,        label: "Zoom",       key: "Z" },
];

// ─── Annotation Canvas (pure HTML5 Canvas) ──────────────────────────────────

function AnnotationCanvas({
  imageUrl,
  annotations,
  tool,
  zoom,
  classId,
  projectClasses,
  showMasks,
  onAnnotationsChange,
  onSelect,
  setZoom,
}: {
  imageUrl: string;
  annotations: AnnotationObj[];
  tool: Tool;
  zoom: number;
  classId: number;
  projectClasses: { id: number; name: string; color: string }[];
  showMasks: boolean;
  onAnnotationsChange: (anns: AnnotationObj[]) => void;
  onSelect: (id: string | null) => void;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);

  const getCanvasPos = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom - pan.x,
      y: (e.clientY - rect.top) / zoom - pan.y,
    };
  }, [zoom, pan]);

  const getImageLayout = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;
    
    const canvasW = canvas.width / zoom;
    const canvasH = canvas.height / zoom;
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasW / canvasH;
    
    let drawW, drawH, offsetX, offsetY;
    if (imgRatio > canvasRatio) {
      drawW = canvasW;
      drawH = canvasW / imgRatio;
      offsetX = 0;
      offsetY = (canvasH - drawH) / 2;
    } else {
      drawH = canvasH;
      drawW = canvasH * imgRatio;
      offsetX = (canvasW - drawW) / 2;
      offsetY = 0;
    }
    
    return { drawW, drawH, offsetX, offsetY };
  }, [zoom]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(pan.x, pan.y);

    const layout = getImageLayout();
    if (!layout) {
      ctx.restore();
      return;
    }
    const { drawW: W, drawH: H, offsetX, offsetY } = layout;

    // Draw image
    ctx.drawImage(img, offsetX, offsetY, W, H);

    // Draw annotations
    annotations.forEach((ann) => {
      if (!ann.visible) return;
      const cls = projectClasses.find((c) => c.id === ann.classId);
      const color = cls?.color || "#3b82f6";
      const selected = ann.selected;
      const fillAlpha = showMasks ? "40" : "18";

      if (ann.type === "bbox" && ann.bbox) {
        const { x, y, w, h } = ann.bbox;
        const px = offsetX + x * W, py = offsetY + y * H, pw = w * W, ph = h * H;

        // Shadow for selected
        if (selected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = selected ? 2.5 : 1.8;
        ctx.setLineDash([]);
        ctx.strokeRect(px, py, pw, ph);

        // Fill (transparent)
        if (showMasks || selected) {
          ctx.fillStyle = color + fillAlpha;
          ctx.fillRect(px, py, pw, ph);
        }
        ctx.shadowBlur = 0;

        // Corner handles
        const hs = 5;
        ctx.fillStyle = color;
        [[px, py], [px + pw, py], [px, py + ph], [px + pw, py + ph]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
        // Center top/bottom/left/right handles
        [[px + pw / 2, py], [px + pw / 2, py + ph], [px, py + ph / 2], [px + pw, py + ph / 2]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - 3, hy - 3, 6, 6);
        });

        // Label
        const conf = ann.confidence ? ` ${(ann.confidence * 100).toFixed(0)}%` : "";
        const label = `${ann.className}${conf}`;
        ctx.font = "bold 11px Inter, sans-serif";
        const tw = ctx.measureText(label).width;
        const labelY = py - 4 > 12 ? py - 4 : py + 14;
        ctx.fillStyle = color;
        ctx.fillRect(px, labelY - 12, tw + 10, 16);
        ctx.fillStyle = "white";
        ctx.fillText(label, px + 5, labelY);
        ctx.fillText(label, px + 5, labelY);
      } else if (ann.type === "polygon" && ann.polygon) {
        // Draw Polygon
        ctx.strokeStyle = color;
        ctx.fillStyle = color + fillAlpha;
        ctx.lineWidth = selected ? 2.5 : 1.8;
        if (selected) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
        }
        ctx.beginPath();
        ann.polygon.forEach((p, i) => {
          if (i === 0) ctx.moveTo(offsetX + p.x * W, offsetY + p.y * H);
          else ctx.lineTo(offsetX + p.x * W, offsetY + p.y * H);
        });
        ctx.closePath();
        if (showMasks || selected) {
          ctx.fill();
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Polygon handles
        if (selected) {
          ctx.fillStyle = color;
          ann.polygon.forEach((p) => {
            ctx.fillRect(offsetX + p.x * W - 3, offsetY + p.y * H - 3, 6, 6);
          });
        }
        
        // Label at first point
        if (ann.polygon.length > 0) {
          const conf = ann.confidence ? ` ${(ann.confidence * 100).toFixed(0)}%` : "";
          const label = `${ann.className}${conf}`;
          ctx.font = "bold 11px Inter, sans-serif";
          const tw = ctx.measureText(label).width;
          const labelY = offsetY + ann.polygon[0].y * H - 10;
          ctx.fillStyle = color;
          ctx.fillRect(offsetX + ann.polygon[0].x * W, labelY - 12, tw + 10, 16);
          ctx.fillStyle = "white";
          ctx.fillText(label, offsetX + ann.polygon[0].x * W + 5, labelY);
        }
      }
    });

    // Draw current polygon being drawn
    if (tool === "polygon" && currentPolygon.length > 0) {
      const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
      const color = cls?.color || "#3b82f6";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      currentPolygon.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (currentPos) ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // First point handle
      ctx.fillStyle = "white";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(currentPolygon[0].x, currentPolygon[0].y, 5 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Draw current bbox being drawn
    if (drawing && startPos && currentPos && tool === "bbox") {
      const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
      const color = cls?.color || "#3b82f6";
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color + "15";
      ctx.fillRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [annotations, drawing, startPos, currentPos, tool, zoom, pan, classId, projectClasses, currentPolygon, showMasks]);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      draw();
    };
    img.onerror = (err) => {
      console.error("Failed to load image:", imageUrl, err);
    };
  }, [imageUrl]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        draw();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === "pan" || e.button === 1 || e.button === 2) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x * zoom, y: e.clientY - pan.y * zoom });
      return;
    }
    if (tool === "zoom") {
      const zoomFactor = e.altKey || e.shiftKey ? 0.8 : 1.25;
      setZoom((z) => Math.max(0.1, Math.min(10, z * zoomFactor)));
      return;
    }
    const pos = getCanvasPos(e);
    const layout = getImageLayout();
    if (!layout) return;
    const { drawW: W, drawH: H, offsetX, offsetY } = layout;

    if (tool === "select") {
      // Check if clicking on an annotation
      let found: string | null = null;
      for (const ann of [...annotations].reverse()) {
        if (ann.type === "bbox" && ann.bbox) {
          const { x, y, w, h } = ann.bbox;
          if (pos.x >= offsetX + x * W && pos.x <= offsetX + (x + w) * W && pos.y >= offsetY + y * H && pos.y <= offsetY + (y + h) * H) {
            found = ann.id;
            break;
          }
        }
      }
      onSelect(found);
      onAnnotationsChange(annotations.map((a) => ({ ...a, selected: a.id === found })));
      return;
    }

    if (tool === "bbox") {
      setDrawing(true);
      setStartPos(pos);
      setCurrentPos(pos);
    }

    if (tool === "polygon") {
      if (currentPolygon.length >= 3) {
        const first = currentPolygon[0];
        const dist = Math.hypot(pos.x - first.x, pos.y - first.y);
        if (dist < 10 / zoom) {
          // Close polygon
          const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
          const newAnn: AnnotationObj = {
            id: `ann-${Date.now()}`,
            classId: cls.id,
            className: cls.name,
            type: "polygon",
            polygon: currentPolygon.map((p) => ({ x: (p.x - offsetX) / W, y: (p.y - offsetY) / H })),
            source: "manual",
            visible: true,
            selected: true,
          };
          onAnnotationsChange([...annotations.map(a => ({...a, selected: false})), newAnn]);
          setCurrentPolygon([]);
          setDrawing(false);
          onSelect(newAnn.id);
          return;
        }
      }
      setCurrentPolygon([...currentPolygon, pos]);
      setCurrentPos(pos);
      setDrawing(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStart) {
      setPan({
        x: (e.clientX - panStart.x) / zoom,
        y: (e.clientY - panStart.y) / zoom,
      });
      return;
    }
    if (drawing && tool === "bbox") {
      setCurrentPos(getCanvasPos(e));
    }
    if (tool === "polygon" && currentPolygon.length > 0) {
      setCurrentPos(getCanvasPos(e));
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    if (drawing && startPos && currentPos && tool === "bbox") {
      const layout = getImageLayout();
      if (!layout) return;
      const { drawW: W, drawH: H, offsetX, offsetY } = layout;

      const bx = (Math.min(startPos.x, currentPos.x) - offsetX) / W;
      const by = (Math.min(startPos.y, currentPos.y) - offsetY) / H;
      const bw = Math.abs(currentPos.x - startPos.x) / W;
      const bh = Math.abs(currentPos.y - startPos.y) / H;

      if (bw > 0.01 && bh > 0.01) {
        const cls = projectClasses.find((c) => c.id === classId) || projectClasses[0];
        const newAnn: AnnotationObj = {
          id: `ann-${Date.now()}`,
          classId: cls.id,
          className: cls.name,
          type: "bbox",
          bbox: { x: bx, y: by, w: bw, h: bh },
          source: "manual",
          visible: true,
          selected: false,
        };
        onAnnotationsChange([...annotations, newAnn]);
      }
      setDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
    }
  };

  const cursor =
    tool === "pan" || isPanning ? "grab" :
    tool === "zoom" ? "zoom-in" :
    tool === "bbox" ? "crosshair" :
    tool === "polygon" ? "crosshair" :
    tool === "select" ? "default" :
    "default";

  const handleWheel = (e: React.WheelEvent) => {
    if (tool === "zoom" || e.ctrlKey || e.metaKey) {
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.1, Math.min(10, z * zoomDelta)));
    } else {
      setPan((p) => ({ x: p.x - e.deltaX / zoom, y: p.y - e.deltaY / zoom }));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: "#111827" }}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

// ─── Main Annotate Page ──────────────────────────────────────────────────────

export default function AnnotatePage() {
  const { imageId } = useParams();
  const id = imageId as string;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [showMasks, setShowMasks] = useState(true);
  const [annotations, setAnnotations] = useState<AnnotationObj[]>([]);
  const [history, setHistory] = useState<AnnotationObj[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState(0);
  const [saved, setSaved] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Fetch annotation export files list
  const { data: annotationFiles = [], refetch: refetchFiles } = useQuery({
    queryKey: ["annotation-files", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/export/${id}/files`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const handleExportDownload = async (format: "yolo" | "coco") => {
    setShowExportModal(false);
    // 1. Always save annotations to backend first
    const payload = annotations.map((a) => ({
      class_name: a.className,
      class_id: a.classId,
      type: a.type,
      bbox: a.bbox,
      polygon: a.polygon,
      source: a.source,
    }));
    try {
      await annotationsApi.save(id, payload);
      setSaved(true);
    } catch (err) {
      console.error("Save before export failed:", err);
    }
    // 3. Refresh file list
    setTimeout(() => refetchFiles(), 800);
  };

  // 1. Fetch current image details
  const { data: currentImage, isLoading: isImageLoading } = useQuery({
    queryKey: ["image", id],
    queryFn: () => imagesApi.get(id),
    enabled: !!id,
  });

  // 2. Fetch dataset images for the filmstrip
  const datasetId = currentImage?.dataset_id;
  const projectId = currentImage?.project_id;
  const { data: filmStripImages = [] } = useQuery({
    queryKey: ["images", datasetId],
    queryFn: () => imagesApi.list(datasetId!),
    enabled: !!datasetId,
  });

  // Fetch project to get classes
  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const projectClasses = project?.classes.map((name, i) => ({
    id: i,
    name,
    color: COLORS[i % COLORS.length]
  })) || [{ id: 0, name: "default", color: COLORS[0] }];

  // 3. Fetch annotations from backend
  useEffect(() => {
    if (!id) return;
    annotationsApi.get(id).then((anns) => {
      const parsed = anns.map((a) => ({
          ...a,
          visible: true,
          selected: false,
          classId: a.class_id,
          className: a.class_name,
        }));
      setAnnotations(parsed);
      setHistory([parsed]);
      setHistoryStep(0);
      setSaved(true);
    });
  }, [id]);

  const handleAnnotationsChange = useCallback((newAnns: AnnotationObj[]) => {
    setAnnotations(newAnns);
    setSaved(false);
    setHistory((prev) => {
      const next = prev.slice(0, historyStep + 1);
      next.push(newAnns);
      return next;
    });
    setHistoryStep((s) => s + 1);
  }, [historyStep]);

  const handleUndo = useCallback(() => {
    if (historyStep > 0) {
      setHistoryStep((s) => s - 1);
      setAnnotations(history[historyStep - 1]);
      setSaved(false);
    }
  }, [history, historyStep]);

  const handleRedo = useCallback(() => {
    if (historyStep < history.length - 1) {
      setHistoryStep((s) => s + 1);
      setAnnotations(history[historyStep + 1]);
      setSaved(false);
    }
  }, [history, historyStep]);

  // Find index of current image in filmstrip
  const currentIndex = filmStripImages.findIndex((img) => img.id === id);
  const hasNext = currentIndex >= 0 && currentIndex < filmStripImages.length - 1;
  const hasPrev = currentIndex > 0;

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = annotations.map((a) => ({
        class_name: a.className,
        class_id: a.classId,
        type: a.type,
        bbox: a.bbox,
        polygon: a.polygon,
        source: a.source,
      }));
      await annotationsApi.save(id, payload);
    },
    onSuccess: () => {
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["image", id] });
      queryClient.invalidateQueries({ queryKey: ["images", datasetId] });
    },
  });

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, Tool | "mask"> = {
        v: "select", b: "bbox", p: "polygon", m: "mask",
        e: "eraser", w: "wand", z: "zoom", " ": "pan",
      };
      const keyTool = map[e.key.toLowerCase()];
      if (keyTool === "mask") {
        setShowMasks((s) => !s);
      } else if (keyTool) {
        setTool(keyTool as Tool);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          handleAnnotationsChange(annotations.filter((a) => a.id !== selectedId));
          setSelectedId(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveMutation.mutate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, saveMutation]);

  const toggleVisibility = (annId: string) => {
    handleAnnotationsChange(annotations.map((a) => a.id === annId ? { ...a, visible: !a.visible } : a));
  };

  const deleteAnnotation = (annId: string) => {
    handleAnnotationsChange(annotations.filter((a) => a.id !== annId));
    if (selectedId === annId) setSelectedId(null);
  };

  const getConfColor = (conf?: number) =>
    !conf ? "var(--color-text-muted)" :
    conf >= 0.9 ? "#10b981" :
    conf >= 0.7 ? "#f59e0b" : "#ef4444";

  if (isImageLoading || !currentImage) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "var(--color-bg-primary)" }}>
        <Loader2 size={30} className="animate-spin text-muted" />
      </div>
    );
  }

  const selectedAnn = annotations.find((a) => a.id === selectedId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--color-bg-primary)",
        overflow: "hidden",
      }}
    >
      {/* ─── Top Bar ─── */}
      <div
        style={{
          height: 52,
          background: "var(--color-bg-secondary)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Link href={`/projects`} style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>Projects</Link>
          <ChevronRight size={12} style={{ color: "var(--color-text-muted)" }} />
          <Link href={`/projects/${currentImage.project_id}`} style={{ color: "var(--color-text-secondary)", textDecoration: "none" }}>Dataset</Link>
          <ChevronRight size={12} style={{ color: "var(--color-text-muted)" }} />
          <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>Annotate</span>
        </div>

        {/* Image nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 16 }}>
          <button
            className="btn-icon"
            onClick={() => hasPrev && router.push(`/annotate/${filmStripImages[currentIndex - 1].id}`)}
            disabled={!hasPrev}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>
            {currentIndex + 1} / {filmStripImages.length}
          </span>
          <button
            className="btn-icon"
            onClick={() => hasNext && router.push(`/annotate/${filmStripImages[currentIndex + 1].id}`)}
            disabled={!hasNext}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Filename + saved */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
            {currentImage.filename}
          </span>
          {saveMutation.isPending && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--color-text-muted)" }}>
              <Loader2 size={12} className="animate-spin" /> Saving...
            </span>
          )}
          {!saveMutation.isPending && saved && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#10b981" }}>
              <CheckCircle size={12} /> Saved
            </span>
          )}
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn-icon" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))}>
            <ZoomOut size={15} />
          </button>
          <span style={{ fontSize: 12, color: "var(--color-text-secondary)", minWidth: 40, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn-icon" onClick={() => setZoom((z) => Math.min(4, z + 0.1))}>
            <ZoomIn size={15} />
          </button>
          <button className="btn-icon" onClick={() => setZoom(1)} title="Fit to screen">
            <Maximize2 size={14} />
          </button>
        </div>

        <div style={{ width: 1, height: 24, background: "var(--color-border)" }} />

        {/* View toggles */}
        <div style={{ display: "flex", gap: 2 }}>
          <button className="btn-icon" title="Layout">
            <Layers size={15} />
          </button>
          <button className="btn-icon" title="Settings">
            <SlidersHorizontal size={15} />
          </button>
        </div>

        <Link href={`/segment-annotate/${currentImage.id}`} style={{ textDecoration: "none", marginRight: 8 }}>
          <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px", display: "flex", gap: 6, alignItems: "center" }}>
            <Activity size={13} /> Segment
          </button>
        </Link>
        <Link href={`/pose-annotate/${currentImage.id}`} style={{ textDecoration: "none", marginRight: 8 }}>
          <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px", display: "flex", gap: 6, alignItems: "center" }}>
            <PersonStanding size={13} /> Pose
          </button>
        </Link>
        <button
          className="btn-primary"
          style={{ fontSize: 12, padding: "6px 16px" }}
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || saved}
        >
          <Save size={13} /> {saveMutation.isPending ? "Saving..." : "Save"} <span style={{ opacity: 0.7, fontSize: 10 }}>Ctrl+S</span>
        </button>

        {/* Save Annotation File button */}
        <button
          className="btn-ghost"
          style={{ fontSize: 12, padding: "6px 14px", display: "flex", alignItems: "center", gap: 5 }}
          onClick={() => setShowExportModal(true)}
          disabled={annotations.length === 0}
          title={annotations.length === 0 ? "No annotations to export" : "Save annotation file"}
        >
          <Download size={13} /> Save File
        </button>
      </div>

      {/* ─── Main Area ─── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ─── Left Tool Sidebar ─── */}
        <div
          style={{
            width: 60,
            background: "var(--color-bg-secondary)",
            borderRight: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "10px 6px",
            gap: 4,
            overflow: "auto",
          }}
        >
          {TOOLS.map(({ id, icon: Icon, label, key }) => (
            <button
              key={id}
              className={`tool-btn tooltip ${tool === id || (id === "mask" && showMasks) ? "active" : ""}`}
              data-tip={`${label} (${key})`}
              onClick={() => {
                if (id === "mask") setShowMasks(!showMasks);
                else setTool(id as Tool);
              }}
              style={{
                flexDirection: "column",
                gap: 2,
                padding: "8px",
                justifyContent: "center",
                width: "100%",
              }}
            >
              <Icon size={18} />
              <span style={{ fontSize: 9, lineHeight: 1 }}>{key}</span>
            </button>
          ))}

          <div className="divider" style={{ width: "80%", margin: "4px 0" }} />

          <button
            className="tool-btn tooltip"
            data-tip="Undo (Ctrl+Z)"
            onClick={handleUndo}
            disabled={historyStep === 0}
            style={{ flexDirection: "column", gap: 2, padding: "8px", justifyContent: "center", width: "100%", opacity: historyStep === 0 ? 0.5 : 1 }}
          >
            <Undo2 size={16} />
            <span style={{ fontSize: 9 }}>Ctrl+Z</span>
          </button>
          <button
            className="tool-btn tooltip"
            data-tip="Redo (Ctrl+Y)"
            onClick={handleRedo}
            disabled={historyStep === history.length - 1}
            style={{ flexDirection: "column", gap: 2, padding: "8px", justifyContent: "center", width: "100%", opacity: historyStep === history.length - 1 ? 0.5 : 1 }}
          >
            <Redo2 size={16} />
            <span style={{ fontSize: 9 }}>Ctrl+Y</span>
          </button>
        </div>

        {/* ─── Canvas ─── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <AnnotationCanvas
            imageUrl={currentImage.url}
            annotations={annotations}
            tool={tool}
            zoom={zoom}
            setZoom={setZoom}
            classId={selectedClassId}
            projectClasses={projectClasses}
            showMasks={showMasks}
            onAnnotationsChange={handleAnnotationsChange}
            onSelect={setSelectedId}
          />
        </div>

        {/* ─── Right Panel ─── */}
        <div
          style={{
            width: 220,
            background: "var(--color-bg-secondary)",
            borderLeft: "1px solid var(--color-border)",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
          }}
        >
          {/* Objects */}
          <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
                Objects ({annotations.length})
              </span>
              <button className="btn-ghost" style={{ fontSize: 10, padding: "2px 7px" }}>
                Select All
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 200, overflow: "auto" }}>
              {annotations.map((ann) => {
                const cls = projectClasses.find((c) => c.id === ann.classId);
                return (
                  <div
                    key={ann.id}
                    onClick={() => {
                      setSelectedId(ann.id === selectedId ? null : ann.id);
                      setAnnotations((prev) => prev.map((a) => ({ ...a, selected: a.id === ann.id && a.id !== selectedId })));
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "5px 7px",
                      borderRadius: 6,
                      cursor: "pointer",
                      background: selectedId === ann.id ? `${cls?.color}18` : "transparent",
                      border: `1px solid ${selectedId === ann.id ? (cls?.color + "40") : "transparent"}`,
                      transition: "all 0.1s",
                    }}
                  >
                    <div
                      className="color-dot"
                      style={{ background: cls?.color || "#fff" }}
                    />
                    <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>
                      {ann.className}
                    </span>
                    {ann.confidence && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: getConfColor(ann.confidence) }}>
                        {ann.confidence.toFixed(2)}
                      </span>
                    )}
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      onClick={(e) => { e.stopPropagation(); toggleVisibility(ann.id); }}
                    >
                      {ann.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      className="btn-icon"
                      style={{ padding: 2 }}
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Class List */}
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--color-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>
                Class List ({projectClasses.length})
              </span>
              <button 
                className="btn-icon" 
                style={{ padding: 3 }}
                onClick={() => {
                  const newName = prompt("Enter new class name:");
                  if (newName && projectId) {
                    const currentNames = projectClasses.map(c => c.name);
                    if (!currentNames.includes(newName)) {
                      projectsApi.updateClasses(projectId, [...currentNames, newName]).then(() => {
                        refetchProject();
                      });
                    }
                  }
                }}
              >
                <Plus size={13} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {projectClasses.map((cls) => (
                <div
                  key={cls.id}
                  onClick={() => setSelectedClassId(cls.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "5px 7px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: selectedClassId === cls.id ? `${cls.color}15` : "transparent",
                    border: `1px solid ${selectedClassId === cls.id ? cls.color + "40" : "transparent"}`,
                    transition: "all 0.1s",
                  }}
                >
                  <div
                    className="color-dot"
                    style={{ background: cls.color, width: 10, height: 10, borderRadius: "50%" }}
                  />
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>
                    {cls.name}
                  </span>
                  <button className="btn-icon" style={{ padding: 2 }}>
                    <MoreVertical size={11} />
                  </button>
                  <button className="btn-icon" style={{ padding: 2 }}>
                    <Eye size={11} />
                  </button>
                </div>
              ))}
            </div>
            
            {/* Generate YAML */}
            {projectId && (
              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 12, fontSize: 12, background: "var(--color-bg-surface)", border: "1px solid var(--color-border)" }}
                onClick={() => {
                  const url = `${API_BASE}/projects/${projectId}/yaml`;
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
              >
                <FileJson size={13} style={{ marginRight: 6 }} /> Generate data.yaml
              </button>
            )}
          </div>

          {/* Object Properties */}
          {selectedAnn && (
            <div style={{ padding: "12px 14px", flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 10 }}>
                Object Properties
              </div>

              {/* Class & confidence */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px",
                  background: "var(--color-bg-surface)",
                  borderRadius: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  className="color-dot"
                  style={{ background: projectClasses.find((c) => c.id === selectedAnn.classId)?.color || "#fff" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", flex: 1 }}>
                  {selectedAnn.className}
                </span>
                {selectedAnn.confidence && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: getConfColor(selectedAnn.confidence) }}>
                    {selectedAnn.confidence.toFixed(2)}
                  </span>
                )}
              </div>

              {selectedAnn.type === "bbox" && selectedAnn.bbox && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 6, letterSpacing: "0.05em" }}>
                    + Bounding Box
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      { label: "X", value: Math.round(selectedAnn.bbox.x * 1000) },
                      { label: "Y", value: Math.round(selectedAnn.bbox.y * 1000) },
                      { label: "W", value: Math.round(selectedAnn.bbox.w * 1000) },
                      { label: "H", value: Math.round(selectedAnn.bbox.h * 1000) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ padding: "6px 8px", background: "var(--color-bg-surface)", borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: "var(--color-text-muted)", marginBottom: 1 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Source</div>
                <span className={`badge badge-${selectedAnn.source === "auto" ? "yellow" : "green"}`}>
                  {selectedAnn.source}
                </span>
              </div>

              <button
                className="btn-ghost"
                style={{ width: "100%", marginTop: 12, fontSize: 12, color: "#ef4444", borderColor: "#ef444440" }}
                onClick={() => deleteAnnotation(selectedAnn.id)}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Film Strip ─── */}
      <div
        style={{
          background: "var(--color-bg-secondary)",
          borderTop: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        {/* Image thumbnails */}
        <div style={{ height: 100, display: "flex", alignItems: "center", padding: "0 40px", gap: 6, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 0", width: "100%" }}>
            {filmStripImages.map((img) => (
              <Link key={img.id} href={`/annotate/${img.id}`} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    width: 100,
                    height: 66,
                    borderRadius: 6,
                    overflow: "hidden",
                    border: "2px solid",
                    borderColor: img.id === id ? "var(--color-accent)" : "transparent",
                    opacity: img.id === id ? 1 : 0.6,
                    transition: "all 0.15s",
                    cursor: "pointer",
                    position: "relative",
                    background: "var(--color-bg-surface)",
                    flexShrink: 0,
                  }}
                >
                  <img src={img.url} alt={img.filename} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {img.annotation_count > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 4, right: 4,
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#10b981",
                        boxShadow: "0 0 4px #10b981",
                      }}
                    />
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── Annotation Files List ─── */}
        {annotationFiles.length > 0 && (
          <div
            style={{
              borderTop: "1px solid var(--color-border)",
              padding: "10px 40px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
              ANNOTATION FILES
            </span>
            {annotationFiles.map((file: { format: string; filename: string; description: string; download_url: string }) => (
              <a
                key={file.format}
                href={`${API_BASE}${file.download_url}`}
                download
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    background: "var(--color-bg-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                >
                  {file.format === "COCO" ? (
                    <FileJson size={14} style={{ color: "#f59e0b" }} />
                  ) : (
                    <FileText size={14} style={{ color: "#3b82f6" }} />
                  )}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-primary)" }}>{file.filename}</div>
                    <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{file.description}</div>
                  </div>
                  <Download size={12} style={{ color: "var(--color-text-muted)", marginLeft: 4 }} />
                </div>
              </a>
            ))}
          
          <button
            className="btn-primary"
            style={{ fontSize: 11, padding: "6px 12px", marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}
            onClick={() => {
              annotationFiles.forEach((file: { download_url: string }) => {
                const a = document.createElement("a");
                a.href = `${API_BASE}${file.download_url}`;
                a.download = "";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              });
            }}
          >
            <Download size={13} /> Save All
          </button>
          </div>
        )}
      </div>

      {/* ─── Export Modal ─── */}
      {showExportModal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowExportModal(false)}
        >
          <div
            style={{
              background: "var(--color-bg-secondary)",
              border: "1px solid var(--color-border)",
              borderRadius: 14,
              padding: 24,
              width: 360,
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-text-primary)" }}>Save Annotation File</div>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 }}>
                  {annotations.length} annotation(s) · {currentImage?.filename}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowExportModal(false)}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* YOLO Option */}
              <button
                onClick={() => handleExportDownload("yolo")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10, cursor: "pointer",
                  transition: "all 0.15s", textAlign: "left", width: "100%",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.background = "#3b82f610"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "var(--color-bg-surface)"; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 8, background: "#3b82f615", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileText size={20} style={{ color: "#3b82f6" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>YOLO Format (.txt)</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                    class_id cx cy w h — normalized coordinates
                  </div>
                </div>
                <Download size={14} style={{ color: "var(--color-text-muted)", marginLeft: "auto", flexShrink: 0 }} />
              </button>

              {/* COCO Option */}
              <button
                onClick={() => handleExportDownload("coco")}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px",
                  background: "var(--color-bg-surface)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10, cursor: "pointer",
                  transition: "all 0.15s", textAlign: "left", width: "100%",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#f59e0b"; e.currentTarget.style.background = "#f59e0b10"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.background = "var(--color-bg-surface)"; }}
              >
                <div style={{ width: 38, height: 38, borderRadius: 8, background: "#f59e0b15", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <FileJson size={20} style={{ color: "#f59e0b" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>COCO JSON (.json)</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 }}>
                    Standard COCO format with bounding boxes & categories
                  </div>
                </div>
                <Download size={14} style={{ color: "var(--color-text-muted)", marginLeft: "auto", flexShrink: 0 }} />
              </button>
            </div>

            <div style={{ marginTop: 16, padding: "10px 12px", background: "var(--color-bg-surface)", borderRadius: 8, fontSize: 11, color: "var(--color-text-muted)" }}>
              💡 File akan dinamai sama dengan gambar: <strong style={{ color: "var(--color-text-secondary)" }}>{currentImage?.filename?.replace(/\.[^.]+$/, "")}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
