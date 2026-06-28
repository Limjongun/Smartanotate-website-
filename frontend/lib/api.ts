// API client for SmartAnnotate AI backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(err.detail || "Request failed", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name: string) =>
    request<{ id: string; email: string; name: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => request<{ id: string; email: string; name: string; role: string }>("/auth/me"),
};

// ─── PROJECTS ────────────────────────────────────────────────────────────────
export const projectsApi = {
  list: () => request<Project[]>("/projects"),
  get: (id: string) => request<Project>(`/projects/${id}`),
  create: (data: { name: string; description?: string; classes: string[] }) =>
    request<Project>("/projects", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ name: string; classes: string[] }>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  updateClasses: (id: string, classes: string[]) =>
    request<{id: string, classes: string[]}>(`/projects/${id}/classes`, { method: "PATCH", body: JSON.stringify({ classes }) }),
  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  downloadZip: async (id: string, projectName: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const res = await fetch(`${API_BASE}/projects/${id}/download-zip`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error("Failed to download zip");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/ /g, "_").toLowerCase()}_project_ready.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

// ─── DATASETS / IMAGES ───────────────────────────────────────────────────────
export const datasetsApi = {
  list: (projectId: string) => request<Dataset[]>(`/datasets?project_id=${projectId}`),
  create: (projectId: string, name: string) =>
    request<Dataset>(`/datasets`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
};

export const imagesApi = {
  list: (datasetId: string) => request<ImageItem[]>(`/images/${datasetId}`),
  listByProject: (projectId: string) => request<ImageItem[]>(`/projects/${projectId}/images`),
  get: (imageId: string) => request<ImageItem>(`/images/detail/${imageId}`),
  upload: (projectId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return fetch(`${API_BASE}/datasets/${projectId}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then((r) => r.json()) as Promise<ImageItem[]>;
  },
  delete: (imageId: string) =>
    request<void>(`/images/detail/${imageId}`, { method: "DELETE" }),
};

// ─── ANNOTATIONS ─────────────────────────────────────────────────────────────
export const annotationsApi = {
  get: (imageId: string) => request<Annotation[]>(`/annotations/${imageId}`),
  save: (imageId: string, annotations: AnnotationInput[]) =>
    request<Annotation[]>(`/annotations/${imageId}`, {
      method: "POST",
      body: JSON.stringify({ annotations }),
    }),
  update: (annId: string, data: Partial<AnnotationInput>) =>
    request<Annotation>(`/annotations/item/${annId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (annId: string) =>
    request<void>(`/annotations/item/${annId}`, { method: "DELETE" }),
};

// ─── TRAINING ────────────────────────────────────────────────────────────────
export const trainingApi = {
  start: (projectId: string, model: "yolo11n" | "yolo11s", epochs: number) =>
    request<TrainingJob>(`/train/${projectId}`, {
      method: "POST",
      body: JSON.stringify({ model_type: model, epochs }),
    }),
  status: (jobId: string) => request<TrainingJob>(`/train/status/${jobId}`),
  list: (projectId: string) => request<TrainingJob[]>(`/train/list/${projectId}`),
  cancel: (jobId: string) =>
    request<void>(`/train/cancel/${jobId}`, { method: "POST" }),
};

// ─── PREDICTIONS ─────────────────────────────────────────────────────────────
export const predictApi = {
  runBatch: (projectId: string) =>
    request<{ task_id: string }>(`/predict/${projectId}`, { method: "POST" }),
  getForImage: (imageId: string) =>
    request<Annotation[]>(`/predict/image/${imageId}`),
};

// ─── MODELS ──────────────────────────────────────────────────────────────────
export const modelsApi = {
  list: (projectId: string) => request<MLModel[]>(`/models/${projectId}`),
  get: (modelId: string) => request<MLModel>(`/models/detail/${modelId}`),
  setActive: (modelId: string) =>
    request<MLModel>(`/models/activate/${modelId}`, { method: "POST" }),
  delete: (modelId: string) =>
    request<void>(`/models/detail/${modelId}`, { method: "DELETE" }),
};

// ─── EXPORT ──────────────────────────────────────────────────────────────────
export const exportApi = {
  export: (projectId: string, format: string, split: string) =>
    request<{ download_url: string }>(`/export/${projectId}`, {
      method: "POST",
      body: JSON.stringify({ format, split }),
    }),
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: (projectId: string) => request<Analytics>(`/analytics/${projectId}`),
  overview: () => request<OverviewStats>("/analytics/overview"),
};

// ─── AUTO ANNOTATE ───────────────────────────────────────────────────────────
export const autoAnnotateApi = {
  getActiveTasks: () => request<ActiveTask[]>("/auto-annotate/active"),
};


// ─── TYPES ───────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  classes: string[];
  created_at: string;
  updated_at: string;
  total_images: number;
  annotated_images: number;
  model_accuracy?: number;
  active_model?: string;
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  total_images: number;
}

export interface ImageItem {
  id: string;
  dataset_id: string;
  project_id?: string;
  filename: string;
  url: string;
  width: number;
  height: number;
  status: "unannotated" | "annotated" | "auto_approved" | "review_required" | "skipped";
  split: "train" | "val" | "test";
  annotation_count: number;
  created_at: string;
}

export interface Annotation {
  id: string;
  image_id: string;
  class_name: string;
  class_id: number;
  type: "bbox" | "polygon" | "segmentation" | "pose";
  bbox?: { x: number; y: number; w: number; h: number };
  polygon?: { x: number; y: number }[];
  keypoints?: { id: number; name: string; x: number; y: number; visible: boolean }[];
  confidence?: number;
  source: "manual" | "auto" | "reviewed";
  created_at: string;
}

export interface AnnotationInput {
  class_name: string;
  class_id: number;
  type: "bbox" | "polygon" | "segmentation" | "pose";
  bbox?: { x: number; y: number; w: number; h: number };
  polygon?: { x: number; y: number }[];
  keypoints?: { id: number; name: string; x: number; y: number; visible: boolean }[];
  confidence?: number;
  source: "manual" | "auto" | "reviewed";
}

export interface TrainingJob {
  id: string;
  project_id: string;
  model_type: "yolo11n" | "yolo11s";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  epochs: number;
  current_epoch: number;
  metrics?: {
    mAP50: number;
    mAP50_95: number;
    precision: number;
    recall: number;
    loss: number;
  };
  started_at?: string;
  completed_at?: string;
  weights_path?: string;
  error?: string;
}

export interface MLModel {
  id: string;
  project_id: string;
  version: string;
  model_type: "yolo11n" | "yolo11s";
  weights_path: string;
  mAP50: number;
  mAP50_95: number;
  precision: number;
  recall: number;
  is_active: boolean;
  training_job_id: string;
  created_at: string;
}

export interface Analytics {
  total_images: number;
  annotated_images: number;
  remaining_images: number;
  auto_approved: number;
  review_required: number;
  manual_annotated: number;
  model_accuracy: number;
  precision: number;
  recall: number;
  mAP50: number;
  mAP50_95: number;
  class_distribution: { class_name: string; count: number }[];
  annotation_progress: { date: string; count: number }[];
  training_history: { version: string; mAP50: number; date: string }[];
}

export interface OverviewStats {
  kpis: {
    total_projects: number;
    total_datasets: number;
    total_images: number;
    total_annotations: number;
  };
  class_distribution: { name: string; count: number }[];
  source_distribution: { name: string; value: number }[];
  status_distribution: { name: string; value: number }[];
}

export interface ActiveTask {
  project_id: string;
  project_name: string;
  model: string;
  progress: number;
  current: number;
  total: number;
  eta: string;
}

export default request;
