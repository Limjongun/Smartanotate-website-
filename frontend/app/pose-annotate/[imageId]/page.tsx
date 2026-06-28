
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  MousePointer2, Move, Undo2, Redo2, Save, Eye, EyeOff,
  Plus, Trash2, CheckCircle, Zap, Crosshair, MapPin,
  Activity, Pencil, PersonStanding, Loader2, Wand2, Download
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { imagesApi, annotationsApi, projectsApi, AnnotationObj, ImageItem } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types ---
type Tool = "select" | "keypoint" | "pan" | "zoom";

interface Point { x: number; y: number }
interface Keypoint extends Point { id: number; name: string; visible: boolean }

interface PoseAnnotation {
  id: string;
  classId: number;
  className: string;
  type: "pose";
  keypoints: Keypoint[];
  visible: boolean;
  selected: boolean;
}

// --- Constants ---
const COCO_KEYPOINTS = [
  "Nose", "L_Eye", "R_Eye", "L_Ear", "R_Ear", 
  "L_Shoulder", "R_Shoulder", "L_Elbow", "R_Elbow", 
  "L_Wrist", "R_Wrist", "L_Hip", "R_Hip", 
  "L_Knee", "R_Knee", "L_Ankle", "R_Ankle"
];

const SKELETON_EDGES = [
  [15, 13], [13, 11], [16, 14], [14, 12], [11, 12], [5, 11], [6, 12],
  [5, 6], [5, 7], [6, 8], [7, 9], [8, 10], [1, 2], [0, 1], [0, 2],
  [1, 3], [2, 4], [3, 5], [4, 6]
];

// 17 distinctive colors for 17 nodes
const KP_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e"
];

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#14b8a6", "#f97316"];

// Template offsets relative to center (for a standard person standing, scaled to typically 800x600 size)
// Nose is roughly top center, ankles at bottom.
const TEMPLATE_OFFSETS = [
  { id: 0, x: 0, y: -180 },     // Nose
  { id: 1, x: -15, y: -190 },   // L_Eye
  { id: 2, x: 15, y: -190 },    // R_Eye
  { id: 3, x: -30, y: -180 },   // L_Ear
  { id: 4, x: 30, y: -180 },    // R_Ear
  { id: 5, x: -60, y: -130 },   // L_Shoulder
  { id: 6, x: 60, y: -130 },    // R_Shoulder
  { id: 7, x: -75, y: -50 },    // L_Elbow
  { id: 8, x: 75, y: -50 },     // R_Elbow
  { id: 9, x: -80, y: 30 },     // L_Wrist
  { id: 10, x: 80, y: 30 },     // R_Wrist
  { id: 11, x: -40, y: 10 },    // L_Hip
  { id: 12, x: 40, y: 10 },     // R_Hip
  { id: 13, x: -45, y: 110 },   // L_Knee
  { id: 14, x: 45, y: 110 },    // R_Knee
  { id: 15, x: -50, y: 210 },   // L_Ankle
  { id: 16, x: 50, y: 210 },    // R_Ankle
];


// --- Canvas Component ---
function PoseCanvas({
  imageUrl, annotations, tool, zoom, classId, projectClasses,
  onAnnotationsChange, onSelect, setZoom, currentKeypointIdx
}: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point | null>(null);
  
  // Dragging state
  const [draggingNode, setDraggingNode] = useState<{ annId: string, kpId: number } | null>(null);

  const getCanvasPos = useCallback((e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom - pan.x,
      y: (e.clientY - rect.top) / zoom - pan.y,
    };
  }, [zoom, pan]);

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

    ctx.drawImage(img, 0, 0);

    // Draw Annotations
    annotations.forEach((ann: any) => {
      if (!ann.visible) return;
      const baseColor = COLORS[ann.classId % COLORS.length];
      
      // Draw Skeleton Lines
      ctx.lineWidth = 2;
      ctx.strokeStyle = ann.selected ? "#ffffff99" : baseColor + "80";
      
      SKELETON_EDGES.forEach(([u, v]) => {
        const kpU = ann.keypoints.find((k: any) => k.id === u && k.visible);
        const kpV = ann.keypoints.find((k: any) => k.id === v && k.visible);
        if (kpU && kpV) {
          ctx.beginPath();
          ctx.moveTo(kpU.x, kpU.y);
          ctx.lineTo(kpV.x, kpV.y);
          ctx.stroke();
        }
      });

      // Draw Keypoints
      ann.keypoints.forEach((kp: any) => {
        if (!kp.visible) return;
        const color = KP_COLORS[kp.id % KP_COLORS.length]; // Unique color per node
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, ann.selected ? 5 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        
        // Draw ID text for the selected annotation for easier dragging
        if (ann.selected) {
           ctx.fillStyle = "#fff";
           ctx.font = "8px Arial";
           ctx.fillText(kp.id.toString(), kp.x + 6, kp.y - 6);
        }
      });
    });

    ctx.restore();
  }, [annotations, zoom, pan]);

  useEffect(() => {
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imageRef.current = img;
      if (canvasRef.current) {
        canvasRef.current.width = img.width;
        canvasRef.current.height = img.height;
      }
      draw();
    };
  }, [imageUrl, draw]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (tool === "pan" || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === "select" || tool === "keypoint") {
      let clickedNode = null;
      let clickedAnnId = null;
      
      // Hit detection (highest priority to keypoints)
      for (let i = annotations.length - 1; i >= 0; i--) {
        const ann = annotations[i];
        if (!ann.visible) continue;
        const hitKp = ann.keypoints.find((kp: any) => {
           return Math.hypot(kp.x - pos.x, kp.y - pos.y) < 12 / zoom;
        });
        if (hitKp) {
           clickedNode = { annId: ann.id, kpId: hitKp.id };
           clickedAnnId = ann.id;
           break;
        }
      }
      
      if (clickedNode) {
         setDraggingNode(clickedNode);
         onSelect(clickedNode.annId);
         return; // Intercepted drag, don't create new node
      } else if (clickedAnnId) {
         onSelect(clickedAnnId);
      } else if (tool === "select") {
         onSelect(null);
      }
    }

    if (tool === "keypoint" && !draggingNode) {
      const selectedAnn = annotations.find((a: any) => a.selected);
      if (selectedAnn) {
        // Add/Update keypoint
        const updatedAnn = { ...selectedAnn };
        const existingIdx = updatedAnn.keypoints.findIndex((k: any) => k.id === currentKeypointIdx);
        if (existingIdx >= 0) {
          updatedAnn.keypoints[existingIdx] = { id: currentKeypointIdx, name: COCO_KEYPOINTS[currentKeypointIdx], x: pos.x, y: pos.y, visible: true };
        } else {
          updatedAnn.keypoints.push({ id: currentKeypointIdx, name: COCO_KEYPOINTS[currentKeypointIdx], x: pos.x, y: pos.y, visible: true });
        }
        onAnnotationsChange(annotations.map((a: any) => a.id === updatedAnn.id ? updatedAnn : a));
      } else {
        // Create new annotation
        const newAnn: PoseAnnotation = {
          id: Date.now().toString(),
          classId: classId,
          className: projectClasses.find((c: any) => c.id === classId)?.name || "Person",
          type: "pose",
          keypoints: [{ id: currentKeypointIdx, name: COCO_KEYPOINTS[currentKeypointIdx], x: pos.x, y: pos.y, visible: true }],
          visible: true,
          selected: true
        };
        onAnnotationsChange(annotations.map((a: any) => ({...a, selected: false})).concat(newAnn));
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStart) {
      const dx = (e.clientX - panStart.x) / zoom;
      const dy = (e.clientY - panStart.y) / zoom;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    if (draggingNode) {
      const pos = getCanvasPos(e);
      onAnnotationsChange(annotations.map((a: any) => {
         if (a.id === draggingNode.annId) {
            const newKeypoints = a.keypoints.map((kp: any) => {
               if (kp.id === draggingNode.kpId) {
                  return { ...kp, x: pos.x, y: pos.y };
               }
               return kp;
            });
            return { ...a, keypoints: newKeypoints };
         }
         return a;
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
    setDraggingNode(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = 1.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      setZoom(prev => Math.min(Math.max(0.1, prev * (direction > 0 ? zoomFactor : 1 / zoomFactor)), 10));
    }
  };

  // Provide method to get natural image dimensions to the parent via an invisible div or just passing a ref, 
  // but parent can read it if needed. Actually, parent can just use `imageRef.current`.
  // To keep it simple, we expose it via an effect or we just let parent trigger template.
  useEffect(() => {
    if (window && imageRef.current) {
        (window as any).__poseCanvasImageRef = imageRef.current;
    }
  }, [imageUrl, draw]);

  return (
    <div 
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "hidden", cursor: tool === "pan" ? "grab" : draggingNode ? "grabbing" : tool === "keypoint" ? "crosshair" : "default" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={600} 
        style={{ transformOrigin: "0 0" }}
      />
    </div>
  );
}

// --- Main Page ---
export default function PoseAnnotatePage() {
  const params = useParams();
  const router = useRouter();
  const imageId = params.imageId as string;
  const queryClient = useQueryClient();

  const [tool, setTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [classId, setClassId] = useState(0);
  const [annotations, setAnnotations] = useState<PoseAnnotation[]>([]);
  const [currentKeypointIdx, setCurrentKeypointIdx] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const { data: image } = useQuery({
    queryKey: ["image", imageId],
    queryFn: () => imagesApi.get(imageId)
  });

  const { data: project } = useQuery({
    queryKey: ["project", image?.project_id],
    queryFn: () => projectsApi.get(image!.project_id!),
    enabled: !!image?.project_id
  });

  const datasetId = image?.dataset_id;
  const { data: filmStripImages = [] } = useQuery({
    queryKey: ["images", datasetId],
    queryFn: () => imagesApi.list(datasetId!),
    enabled: !!datasetId,
  });

  const currentIndex = filmStripImages.findIndex((img) => img.id === imageId);
  const hasNext = currentIndex >= 0 && currentIndex < filmStripImages.length - 1;
  const hasPrev = currentIndex > 0;

  // Load annotations
  useEffect(() => {
    if (image) {
      annotationsApi.get(imageId)
        .then((data: any[]) => {
          const poses = data.map((d: any) => {
            // Check if it's already parsed JSON or a string
            let keypoints = [];
            if (d.data) {
                try {
                    const parsedData = typeof d.data === 'string' ? JSON.parse(d.data) : d.data;
                    keypoints = parsedData.keypoints || [];
                } catch(e) {}
            } else {
                keypoints = d.keypoints || [];
            }
            return {
              id: d.id,
              classId: d.class_id || d.classId,
              className: d.class_name || d.className,
              type: d.type,
              keypoints: keypoints,
              visible: true,
              selected: false
            };
          }).filter((a: any) => a.type === "pose");
          setAnnotations(poses);
        })
        .catch(console.error);
    }
  }, [image, imageId]);

  const saveMutation = useMutation({
    mutationFn: async (anns: any[]) => {
      const payload = anns.map(a => ({
        class_name: a.className,
        class_id: a.classId,
        type: a.type,
        keypoints: a.keypoints,
        source: "manual"
      }));
      return annotationsApi.save(imageId, payload as any[]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["image", imageId] });
      alert("Annotations saved!");
    }
  });

  const projectClasses = project?.classes ? project.classes.map((c: string, i: number) => ({ id: i, name: c, color: COLORS[i % COLORS.length] })) : [];

  // Keybindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "v") setTool("select");
      if (e.key === "k") setTool("keypoint");
      if (e.key === " ") setTool("pan");
      if (e.key === "ArrowRight") setCurrentKeypointIdx(p => Math.min(16, p + 1));
      if (e.key === "ArrowLeft") setCurrentKeypointIdx(p => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleApplyTemplate = () => {
    const img = (window as any).__poseCanvasImageRef as HTMLImageElement | undefined;
    const cx = img ? img.width / 2 : 400;
    const cy = img ? img.height / 2 : 300;
    
    const keypoints = TEMPLATE_OFFSETS.map(t => ({
       id: t.id,
       name: COCO_KEYPOINTS[t.id],
       x: cx + t.x,
       y: cy + t.y,
       visible: true
    }));
    
    const newAnn: PoseAnnotation = {
      id: Date.now().toString(),
      classId: classId,
      className: projectClasses.find((c: any) => c.id === classId)?.name || "Person",
      type: "pose",
      keypoints,
      visible: true,
      selected: true
    };
    
    setAnnotations(prev => prev.map((a: any) => ({...a, selected: false})).concat(newAnn));
    setTool("select"); // switch to select mode so user can drag immediately
  };

  const handleExportDownload = (format: "json" | "txt" | "xml") => {
    setShowExportMenu(false);
    const img = (window as any).__poseCanvasImageRef as HTMLImageElement;
    const imgW = img ? img.width : 800;
    const imgH = img ? img.height : 600;

    let content = "";
    let mimeType = "text/plain";
    let ext = format;

    if (format === "json") {
      content = JSON.stringify(annotations, null, 2);
      mimeType = "application/json";
    } else if (format === "txt") {
      // YOLO Pose format
      content = annotations.filter(a => a.type === "pose").map(a => {
         let minX = imgW, minY = imgH, maxX = 0, maxY = 0;
         let validKps = 0;
         for (let i = 0; i < 17; i++) {
            const kp = a.keypoints.find(k => k.id === i);
            if (kp && kp.visible) {
               minX = Math.min(minX, kp.x);
               minY = Math.min(minY, kp.y);
               maxX = Math.max(maxX, kp.x);
               maxY = Math.max(maxY, kp.y);
               validKps++;
            }
         }
         if (validKps === 0) return "";
         
         const w = (maxX - minX) / imgW;
         const h = (maxY - minY) / imgH;
         const cx = (minX + maxX) / 2 / imgW;
         const cy = (minY + maxY) / 2 / imgH;

         let row = `${a.classId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${w.toFixed(6)} ${h.toFixed(6)}`;
         for (let i = 0; i < 17; i++) {
            const kp = a.keypoints.find(k => k.id === i);
            if (kp && kp.visible) {
               row += ` ${(kp.x / imgW).toFixed(6)} ${(kp.y / imgH).toFixed(6)} 2`;
            } else {
               row += ` 0.000000 0.000000 0`;
            }
         }
         return row;
      }).filter(Boolean).join("\n");
      mimeType = "text/plain";
    } else if (format === "xml") {
      // Simple XML
      content = `<?xml version="1.0" encoding="utf-8"?>\n<annotations>\n`;
      annotations.forEach(a => {
         content += `  <object>\n    <name>${a.className}</name>\n    <pose>\n`;
         for (let i = 0; i < 17; i++) {
            const kp = a.keypoints.find(k => k.id === i);
            if (kp && kp.visible) {
               content += `      <keypoint id="${i}" x="${kp.x.toFixed(1)}" y="${kp.y.toFixed(1)}" />\n`;
            }
         }
         content += `    </pose>\n  </object>\n`;
      });
      content += `</annotations>`;
      mimeType = "application/xml";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${image?.filename.split(".")[0]}_pose.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!image) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" /></div>;

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: "var(--color-background)" }}>
      {/* LEFT TOOLBAR */}
      <div style={{ width: 64, borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", background: "var(--color-surface)" }}>
        <button onClick={() => router.push("/pose-annotate")} style={{ marginBottom: 24, background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}><ChevronLeft size={24} /></button>
        
        <button onClick={() => setTool("select")} style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 8, background: tool === "select" ? "var(--color-primary-light)" : "none", border: "none", color: tool === "select" ? "var(--color-primary)" : "var(--color-text-secondary)", cursor: "pointer" }}>
          <MousePointer2 size={20} />
        </button>
        <button onClick={() => setTool("keypoint")} style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 8, background: tool === "keypoint" ? "var(--color-primary-light)" : "none", border: "none", color: tool === "keypoint" ? "var(--color-primary)" : "var(--color-text-secondary)", cursor: "pointer" }}>
          <MapPin size={20} />
        </button>
        <button onClick={() => setTool("pan")} style={{ width: 40, height: 40, borderRadius: 8, marginBottom: 8, background: tool === "pan" ? "var(--color-primary-light)" : "none", border: "none", color: tool === "pan" ? "var(--color-primary)" : "var(--color-text-secondary)", cursor: "pointer" }}>
          <Move size={20} />
        </button>
      </div>

      {/* CANVAS AREA */}
      <div style={{ flex: 1, position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <div style={{ height: 50, borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: "var(--color-surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button 
              onClick={() => hasPrev && router.push(`/pose-annotate/${filmStripImages[currentIndex - 1].id}`)} 
              disabled={!hasPrev}
              className="btn-icon"
              style={{ opacity: hasPrev ? 1 : 0.3 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)" }}>
              {currentIndex >= 0 ? currentIndex + 1 : 0} / {filmStripImages.length}
            </span>
            <button 
              onClick={() => hasNext && router.push(`/pose-annotate/${filmStripImages[currentIndex + 1].id}`)} 
              disabled={!hasNext}
              className="btn-icon"
              style={{ opacity: hasNext ? 1 : 0.3 }}
            >
              <ChevronRight size={16} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)", marginLeft: 8 }}>{image.filename}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setZoom(z => z * 1.1)} className="btn-secondary" style={{ padding: "6px 8px" }}><ZoomIn size={16} /></button>
            <button onClick={() => setZoom(z => z / 1.1)} className="btn-secondary" style={{ padding: "6px 8px" }}><ZoomOut size={16} /></button>
            
            <Link href={`/annotate/${imageId}`} style={{ textDecoration: "none" }}>
              <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                <Pencil size={13} /> Bbox
              </button>
            </Link>
            <Link href={`/segment-annotate/${imageId}`} style={{ textDecoration: "none" }}>
              <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 16px", display: "flex", gap: 6, alignItems: "center" }}>
                <Activity size={13} /> Segment
              </button>
            </Link>

            <div style={{ position: "relative" }}>
              <button 
                className="btn-secondary" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                style={{ fontSize: 13, padding: "6px 12px", display: "flex", gap: 6, alignItems: "center" }}
              >
                <Download size={14} /> Export
              </button>
              {showExportMenu && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 4, zIndex: 50, width: 140, display: "flex", flexDirection: "column", gap: 2, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                  <button className="menu-item" style={{ textAlign: "left", padding: "6px 12px", fontSize: 12, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-primary)" }} onClick={() => handleExportDownload("txt")}>TXT (YOLO)</button>
                  <button className="menu-item" style={{ textAlign: "left", padding: "6px 12px", fontSize: 12, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-primary)" }} onClick={() => handleExportDownload("json")}>JSON Format</button>
                  <button className="menu-item" style={{ textAlign: "left", padding: "6px 12px", fontSize: 12, border: "none", background: "transparent", cursor: "pointer", color: "var(--color-text-primary)" }} onClick={() => handleExportDownload("xml")}>XML Format</button>
                </div>
              )}
            </div>

            <button onClick={() => saveMutation.mutate(annotations)} className="btn-primary" style={{ padding: "6px 12px", fontSize: 13, gap: 6 }}>
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
            </button>
          </div>
        </div>
        
        {/* Workspace */}
        <div style={{ flex: 1, overflow: "hidden", background: "#111" }}>
          <PoseCanvas 
            imageUrl={image.url}
            annotations={annotations}
            tool={tool}
            zoom={zoom}
            classId={classId}
            projectClasses={projectClasses}
            onAnnotationsChange={setAnnotations}
            onSelect={(id: string) => setAnnotations(anns => anns.map(a => ({...a, selected: a.id === id})))}
            setZoom={setZoom}
            currentKeypointIdx={currentKeypointIdx}
          />
        </div>
      </div>

      {/* RIGHT SIDEBAR */}
      <div style={{ width: 300, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column" }}>
        
        {/* TEMPLATE ACTION */}
        <div style={{ padding: 16, borderBottom: "1px solid var(--color-border)" }}>
           <button 
             onClick={handleApplyTemplate}
             className="btn-primary" 
             style={{ width: "100%", padding: "10px", fontSize: 13, display: "flex", gap: 8, justifyContent: "center", background: "linear-gradient(135deg, #10b981, #059669)" }}
           >
             <Wand2 size={16} /> Spawn Template
           </button>
           <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 8, textAlign: "center" }}>
             Click to spawn 17 points, then drag them.
           </p>
        </div>

        <div style={{ padding: 16, borderBottom: "1px solid var(--color-border)", flex: 1, overflowY: "auto" }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Keypoints (COCO 17)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {COCO_KEYPOINTS.map((kp, idx) => {
              const nodeColor = KP_COLORS[idx % KP_COLORS.length];
              return (
                <div 
                  key={idx} 
                  onClick={() => { setTool("keypoint"); setCurrentKeypointIdx(idx); }}
                  style={{ 
                    padding: "6px 12px", 
                    borderRadius: 6, 
                    fontSize: 13, 
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: currentKeypointIdx === idx && tool === "keypoint" ? nodeColor + "20" : "transparent",
                    color: currentKeypointIdx === idx && tool === "keypoint" ? nodeColor : "var(--color-text-secondary)",
                    fontWeight: currentKeypointIdx === idx && tool === "keypoint" ? 500 : 400,
                    border: `1px solid ${currentKeypointIdx === idx && tool === "keypoint" ? nodeColor : "transparent"}`
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: nodeColor }} />
                    <span>{idx}: {kp}</span>
                  </div>
                  {annotations.some(a => a.selected && a.keypoints.some(k => k.id === idx)) && (
                    <CheckCircle size={14} color={nodeColor} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
