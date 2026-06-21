"use client";

import AppShell from "@/components/layout/AppShell";
import { Zap, Play, CheckCircle, Clock, AlertCircle, RefreshCw, Layers, FolderOpen } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useProjectStore } from "@/store/projectStore";
import api from "@/lib/api";

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  auto_approved:   { color: "#10b981", label: "Auto Approved",   icon: CheckCircle },
  review_required: { color: "#f59e0b", label: "Review Required", icon: Clock },
  manual_required: { color: "#ef4444", label: "Manual Required", icon: AlertCircle },
};

interface ClassStat {
  class_id: string;
  class_name: string;
  count: number;
}

export default function AutoAnnotationPage() {
  const { activeProjectId, isAutoAnnotating, setAutoAnnotating } = useProjectStore();
  const [loadingStatus, setLoadingStatus] = useState(true);
  
  const [stats, setStats] = useState<ClassStat[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [unannotatedCount, setUnannotatedCount] = useState(0);
  const [progress, setProgress] = useState<{current: number, total: number, status: string, error?: string} | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (activeProjectId) {
      fetchStatus();
    } else {
      setLoadingStatus(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoAnnotating && activeProjectId) {
      interval = setInterval(async () => {
        try {
          const res = await api<{status: string, current: number, total: number, error?: string}>(`/auto-annotate/progress/${activeProjectId}`);
          if (res.status === "completed") {
            setProgress(res);
            setAutoAnnotating(false);
            clearInterval(interval);
            fetchStatus();
            alert("Auto annotation completed successfully!");
          } else if (res.status === "error") {
            setProgress(res);
            setAutoAnnotating(false);
            clearInterval(interval);
            alert("Error during auto annotation: " + res.error);
          } else {
            setProgress(res);
          }
          setElapsedTime(prev => prev + 1);
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAutoAnnotating, activeProjectId]);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await api<{ classes: ClassStat[]; ready: boolean; unannotated_count: number }>(`/auto-annotate/status/${activeProjectId}`);
      setStats(res.classes || []);
      setIsReady(res.ready);
      setUnannotatedCount(res.unannotated_count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleRun = async () => {
    if (!activeProjectId) return;
    setAutoAnnotating(true);
    setElapsedTime(0);
    try {
      await api(`/auto-annotate/start/${activeProjectId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      alert("Zero-shot auto annotation started in the background. Check your terminal to see the detection process.");
    } catch (e) {
      console.error(e);
      alert("Failed to start auto annotation.");
      setAutoAnnotating(false);
    }
  };

  return (
    <AppShell
      breadcrumbs={[{ label: "Auto Annotation" }]}
      topbarActions={
        <button 
          className="btn-primary" 
          onClick={handleRun} 
          disabled={isAutoAnnotating || !isReady || unannotatedCount === 0}
        >
          {isAutoAnnotating ? <RefreshCw size={14} className="animate-spin-slow" /> : <Play size={14} />}
          {isAutoAnnotating ? "Running in Background..." : "Start Auto Annotation"}
        </button>
      }
    >
      <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 30 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 8 }}>
            Auto Annotation <span style={{fontSize: 12, background: "var(--color-accent)", color: "white", padding: "2px 8px", borderRadius: 12, verticalAlign: "middle", marginLeft: 8}}>EXPERIMENTAL</span>
          </h1>
          <p style={{ fontSize: 14, color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
            Use YOLO-World open-vocabulary detection to automatically apply bounding boxes to remaining images based on the class names you defined.
            Zero training required! Just make sure your class names are in English (e.g., "face", "car").
          </p>
        </div>

        {!activeProjectId ? (
          <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
            <div style={{ marginBottom: 16 }}>Please select a project first to use Auto Annotation.</div>
            <Link href="/projects" style={{ textDecoration: "none" }}>
              <button className="btn-primary" style={{ padding: "8px 16px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 8 }}>
                <FolderOpen size={16} /> Select Project
              </button>
            </Link>
          </div>
        ) : loadingStatus ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <RefreshCw className="animate-spin" size={24} color="var(--color-text-muted)" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {/* Readiness Card */}
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ 
                  width: 40, height: 40, borderRadius: 8, 
                  background: isReady ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isReady ? "#10b981" : "#ef4444"
                }}>
                  {isReady ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {isReady ? "Ready to Detect" : "No Classes Found"}
                  </h3>
                  <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                    {isReady ? "Class names detected. Ready for zero-shot inference." : "Create at least 1 annotation to define your target class names."}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
                {stats.length === 0 ? (
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>No annotations found in this project.</div>
                ) : (
                  stats.map((s) => (
                    <div key={s.class_id} style={{ 
                      padding: "8px 16px", borderRadius: 20, 
                      border: `1px solid rgba(16,185,129,0.3)`,
                      background: "var(--color-bg-surface)",
                      display: "flex", alignItems: "center", gap: 8
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>{s.class_name}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>Found</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Config Card */}
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={18} style={{ color: "var(--color-accent)" }} /> Inference Configuration
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>
                    Target Dataset
                  </label>
                  <div style={{ padding: "12px", background: "var(--color-bg-surface)", borderRadius: 8, border: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--color-text-primary)" }}>Unannotated Images</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-accent)" }}>{unannotatedCount} files</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 8 }}>
                    The trained model will run inference on these files automatically.
                  </p>
                </div>
              </div>
            </div>

            {isAutoAnnotating && (
              <div className="glass-card" style={{ padding: 24, textAlign: "center", border: "1px solid var(--color-accent)" }}>
                <RefreshCw size={32} className="animate-spin-slow" style={{ color: "var(--color-accent)", margin: "0 auto 16px" }} />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 4 }}>
                  Zero-Shot Inference in Progress
                </h3>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--color-accent)", marginBottom: 16, fontFamily: "monospace" }}>
                  {formatTime(elapsedTime)}
                </div>
                {progress && progress.total > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8, color: "var(--color-text-secondary)" }}>
                      <span>Processing...</span>
                      <span>{progress.current} / {progress.total} images</span>
                    </div>
                    <div style={{ height: 6, background: "var(--color-bg-surface)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ 
                        height: "100%", 
                        width: `${(progress.current / progress.total) * 100}%`,
                        background: "var(--color-accent)",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                )}
                {!progress && (
                  <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginTop: 8 }}>
                    Initializing model...
                  </p>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </AppShell>
  );
}
