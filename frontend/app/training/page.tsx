"use client";

import AppShell from "@/components/layout/AppShell";
import {
  Activity, Plus, Play, Square, ChevronRight,
  Clock, CheckCircle, XCircle, AlertCircle, BarChart2, Cpu, Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingApi, projectsApi, Project, TrainingJob } from "@/lib/api";

const STATUS_CONFIG = {
  running:   { icon: Activity,     color: "#f59e0b", label: "Running" },
  completed: { icon: CheckCircle,  color: "#10b981", label: "Completed" },
  failed:    { icon: XCircle,      color: "#ef4444", label: "Failed" },
  queued:    { icon: AlertCircle,  color: "#6b7280", label: "Queued" },
};

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
        <span style={{ color, fontWeight: 600 }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
    </div>
  );
}

function StartTrainingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [model, setModel] = useState<"yolo11n" | "yolo11s">("yolo11s");
  const [epochs, setEpochs] = useState(60);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  useEffect(() => {
    if (projects.length > 0 && !projectId) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const MODEL_INFO = {
    yolo11n: { label: "YOLO11n — Nano", desc: "~6MB, fastest inference, good for edge devices", speed: "🚀 Very Fast" },
    yolo11s: { label: "YOLO11s — Small", desc: "~22MB, balanced speed vs accuracy", speed: "⚡ Fast" },
  };

  const startMutation = useMutation({
    mutationFn: () => trainingApi.start(projectId, model, epochs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training_jobs"] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 20 }}>
          Start Training Job
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 6 }}>
            Project
          </label>
          <select
            className="input-field"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "block", marginBottom: 8 }}>
            Model Selection
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["yolo11n", "yolo11s"] as const).map((m) => (
              <div
                key={m}
                onClick={() => setModel(m)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: `2px solid ${model === m ? "var(--color-accent)" : "var(--color-border)"}`,
                  cursor: "pointer",
                  background: model === m ? "rgba(59,130,246,0.08)" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: `2px solid ${model === m ? "#3b82f6" : "var(--color-border)"}`,
                      background: model === m ? "#3b82f6" : "transparent",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
                    {MODEL_INFO[m].label}
                  </span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-muted)" }}>
                    {MODEL_INFO[m].speed}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "var(--color-text-muted)", paddingLeft: 26 }}>
                  {MODEL_INFO[m].desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span>Epochs</span> <span style={{ color: "#60a5fa" }}>{epochs}</span>
          </label>
          <input
            type="range" min={10} max={200} step={5}
            value={epochs}
            onChange={(e) => setEpochs(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#3b82f6" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--color-text-muted)", marginTop: 2 }}>
            <span>10 (Quick)</span><span>100 (Standard)</span><span>200 (Deep)</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onClose} disabled={startMutation.isPending}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => startMutation.mutate()}
            disabled={!projectId || startMutation.isPending}
          >
            {startMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} 
            {startMutation.isPending ? "Starting..." : "Start Training"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Poll jobs list if there's any running job
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["training_jobs"],
    queryFn: () => trainingApi.list("all"),
    refetchInterval: (query) => {
      const activeJobs = (query.state.data as any[])?.some(j => j.status === "running" || j.status === "queued");
      return activeJobs ? 3000 : false;
    },
  });

  const selectedJob = jobs.find((j: any) => j.id === selectedJobId) || (jobs.length > 0 ? jobs[0] : null);

  return (
    <AppShell
      breadcrumbs={[{ label: "Training" }]}
      topbarActions={
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New Training Job
        </button>
      }
    >
      <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 340px", gap: 16 }}>

        {/* Jobs list */}
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 16 }}>
            Training Jobs
          </h1>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <Loader2 size={24} className="animate-spin text-muted" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--color-text-muted)" }}>
                No training jobs found. Start a new one!
              </div>
            ) : jobs.map((job: any) => {
              const st = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.queued;
              const pct = job.epochs > 0 ? Math.round((job.currentEpoch / job.epochs) * 100) : 0;
              const isSelected = selectedJob?.id === job.id;

              return (
                <div
                  key={job.id}
                  className="glass-card"
                  onClick={() => setSelectedJobId(job.id)}
                  style={{
                    padding: 16,
                    cursor: "pointer",
                    border: `1px solid ${isSelected ? "var(--color-accent)" : "var(--color-border)"}`,
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 2 }}>
                        {job.project}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span className="badge badge-purple">{(job.model || "YOLO").toUpperCase()}</span>
                        <span className="badge" style={{ background: `${st.color}20`, color: st.color }}>
                          <st.icon size={10} /> {st.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-muted)", textAlign: "right" }}>
                      <div>Started {job.startedAt}</div>
                      {job.duration && job.duration !== "N/A" && <div>Duration: {job.duration}</div>}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="progress-bar" style={{ marginBottom: 6 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: job.status === "failed"
                          ? "#ef4444"
                          : job.status === "completed"
                          ? "#10b981"
                          : "linear-gradient(90deg, #3b82f6, #60a5fa)",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12 }}>
                    <span>Epoch {job.currentEpoch} / {job.epochs}</span>
                    <span>{pct}%</span>
                  </div>

                  {/* Metrics */}
                  {job.mAP50 != null && (
                    <div style={{ display: "flex", gap: 10 }}>
                      {[
                        { label: "mAP50", value: job.mAP50, color: "#3b82f6" },
                        { label: "Precision", value: job.precision || 0, color: "#10b981" },
                        { label: "Recall", value: job.recall || 0, color: "#8b5cf6" },
                      ].map((m) => (
                        <div
                          key={m.label}
                          style={{
                            flex: 1, padding: "6px 8px",
                            background: "var(--color-bg-surface)",
                            borderRadius: 6, textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{m.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: m.color }}>
                            {(m.value * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                      {job.loss != null && (
                        <div
                          style={{
                            flex: 1, padding: "6px 8px",
                            background: "var(--color-bg-surface)",
                            borderRadius: 6, textAlign: "center",
                          }}
                        >
                          <div style={{ fontSize: 10, color: "var(--color-text-muted)" }}>Loss</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>
                            {job.loss.toFixed(3)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {selectedJob ? (
            <div className="glass-card" style={{ padding: 18, position: "sticky", top: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", marginBottom: 14 }}>
                {selectedJob.project}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {[
                  { label: "Model", value: (selectedJob.model || "").toUpperCase() },
                  { label: "Status", value: STATUS_CONFIG[selectedJob.status as keyof typeof STATUS_CONFIG]?.label || selectedJob.status },
                  { label: "Total Epochs", value: selectedJob.epochs },
                  { label: "Current Epoch", value: selectedJob.currentEpoch },
                  { label: "Started", value: selectedJob.startedAt },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: "var(--color-text-muted)" }}>{label}</span>
                    <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>

              {selectedJob.mAP50 != null && (
                <>
                  <div className="divider" />
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-primary)", margin: "12px 0 10px" }}>
                    Metrics
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <MetricBar label="mAP50" value={selectedJob.mAP50} color="#3b82f6" />
                    {selectedJob.precision != null && <MetricBar label="Precision" value={selectedJob.precision} color="#10b981" />}
                    {selectedJob.recall != null && <MetricBar label="Recall" value={selectedJob.recall} color="#8b5cf6" />}
                  </div>
                </>
              )}

              {selectedJob.status === "running" && (
                <button
                  className="btn-ghost"
                  style={{ width: "100%", marginTop: 14, fontSize: 12, color: "#ef4444", borderColor: "#ef444440" }}
                >
                  <Square size={13} /> Stop Training
                </button>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
              <BarChart2 size={40} style={{ color: "var(--color-text-muted)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
                Select a job to see details
              </p>
            </div>
          )}
        </div>
      </div>

      {showModal && <StartTrainingModal onClose={() => setShowModal(false)} />}
    </AppShell>
  );
}
