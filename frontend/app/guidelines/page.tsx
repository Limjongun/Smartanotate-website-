import AppShell from "@/components/layout/AppShell";
import { BookOpen, CheckCircle, XCircle, AlertTriangle, Lightbulb } from "lucide-react";

export default function GuidelinesPage() {
  return (
    <AppShell title="Annotation Guidelines">
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 20px 60px", color: "var(--color-text-primary)" }}>
        
        {/* Hero Section */}
        <div style={{ 
          background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1))",
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: 16,
          padding: "40px 30px",
          marginBottom: 40,
          textAlign: "center"
        }}>
          <div style={{ 
            width: 60, height: 60, borderRadius: 16, background: "rgba(59,130,246,0.15)", 
            color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", 
            margin: "0 auto 20px" 
          }}>
            <BookOpen size={30} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, background: "linear-gradient(to right, #3b82f6, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Annotation Guidelines
          </h1>
          <p style={{ fontSize: 15, color: "var(--color-text-secondary)", maxWidth: 600, margin: "0 auto", lineHeight: 1.6 }}>
            High-quality AI models require high-quality data. Follow these golden rules to ensure your bounding boxes and polygons are perfectly drawn for training the YOLO model.
          </p>
        </div>

        {/* Golden Rules */}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <Lightbulb style={{ color: "#f59e0b" }} size={20} />
          The Golden Rules
        </h2>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 40 }}>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#10b981", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <CheckCircle size={18} /> Tight Bounding Boxes
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Boxes should perfectly enclose the visible part of the object. Do not leave too much empty space inside the box, but make sure no part of the object is cut off.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#ef4444", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <XCircle size={18} /> Don't Guess Occlusions
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              If a car is partially hidden behind a tree, only draw the box around the <strong>visible</strong> parts of the car. Do not estimate or draw where you think the rest of the car is.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#f59e0b", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <AlertTriangle size={18} /> Ignore Tiny Objects
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              If an object is heavily blurred, too far away, or smaller than 15x15 pixels, skip it. Labeling unrecognizable noise degrades the model's accuracy.
            </p>
          </div>
          <div className="glass-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#3b82f6", display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <BookOpen size={18} /> Consistent Categories
            </h3>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
              Always double-check the class you are annotating. Do not label a "Van" as a "Car" if there is a specific category for Vans. Consistency across the dataset is key.
            </p>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Keyboard Shortcuts</h2>
        <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)" }}>Action</th>
                <th style={{ padding: "16px 24px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)" }}>Shortcut (Windows / Mac)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { action: "Draw Bounding Box", key: "B" },
                { action: "Draw Polygon", key: "P" },
                { action: "Pan Tool (Drag Canvas)", key: "Space + Drag" },
                { action: "Zoom In / Out", key: "Scroll Wheel" },
                { action: "Undo Last Action", key: "Ctrl + Z" },
                { action: "Save & Next Image", key: "Enter" },
                { action: "Skip Image", key: "Shift + S" }
              ].map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "16px 24px", fontSize: 14 }}>{row.action}</td>
                  <td style={{ padding: "16px 24px" }}>
                    <kbd style={{ 
                      background: "var(--color-bg-surface)", 
                      border: "1px solid var(--color-border)", 
                      borderRadius: 6, 
                      padding: "4px 10px", 
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: "#60a5fa"
                    }}>
                      {row.key}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AppShell>
  );
}
