# SmartAnnotate AI

**Platform Anotasi Berbasis Active Learning dan Human-in-the-Loop**

---

SmartAnnotate AI merupakan platform anotasi dataset yang didesain untuk mempercepat proses pelabelan data dalam pengembangan model *Computer Vision*. Melalui pendekatan **Human-in-the-Loop Active Learning**, pengguna hanya perlu memberikan anotasi manual pada sampel awal (5 hingga 10 citra). Selanjutnya, sistem akan mengambil alih proses anotasi melalui mekanisme pelabelan otomatis menggunakan model pra-latih yang ditingkatkan secara bertahap (*incremental training*).

Sistem ini meminimalkan pekerjaan repetitif dalam pengumpulan dan penyusunan dataset, meningkatkan efisiensi waktu pemrosesan, dan memfasilitasi manajemen dataset dalam skala besar.

---

## Spesifikasi dan Kemampuan Sistem

- **Otomatisasi Berbasis Active Learning**: Reduksi waktu pelabelan manual dengan otomatisasi menggunakan model deteksi dan segmentasi (YOLO, RT-DETR).
- **Mekanisme Human-in-the-Loop**: Integrasi validasi manual (*Human Review*) pada data dengan *confidence score* rendah untuk menjaga akurasi anotasi secara presisi.
- **Konversi Format Dinamis**: Dukungan transformasi dan konversi dua arah antar-format dataset standar industri (*YOLO, COCO, Pascal VOC, LabelMe, CVAT, Supervisely*).
- **Skalabilitas & Multi-User**: Arsitektur sistem mendukung pemrosesan data berskala besar, dilengkapi dengan manajemen hak akses dan ruang kerja kolaboratif (*Team Workspace*).

## Arsitektur Teknis

### 1. Auto Annotation & Active Learning Pipeline
- **Auto Labeling & Segmentation**: Terintegrasi dengan arsitektur model seperti keluarga YOLO (YOLOv8, YOLOv9, YOLOv10, YOLO11) dan RT-DETR.
- **Confidence Filtering Logic**: 
  - `> 90%`: *Auto Approve*
  - `70% - 90%`: *Review Required*
  - `< 70%`: *Manual Annotation*
- **Smart Sample Selection**: Menggunakan metode iteratif seperti *Uncertainty Sampling*, *Diversity Sampling*, dan *Hard Example Mining*.

### 2. Annotation & Dataset Management
- **Fitur Anotasi**: Bounding Box, Polygon, Segmentation Mask, Keypoints, Brush/Eraser Tool, dan Magic Wand Selection.
- **Dataset Operations**: Mendukung operasional tingkat lanjut seperti Dataset Versioning, Splitting, Merging, Import/Export, serta Audit Trail (*Reviewer Workflow*).

### 3. Tech Stack (Stack Teknologi)
- **Frontend**: Next.js, React, TypeScript, TailwindCSS, Shadcn UI, Konva.js (*Canvas Rendering*).
- **Backend & API Gateway**: FastAPI (Python), PostgreSQL, Redis, Celery (sebagai *Message Queue* dan *Background Task Handler*).
- **AI Engine**: YOLO11, SAM 2, OpenCV, PyTorch, ONNX Runtime, TensorRT.
- **Infrastruktur & MLOps**: MinIO / AWS S3, MLflow, Docker, Kubernetes.

---

## Alur Kerja Sistem (System Workflow)

1. **Inisialisasi**: Pembuatan *project workspace* dan pengunggahan dataset (citra atau video) mentah.
2. **Anotasi Awal**: Pelabelan sampel dasar sebanyak 5-10 gambar secara manual.
3. **Training Iterasi Pertama**: Sistem menjalankan pelatihan awal (*Quick Training*) menggunakan sampel dasar.
4. **Mass Inference**: Inferensi secara massal (*batch prediction*) terhadap seluruh sisa dataset yang belum berlabel.
5. **Quality Assurance (Human Review)**: Sortasi data berdasarkan metrik probabilitas (*confidence score*). Pengguna memberikan perbaikan (*correction*) hanya pada anotasi dengan skor rendah.
6. **Incremental Retraining**: Pelatihan ulang model secara otomatis untuk menginkorporasikan koreksi dari pengguna.
7. **Ekspor Data**: Dataset berlabel dikonversi dan diekspor sesuai format tujuan (*target format*).

---

## Pengembangan Lanjutan (Roadmap)

- Integrasi penuh **SAM 2** dan **Grounding DINO** untuk anotasi berbasis *Zero-Shot Detection*.
- Implementasi algoritma *Video Object Tracking*, anotasi 3D, serta integrasi LiDAR.
- Pengembangan kapabilitas sistem menuju *Federated Learning* dan *Edge Training* untuk pemenuhan kepatuhan privasi data (*Data Privacy Compliance*).
