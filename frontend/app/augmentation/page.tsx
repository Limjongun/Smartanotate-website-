"use client";

import AppShell from "@/components/layout/AppShell";
import { useState, useCallback } from "react";
import { Upload, Download, Settings2, Trash2, Loader2, Image as ImageIcon, SlidersHorizontal, RefreshCcw } from "lucide-react";
import { useDropzone } from "react-dropzone";
import JSZip from "jszip";
import { saveAs } from "file-saver";

type EffectType = "none" | "grayscale" | "blur" | "saturation" | "flip" | "noise" | "watermark";

interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  processedUrl?: string;
}

const EFFECTS: { id: EffectType; label: string; icon: string }[] = [
  { id: "none", label: "Original", icon: "🖼️" },
  { id: "grayscale", label: "Grayscale", icon: "⬛" },
  { id: "flip", label: "Flip H", icon: "↔️" },
  { id: "blur", label: "Blur", icon: "💧" },
  { id: "noise", label: "Noise", icon: "🌫️" },
  { id: "watermark", label: "Watermark", icon: "©️" },
  { id: "saturation", label: "Saturation", icon: "🌈" },
];

export default function AugmentationPage() {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [effect, setEffect] = useState<EffectType>("none");
  const [intensity, setIntensity] = useState<number>(50);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newImgs = acceptedFiles.map((f) => ({
      id: Math.random().toString(36).substring(7),
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setImages((prev) => [...prev, ...newImgs]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'image/*': [] } });

  // Processing engine using Canvas
  const applyEffectToImage = async (imgObj: UploadedImage, eff: EffectType, val: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(imgObj.previewUrl);

        canvas.width = img.width;
        canvas.height = img.height;

        // Apply CSS filters
        if (eff === "grayscale") {
          ctx.filter = `grayscale(${val}%)`;
        } else if (eff === "blur") {
          ctx.filter = `blur(${(val / 100) * 10}px)`;
        } else if (eff === "saturation") {
          ctx.filter = `saturate(${val * 3}%)`;
        } else {
          ctx.filter = "none";
        }

        // Apply transform
        if (eff === "flip") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(img, 0, 0);

        // Reset transform & filter for direct pixel/text manip
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = "none";

        if (eff === "noise") {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          const noiseLevel = (val / 100) * 150;
          for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * noiseLevel;
            data[i] = Math.min(255, Math.max(0, data[i] + noise));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
          }
          ctx.putImageData(imgData, 0, 0);
        }

        if (eff === "watermark") {
          ctx.fillStyle = `rgba(255, 255, 255, ${val / 100})`;
          const fontSize = Math.max(30, canvas.width / 10);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-Math.PI / 6);
          ctx.fillText("AUGMENTED", 0, 0);
        }

        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = imgObj.previewUrl;
    });
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);
    // Process in batches so we don't freeze the browser completely
    const updated = [];
    for (const img of images) {
      const processed = await applyEffectToImage(img, effect, intensity);
      updated.push({ ...img, processedUrl: processed });
    }
    setImages(updated);
    setIsProcessing(false);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    let count = 0;
    images.forEach((img, i) => {
      const url = img.processedUrl || img.previewUrl;
      const base64Data = url.split(',')[1];
      if (base64Data) {
        zip.file(`aug_${effect}_${i}.jpg`, base64Data, { base64: true });
        count++;
      }
    });
    if (count > 0) {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `augmentation_results.zip`);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <AppShell breadcrumbs={[{ label: "Augmentation Workspace" }]}>
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        
        {/* Sidebar Controls */}
        <div style={{ width: 300, background: "var(--color-bg-surface)", borderRight: "1px solid var(--color-border)", display: "flex", flexDirection: "column", zIndex: 10 }}>
          <div style={{ padding: "20px", borderBottom: "1px solid var(--color-border)" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <Settings2 size={18} style={{ color: "var(--color-accent)" }} /> Augmentation Settings
            </h2>
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 4 }}>
              Apply effects to multiple images instantly.
            </p>
          </div>

          <div style={{ padding: 20, flex: 1, overflowY: "auto" }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 12, textTransform: "uppercase" }}>
              Effect Type
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
              {EFFECTS.map((eff) => (
                <button
                  key={eff.id}
                  onClick={() => setEffect(eff.id)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 8,
                    border: "1px solid",
                    borderColor: effect === eff.id ? "var(--color-accent)" : "var(--color-border)",
                    background: effect === eff.id ? "rgba(59,130,246,0.1)" : "transparent",
                    color: effect === eff.id ? "#60a5fa" : "var(--color-text-secondary)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.15s"
                  }}
                >
                  <span style={{ fontSize: 20 }}>{eff.icon}</span>
                  {eff.label}
                </button>
              ))}
            </div>

            {effect !== "none" && effect !== "flip" && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                    <SlidersHorizontal size={14} /> Intensity (Ketebalan)
                  </label>
                  <span style={{ fontSize: 12, color: "var(--color-accent)", fontWeight: 700 }}>{intensity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={intensity}
                  onChange={(e) => setIntensity(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--color-accent)", cursor: "pointer" }}
                />
              </div>
            )}
          </div>

          <div style={{ padding: 20, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              className="btn-primary"
              onClick={handleProcessAll}
              disabled={images.length === 0 || isProcessing}
              style={{ width: "100%", justifyContent: "center", padding: "12px", display: "flex", alignItems: "center", gap: 8 }}
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />} 
              {isProcessing ? "Processing..." : "Apply to All"}
            </button>
            <button
              className="btn-secondary"
              onClick={handleDownloadZip}
              disabled={images.length === 0 || isProcessing}
              style={{ width: "100%", justifyContent: "center", padding: "12px", display: "flex", alignItems: "center", gap: 8 }}
            >
              <Download size={16} /> Download ZIP
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          
          <div
            {...getRootProps()}
            style={{
              border: `2px dashed ${isDragActive ? "var(--color-accent)" : "var(--color-border)"}`,
              borderRadius: 16,
              background: isDragActive ? "rgba(59,130,246,0.05)" : "var(--color-bg-surface)",
              padding: "40px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.2s ease",
              marginBottom: 24,
            }}
          >
            <input {...getInputProps()} />
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--color-bg-card)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "var(--color-text-muted)" }}>
              <Upload size={24} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 8 }}>
              Drag & drop images here
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
              or click to browse multiple files
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <ImageIcon size={18} /> Uploaded Images <span className="badge">{images.length}</span>
            </h3>
            {images.length > 0 && (
              <button onClick={() => setImages([])} className="btn-icon" style={{ color: "var(--color-text-secondary)", fontSize: 12, padding: "4px 8px" }}>
                <Trash2 size={14} style={{ marginRight: 4 }} /> Clear All
              </button>
            )}
          </div>

          {images.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              No images uploaded yet.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {images.map((img) => (
                <div key={img.id} className="glass-card" style={{ padding: 8, position: "relative" }}>
                  <button
                    onClick={() => removeImage(img.id)}
                    style={{ position: "absolute", top: 12, right: 12, background: "rgba(0,0,0,0.5)", border: "none", color: "white", borderRadius: "50%", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 10 }}
                  >
                    <X size={14} />
                  </button>
                  <div style={{ aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", background: "#000" }}>
                    <img
                      src={img.processedUrl || img.previewUrl}
                      alt="preview"
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 140 }}>
                      {img.file.name}
                    </span>
                    {img.processedUrl && <span style={{ color: "#10b981", fontWeight: 600, fontSize: 10 }}>PROCESSED</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </AppShell>
  );
}

// Separate missing icon component inside the file to avoid import issues from lucide if X is not imported
function X(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={props.size || 24} height={props.size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  );
}
