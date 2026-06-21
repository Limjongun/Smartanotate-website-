import os
import zipfile
import io
from fastapi.responses import StreamingResponse

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import uuid
import time
import threading
import shutil
import yaml
from ultralytics import YOLO
from pydantic import BaseModel

from models.database import init_db, get_db, DATABASE_URL, User, Project, Dataset, Image, Annotation, TrainingJob, MLModel

app = FastAPI(title="SmartAnnotate AI API")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for demo
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.staticfiles import StaticFiles

@app.on_event("startup")
def on_startup():
    init_db()
    os.makedirs("uploads", exist_ok=True)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# --- AUTH ENDPOINTS ---
mock_users = {
    "admin@local.dev": {"id": "1", "email": "admin@local.dev", "name": "Admin User", "password": "password", "role": "admin"}
}
current_user_email = "admin@local.dev"

@app.post("/auth/login")
def login(data: dict):
    email = data.get("email")
    global current_user_email
    if email in mock_users:
        current_user_email = email
    else:
        current_user_email = email
        mock_users[email] = {"id": str(uuid.uuid4()), "email": email, "name": "User", "password": "password", "role": "user"}
    return {"access_token": "mock-jwt-token", "token_type": "bearer"}

@app.post("/auth/register")
def register(data: dict):
    email = data.get("email")
    global current_user_email
    current_user_email = email
    mock_users[email] = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.get("name", "New User"),
        "password": data.get("password"),
        "role": "user"
    }
    return mock_users[email]

@app.get("/auth/me")
def get_me():
    user = mock_users.get(current_user_email)
    if user:
        return user
    return {"id": "1", "email": "admin@local.dev", "name": "Admin User", "role": "admin"}

# --- PROJECTS ENDPOINTS ---
@app.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    # If empty, create mock projects
    if not projects:
        p1 = Project(id=str(uuid.uuid4()), name="Vehicle Detection", description="Deteksi kendaraan di jalan", classes=json.dumps(["car", "bus", "truck", "motorcycle"]))
        db.add(p1)
        db.commit()
        projects = [p1]
    
    result = []
    for p in projects:
        total = db.query(Image).filter(Image.dataset_id.in_([d.id for d in db.query(Dataset).filter(Dataset.project_id == p.id)])).count()
        annotated = db.query(Image).filter(Image.dataset_id.in_([d.id for d in db.query(Dataset).filter(Dataset.project_id == p.id)]), Image.status == "annotated").count()
        active_model = db.query(MLModel).filter(MLModel.project_id == p.id, MLModel.is_active == True).first()
        
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "classes": json.loads(p.classes) if p.classes else [],
            "created_at": p.created_at.strftime("%Y-%m-%d"),
            "total_images": total or 1250, # Mock counts if 0
            "annotated_images": annotated or 620,
            "model_accuracy": active_model.map50 if active_model else 0.947,
            "active_model": active_model.version if active_model else "YOLO11s",
            "status": "active"
        })
    return result

@app.post("/projects")
def create_project(data: dict, db: Session = Depends(get_db)):
    new_proj = Project(
        id=str(uuid.uuid4()),
        name=data.get("name"),
        description=data.get("description", ""),
        classes=json.dumps(data.get("classes", []))
    )
    db.add(new_proj)
    db.commit()
    db.refresh(new_proj)
    return {
        "id": new_proj.id,
        "name": new_proj.name,
        "classes": json.loads(new_proj.classes),
        "total_images": 0,
        "annotated_images": 0,
        "status": "new"
    }

@app.get("/projects/{project_id}")
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
        
    total = db.query(Image).filter(Image.dataset_id.in_([d.id for d in db.query(Dataset).filter(Dataset.project_id == p.id)])).count()
    annotated = db.query(Image).filter(Image.dataset_id.in_([d.id for d in db.query(Dataset).filter(Dataset.project_id == p.id)]), Image.status == "annotated").count()
    active_model = db.query(MLModel).filter(MLModel.project_id == p.id, MLModel.is_active == True).first()
    
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "classes": json.loads(p.classes) if p.classes else [],
        "created_at": p.created_at.strftime("%Y-%m-%d"),
        "total_images": total,
        "annotated_images": annotated,
        "model_accuracy": active_model.map50 if active_model else None,
        "active_model": active_model.version if active_model else None,
        "status": "active" if total > 0 else "new"
    }

@app.patch("/projects/{project_id}/classes")
def update_project_classes(project_id: str, data: dict, db: Session = Depends(get_db)):
    """Update the class list for a project."""
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    new_classes = data.get("classes", [])
    p.classes = json.dumps(new_classes)
    db.commit()
    return {"id": p.id, "classes": new_classes}

@app.get("/projects/{project_id}/yaml")
def generate_yaml(project_id: str, db: Session = Depends(get_db)):
    """Generate YOLO data.yaml for a project."""
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    classes = json.loads(p.classes) if p.classes else []
    nc = len(classes)
    # Build YAML content
    names_str = "\n".join([f"  {i}: {c}" for i, c in enumerate(classes)])
    yaml_content = f"""# SmartAnnotate AI — Auto-generated YOLO data.yaml
# Project: {p.name}

path: ./data/{p.name.replace(' ', '_')}
train: images/train
val: images/val
test: images/test

nc: {nc}
names:
{names_str}
"""
    stem = p.name.replace(" ", "_").lower()
    return Response(
        content=yaml_content.strip(),
        media_type="text/yaml",
        headers={"Content-Disposition": f'attachment; filename="{stem}_data.yaml"'}
    )

# --- DATASETS / IMAGES ---
@app.get("/datasets")
def list_datasets(project_id: Optional[str] = None, db: Session = Depends(get_db)):
    if project_id:
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
        # Fallback for old projects without default dataset
        if not datasets:
            ds = Dataset(id=str(uuid.uuid4()), project_id=project_id, name="Default Dataset")
            db.add(ds)
            db.commit()
            db.refresh(ds)
            datasets = [ds]
    else:
        datasets = db.query(Dataset).all()
    
    return [{
        "id": d.id,
        "project_id": d.project_id,
        "name": d.name,
        "created_at": d.created_at.strftime("%Y-%m-%d"),
        "total_images": db.query(Image).filter(Image.dataset_id == d.id).count()
    } for d in datasets]

from pydantic import BaseModel
class DatasetCreate(BaseModel):
    name: str

@app.post("/datasets")
def create_dataset(data: DatasetCreate, db: Session = Depends(get_db)):
    ds = Dataset(id=str(uuid.uuid4()), name=data.name)
    db.add(ds)
    db.commit()
    db.refresh(ds)
    return {
        "id": ds.id,
        "name": ds.name,
        "project_id": ds.project_id,
        "created_at": ds.created_at.strftime("%Y-%m-%d"),
        "total_images": 0
    }

@app.patch("/datasets/{dataset_id}/link")
def link_dataset(dataset_id: str, data: dict, db: Session = Depends(get_db)):
    project_id = data.get("project_id")
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    ds.project_id = project_id
    db.commit()
    return {"message": "Linked successfully"}


@app.get("/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    project = None
    classes = []
    if ds.project_id:
        project = db.query(Project).filter(Project.id == ds.project_id).first()
        if project and project.classes:
            classes = json.loads(project.classes)
            
    images = db.query(Image).filter(Image.dataset_id == dataset_id).all()
    
    # Create a zip file in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for img in images:
            # Check if file exists on disk
            if os.path.exists(img.filename):
                # Add image file to zip
                basename = os.path.basename(img.filename)
                zip_file.write(img.filename, f"images/{basename}")
                
                # Generate YOLO txt content if annotations exist
                annotations = db.query(Annotation).filter(Annotation.image_id == img.id).all()
                if annotations:
                    txt_content = ""
                    for ann in annotations:
                        # Find class index
                        try:
                            cls_idx = classes.index(ann.label)
                        except ValueError:
                            cls_idx = 0 # Default if class not found
                            
                        # If bbox exists, convert to YOLO format (center_x, center_y, width, height) relative to image size
                        # Assuming ann.data contains {"x", "y", "width", "height", "imageWidth", "imageHeight"}
                        try:
                            data = json.loads(ann.data)
                            if all(k in data for k in ["x", "y", "width", "height", "imageWidth", "imageHeight"]):
                                iw = data["imageWidth"]
                                ih = data["imageHeight"]
                                x_center = (data["x"] + data["width"] / 2) / iw
                                y_center = (data["y"] + data["height"] / 2) / ih
                                w = data["width"] / iw
                                h = data["height"] / ih
                                txt_content += f"{cls_idx} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\n"
                        except:
                            pass
                    
                    if txt_content:
                        txt_filename = os.path.splitext(basename)[0] + ".txt"
                        zip_file.writestr(f"labels/{txt_filename}", txt_content)
    
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f'attachment; filename="dataset_{dataset_id}.zip"'}
    )


@app.post("/datasets/{dataset_id}/upload")
async def upload_images(dataset_id: str, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    # Find dataset
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    saved_images = []
    for file in files:
        filepath = f"uploads/{uuid.uuid4()}_{file.filename}"
        with open(filepath, "wb") as f:
            content = await file.read()
            f.write(content)
            
        img = Image(
            id=str(uuid.uuid4()),
            dataset_id=ds.id,
            filename=file.filename,
            url=f"http://localhost:8000/{filepath}",
            width=800, height=600,
            status="unannotated"
        )
        db.add(img)
        saved_images.append(img)
    
    db.commit()
    return [{"id": i.id, "filename": i.filename, "url": i.url, "status": i.status} for i in saved_images]

@app.get("/images/{dataset_id}")
def get_images(dataset_id: str, db: Session = Depends(get_db)):
    imgs = db.query(Image).filter(Image.dataset_id == dataset_id).all()
    return [{
        "id": i.id,
        "filename": i.filename,
        "url": i.url,
        "status": i.status,
        "split": i.split,
        "annotation_count": db.query(Annotation).filter(Annotation.image_id == i.id).count()
    } for i in imgs]

@app.get("/projects/{project_id}/images")
def get_project_images(project_id: str, db: Session = Depends(get_db)):
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    dataset_ids = [d.id for d in datasets]
    if not dataset_ids:
        return []
    imgs = db.query(Image).filter(Image.dataset_id.in_(dataset_ids)).all()
    return [{
        "id": i.id,
        "filename": i.filename,
        "url": i.url,
        "status": i.status,
        "split": i.split,
        "annotation_count": db.query(Annotation).filter(Annotation.image_id == i.id).count()
    } for i in imgs]

@app.get("/images/detail/{image_id}")
def get_image_detail(image_id: str, db: Session = Depends(get_db)):
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    ds = db.query(Dataset).filter(Dataset.id == img.dataset_id).first()
    
    return {
        "id": img.id,
        "dataset_id": img.dataset_id,
        "project_id": ds.project_id if ds else None,
        "filename": img.filename,
        "url": img.url,
        "width": img.width,
        "height": img.height,
        "status": img.status,
        "split": img.split
    }

# --- ANNOTATIONS ---
@app.get("/annotations/{image_id}")
def get_annotations(image_id: str, db: Session = Depends(get_db)):
    anns = db.query(Annotation).filter(Annotation.image_id == image_id).all()
    return [{
        "id": a.id,
        "class_id": a.class_id,
        "class_name": a.class_name,
        "type": a.type,
        "bbox": {"x": a.bbox_x, "y": a.bbox_y, "w": a.bbox_w, "h": a.bbox_h} if a.type == "bbox" else None,
        "polygon": json.loads(a.polygon) if a.polygon else None,
        "confidence": a.confidence,
        "source": a.source
    } for a in anns]

@app.post("/annotations/{image_id}")
def save_annotations(image_id: str, payload: dict, db: Session = Depends(get_db)):
    # Clear old annotations
    db.query(Annotation).filter(Annotation.image_id == image_id).delete()
    
    saved = []
    for ann in payload.get("annotations", []):
        new_ann = Annotation(
            id=str(uuid.uuid4()),
            image_id=image_id,
            class_id=ann.get("class_id"),
            class_name=ann.get("class_name"),
            type=ann.get("type", "bbox"),
            source=ann.get("source", "manual")
        )
        if ann.get("type") == "bbox" and "bbox" in ann:
            new_ann.bbox_x = ann["bbox"]["x"]
            new_ann.bbox_y = ann["bbox"]["y"]
            new_ann.bbox_w = ann["bbox"]["w"]
            new_ann.bbox_h = ann["bbox"]["h"]
        if ann.get("type") == "polygon" and "polygon" in ann:
            new_ann.polygon = json.dumps(ann["polygon"])
        if "confidence" in ann:
            new_ann.confidence = ann["confidence"]
            
        db.add(new_ann)
        saved.append(new_ann)
    
    # Update image status
    img = db.query(Image).filter(Image.id == image_id).first()
    if img:
        img.status = "annotated"
        
    db.commit()
    return {"message": "Saved successfully"}

# --- TRAINING (Simple Threading) ---
def mock_training_worker(job_id: str):
    db = SessionLocal()
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        db.close()
        return
        
    job.status = "running"
    db.commit()
    
    for epoch in range(1, job.epochs + 1):
        time.sleep(2) # Mock 2 seconds per epoch
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job.status == "cancelled":
            break
        job.current_epoch = epoch
        job.map50 = min(0.95, 0.4 + (epoch / job.epochs) * 0.5)
        job.loss = max(0.02, 1.0 - (epoch / job.epochs))
        db.commit()
        
    if job.status != "cancelled":
        job.status = "completed"
        job.completed_at = datetime.utcnow()
        # Create mock model
        model = MLModel(
            id=str(uuid.uuid4()),
            project_id=job.project_id,
            version=f"v{db.query(MLModel).filter(MLModel.project_id == job.project_id).count() + 1}",
            model_type=job.model_type,
            map50=job.map50,
            map50_95=job.map50 - 0.2,
            precision=min(0.98, job.map50 + 0.02),
            recall=max(0.8, job.map50 - 0.05)
        )
        db.add(model)
        db.commit()
        
    db.close()

@app.post("/train/{project_id}")
def start_training(project_id: str, payload: dict, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = TrainingJob(
        id=str(uuid.uuid4()),
        project_id=project_id,
        model_type=payload.get("model_type", "yolo11s"),
        epochs=payload.get("epochs", 60),
        status="queued"
    )
    db.add(job)
    db.commit()
    
    # Start thread
    thread = threading.Thread(target=mock_training_worker, args=(job.id,))
    thread.start()
    
    return {"job_id": job.id, "status": "queued"}

@app.get("/train/status/{job_id}")
def get_training_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job.id,
        "status": job.status,
        "epochs": job.epochs,
        "current_epoch": job.current_epoch,
        "metrics": {
            "mAP50": job.map50,
            "loss": job.loss,
            "precision": job.precision,
            "recall": job.recall
        } if job.map50 else None
    }

@app.get("/train/list/{project_id}")
def list_training_jobs(project_id: str, db: Session = Depends(get_db)):
    if project_id == "all":
        jobs = db.query(TrainingJob).order_by(TrainingJob.created_at.desc()).all()
    else:
        jobs = db.query(TrainingJob).filter(TrainingJob.project_id == project_id).order_by(TrainingJob.created_at.desc()).all()
    
    result = []
    for job in jobs:
        project = db.query(Project).filter(Project.id == job.project_id).first()
        result.append({
            "id": job.id,
            "project": project.name if project else "Unknown",
            "model": job.model_type,
            "status": job.status,
            "epochs": job.epochs,
            "currentEpoch": job.current_epoch,
            "mAP50": job.map50,
            "precision": job.precision,
            "recall": job.recall,
            "loss": job.loss,
            "startedAt": job.started_at.strftime("%Y-%m-%d %H:%M") if job.started_at else job.created_at.strftime("%Y-%m-%d %H:%M"),
            "duration": "N/A"
        })
    return result

# --- EXPORT ANNOTATION FILES ---
import re
from fastapi.responses import Response

def safe_stem(filename: str) -> str:
    """Return filename without extension, cleaned up."""
    stem = os.path.splitext(filename)[0]
    return stem

@app.get("/export/{image_id}/yolo")
def export_yolo(image_id: str, db: Session = Depends(get_db)):
    """Export annotations as YOLO format (.txt)"""
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    anns = db.query(Annotation).filter(Annotation.image_id == image_id).all()
    
    lines = []
    for a in anns:
        if a.type == "bbox" and a.bbox_x is not None:
            # YOLO format: class_id cx cy w h (all normalized 0-1)
            cx = a.bbox_x + a.bbox_w / 2
            cy = a.bbox_y + a.bbox_h / 2
            lines.append(f"{a.class_id} {cx:.6f} {cy:.6f} {a.bbox_w:.6f} {a.bbox_h:.6f}")
        elif a.type == "polygon" and a.polygon:
            try:
                poly = json.loads(a.polygon)
                # YOLO-Seg format: class_id x1 y1 x2 y2 ...
                poly_str = " ".join([f"{p['x']:.6f} {p['y']:.6f}" for p in poly])
                lines.append(f"{a.class_id} {poly_str}")
            except:
                pass
    
    stem = safe_stem(img.filename)
    txt_content = "\n".join(lines)
    
    return Response(
        content=txt_content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{stem}.txt"'}
    )

@app.get("/export/{image_id}/coco")
def export_coco(image_id: str, db: Session = Depends(get_db)):
    """Export annotations as COCO JSON format"""
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    anns = db.query(Annotation).filter(Annotation.image_id == image_id).all()
    
    # Get unique classes for this image
    classes_used = {}
    for a in anns:
        if a.class_id not in classes_used:
            classes_used[a.class_id] = a.class_name
    
    categories = [{"id": cid, "name": cname} for cid, cname in sorted(classes_used.items())]
    
    coco_anns = []
    for i, a in enumerate(anns):
        if a.type == "bbox" and a.bbox_x is not None:
            w_px = (a.bbox_w * (img.width or 800))
            h_px = (a.bbox_h * (img.height or 600))
            x_px = (a.bbox_x * (img.width or 800))
            y_px = (a.bbox_y * (img.height or 600))
            coco_anns.append({
                "id": i + 1,
                "image_id": 1,
                "category_id": a.class_id,
                "bbox": [round(x_px, 2), round(y_px, 2), round(w_px, 2), round(h_px, 2)],
                "area": round(w_px * h_px, 2),
                "iscrowd": 0,
                "segmentation": []
            })
        elif a.type == "polygon" and a.polygon:
            try:
                poly = json.loads(a.polygon)
                seg = []
                xs = []
                ys = []
                for p in poly:
                    px = p["x"] * (img.width or 800)
                    py = p["y"] * (img.height or 600)
                    seg.extend([px, py])
                    xs.append(px)
                    ys.append(py)
                w_px = max(xs) - min(xs)
                h_px = max(ys) - min(ys)
                x_px = min(xs)
                y_px = min(ys)
                coco_anns.append({
                    "id": i + 1,
                    "image_id": 1,
                    "category_id": a.class_id,
                    "bbox": [round(x_px, 2), round(y_px, 2), round(w_px, 2), round(h_px, 2)],
                    "segmentation": [seg],
                    "area": round(w_px * h_px, 2),
                    "iscrowd": 0
                })
            except:
                pass
    
    coco_data = {
        "info": {"description": "SmartAnnotate AI Export", "version": "1.0"},
        "images": [{
            "id": 1,
            "file_name": img.filename,
            "width": img.width or 800,
            "height": img.height or 600
        }],
        "categories": categories,
        "annotations": coco_anns
    }
    
    stem = safe_stem(img.filename)
    
    return Response(
        content=json.dumps(coco_data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{stem}.json"'}
    )

@app.get("/export/{image_id}/files")
def list_annotation_files(image_id: str, db: Session = Depends(get_db)):
    """List available annotation export files for an image."""
    img = db.query(Image).filter(Image.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    
    ann_count = db.query(Annotation).filter(Annotation.image_id == image_id).count()
    stem = safe_stem(img.filename)
    
    if ann_count == 0:
        return []
    
    return [
        {
            "format": "YOLO",
            "filename": f"{stem}.txt",
            "description": f"YOLO format ({ann_count} annotations)",
            "download_url": f"/export/{image_id}/yolo"
        },
        {
            "format": "COCO",
            "filename": f"{stem}.json",
            "description": f"COCO JSON format ({ann_count} annotations)",
            "download_url": f"/export/{image_id}/coco"
        }
    ]

# --- AUTO ANNOTATE ---

task_progress = {}

@app.get("/auto-annotate/status/{project_id}")
def get_auto_annotate_status(project_id: str, db: Session = Depends(get_db)):
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    dataset_ids = [d.id for d in datasets]
    if not dataset_ids:
        return {"classes": [], "ready": False, "unannotated_count": 0}
        
    annotated_imgs = db.query(Image).filter(Image.dataset_id.in_(dataset_ids), Image.status.in_(["annotated", "auto_approved"])).all()
    unannotated_imgs = db.query(Image).filter(Image.dataset_id.in_(dataset_ids), Image.status == "unannotated").count()
    
    anns = db.query(Annotation).filter(Annotation.image_id.in_([i.id for i in annotated_imgs])).all()
    
    class_counts = {}
    for a in anns:
        if a.class_id not in class_counts:
            class_counts[a.class_id] = {"class_id": a.class_id, "class_name": a.class_name, "count": 0}
        class_counts[a.class_id]["count"] += 1
        
    stats = list(class_counts.values())
    ready = len(stats) > 0
    
    return {
        "classes": stats,
        "ready": ready,
        "unannotated_count": unannotated_imgs
    }

@app.get("/auto-annotate/progress/{project_id}")
def get_auto_annotate_progress(project_id: str):
    return task_progress.get(project_id, {"status": "idle", "current": 0, "total": 0})

@app.get("/auto-annotate/active")
def get_active_auto_annotations(db: Session = Depends(get_db)):
    active_tasks = []
    for pid, prog in task_progress.items():
        if prog["status"] == "running":
            proj = db.query(Project).filter(Project.id == pid).first()
            if proj:
                active_tasks.append({
                    "project_id": pid,
                    "project_name": proj.name,
                    "model": "YOLO11s", # Default for now
                    "progress": int((prog["current"] / prog["total"]) * 100) if prog["total"] > 0 else 0,
                    "current": prog["current"],
                    "total": prog["total"],
                    "eta": "Calculating..." # Mock
                })
    return active_tasks

class AutoAnnotateRequest(BaseModel):
    epochs: int = 10

def auto_annotate_task(project_id: str, epochs: int):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    import tempfile
    
    try:
        datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
        dataset_ids = [d.id for d in datasets]
        if not dataset_ids: return
        
        unannotated_imgs = db.query(Image).filter(Image.dataset_id.in_(dataset_ids), Image.status == "unannotated").all()
        if not unannotated_imgs: 
            task_progress[project_id] = {"status": "completed", "current": 0, "total": 0}
            return
            
        task_progress[project_id] = {"status": "running", "current": 0, "total": len(unannotated_imgs)}
        
        all_imgs = db.query(Image).filter(Image.dataset_id.in_(dataset_ids)).all()
        anns = db.query(Annotation).filter(Annotation.image_id.in_([i.id for i in all_imgs])).all()
        
        classes = {}
        for a in anns:
            if a.class_id not in classes:
                classes[a.class_id] = a.class_name
                
        if not classes:
            print("No classes found to detect.")
            task_progress[project_id] = {"status": "error", "error": "No classes found"}
            return
            
        class_names = list(classes.values())
        inverse_class_mapping = {name: cid for cid, name in classes.items()}
        
        print(f"Loading YOLO-World for classes: {class_names}")
        model = YOLO("yolov8s-world.pt")
        model.set_classes(class_names)
        
        for idx, img in enumerate(unannotated_imgs):
            src_path = img.url.split("/")[-2] + "/" + img.url.split("/")[-1]
            if os.path.exists(src_path):
                results = model.predict(src_path, conf=0.005)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_idx = int(box.cls[0].item())
                        conf = box.conf[0].item()
                        if conf > 0.005: # Zero-shot confidence can be extremely low, prioritize recall
                            xywhn = box.xywhn[0].tolist()
                            cx, cy, w, h = xywhn
                            detected_class_name = class_names[cls_idx]
                            class_id = inverse_class_mapping[detected_class_name]
                            
                            new_ann = Annotation(
                                id=str(uuid.uuid4()),
                                image_id=img.id,
                                type="bbox",
                                class_id=class_id,
                                class_name=detected_class_name,
                                bbox_x=cx - w/2,
                                bbox_y=cy - h/2,
                                bbox_w=w,
                                bbox_h=h
                            )
                            db.add(new_ann)
                img.status = "auto_approved"
                
            task_progress[project_id]["current"] = idx + 1
                
        db.commit()
        task_progress[project_id]["status"] = "completed"
        print(f"Auto-annotate completed for project {project_id}")
    except Exception as e:
        task_progress[project_id] = {"status": "error", "error": str(e)}
        print(f"Auto-annotate error: {e}")
    finally:
        db.close()

@app.post("/auto-annotate/start/{project_id}")
def start_auto_annotate(project_id: str, req: AutoAnnotateRequest, bg_tasks: BackgroundTasks):
    bg_tasks.add_task(auto_annotate_task, project_id, req.epochs)
    return {"message": "Auto annotation started"}

# Run with: uvicorn main:app --reload


# --- ANALYTICS ---
from sqlalchemy import func

@app.get("/analytics/overview")
def get_analytics_overview(db: Session = Depends(get_db)):
    # Basic counts
    total_projects = db.query(Project).count()
    total_datasets = db.query(Dataset).count()
    total_images = db.query(Image).count()
    total_annotations = db.query(Annotation).count()

    # Class distribution
    class_dist_query = db.query(Annotation.class_name, func.count(Annotation.id)).group_by(Annotation.class_name).all()
    class_distribution = [{"name": c[0] or "Unknown", "count": c[1]} for c in class_dist_query]
    
    # Sort class distribution
    class_distribution = sorted(class_distribution, key=lambda x: x['count'], reverse=True)

    # Source distribution
    source_dist_query = db.query(Annotation.source, func.count(Annotation.id)).group_by(Annotation.source).all()
    source_distribution = [{"name": s[0] or "unknown", "value": s[1]} for s in source_dist_query]

    # Image status distribution
    status_dist_query = db.query(Image.status, func.count(Image.id)).group_by(Image.status).all()
    status_distribution = [{"name": s[0] or "unknown", "value": s[1]} for s in status_dist_query]

    return {
        "kpis": {
            "total_projects": total_projects,
            "total_datasets": total_datasets,
            "total_images": total_images,
            "total_annotations": total_annotations
        },
        "class_distribution": class_distribution,
        "source_distribution": source_distribution,
        "status_distribution": status_distribution
    }
