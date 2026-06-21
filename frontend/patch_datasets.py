import sys
import re

with open(r"D:\anotation\frontend\app\datasets\page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add downloading state
if "const [downloadingId, setDownloadingId] = useState<string | null>(null);" not in content:
    content = content.replace("const [newDatasetName, setNewDatasetName] = useState(\"\");", 
                              "const [newDatasetName, setNewDatasetName] = useState(\"\");\n  const [downloadingId, setDownloadingId] = useState<string | null>(null);")

# Add download function
download_fn = """
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
"""

if "const handleDownload = async" not in content:
    content = content.replace("const createMutation = useMutation({", download_fn + "\n  const createMutation = useMutation({")

# Replace the button
old_btn = """                        <button 
                          className="btn-secondary" 
                          style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                          onClick={() => alert("Fitur Save/Export untuk seluruh dataset akan segera hadir!")}
                        >
                          <Download size={14} /> Save Dataset
                        </button>"""

new_btn = """                        <button 
                          className="btn-secondary" 
                          style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
                          onClick={() => handleDownload(ds.id, ds.name)}
                          disabled={downloadingId === ds.id}
                        >
                          {downloadingId === ds.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                          {downloadingId === ds.id ? "Saving..." : "Save Dataset"}
                        </button>"""

content = content.replace(old_btn, new_btn)

with open(r"D:\anotation\frontend\app\datasets\page.tsx", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched datasets/page.tsx with download logic")
