import sys
import re

with open(r"D:\anotation\backend\main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports if missing
if "import zipfile" not in content:
    content = content.replace("import os", "import os\nimport zipfile\nimport io\nfrom fastapi.responses import StreamingResponse\n")

# Make sure json is imported
if "import json" not in content:
    content = content.replace("import os", "import os\nimport json\n")

zip_endpoint = """
@app.get("/projects/{project_id}/download-zip")
def download_project_zip(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    classes = json.loads(project.classes) if project.classes else []
    nc = len(classes)
    
    datasets = db.query(Dataset).filter(Dataset.project_id == project_id).all()
    dataset_ids = [d.id for d in datasets]
    
    images = db.query(Image).filter(Image.dataset_id.in_(dataset_ids)).all()
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        
        # 1. Add images and labels
        for img in images:
            if not os.path.exists(img.filename):
                continue
                
            split = img.split if img.split else "train"
            basename = os.path.basename(img.filename)
            
            # Write image
            zip_file.write(img.filename, f"datasets/{split}/images/{basename}")
            
            # Generate annotations
            annotations = db.query(Annotation).filter(Annotation.image_id == img.id).all()
            if annotations:
                txt_content = ""
                for ann in annotations:
                    try:
                        cls_idx = classes.index(ann.label)
                    except ValueError:
                        cls_idx = 0
                        
                    data = json.loads(ann.data)
                    
                    if ann.type == "bbox":
                        if all(k in data for k in ["x", "y", "width", "height", "imageWidth", "imageHeight"]):
                            iw, ih = data["imageWidth"], data["imageHeight"]
                            x_center = (data["x"] + data["width"] / 2) / iw
                            y_center = (data["y"] + data["height"] / 2) / ih
                            w = data["width"] / iw
                            h = data["height"] / ih
                            txt_content += f"{cls_idx} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\\n"
                            
                    elif ann.type == "polygon":
                        if "points" in data and "imageWidth" in data and "imageHeight" in data:
                            iw, ih = data["imageWidth"], data["imageHeight"]
                            pts_str = " ".join([f"{p['x']/iw:.6f} {p['y']/ih:.6f}" for p in data["points"]])
                            txt_content += f"{cls_idx} {pts_str}\\n"
                            
                    elif ann.type == "pose":
                        if "keypoints" in data:
                            # Calculate bbox from keypoints
                            kps = [k for k in data["keypoints"] if k.get("visible")]
                            if not kps: continue
                            
                            iw = img.width or 800  # Fallback
                            ih = img.height or 600 # Fallback
                            
                            min_x = min(k["x"] for k in kps)
                            max_x = max(k["x"] for k in kps)
                            min_y = min(k["y"] for k in kps)
                            max_y = max(k["y"] for k in kps)
                            
                            w = (max_x - min_x) / iw
                            h = (max_y - min_y) / ih
                            cx = (min_x + max_x) / 2 / iw
                            cy = (min_y + max_y) / 2 / ih
                            
                            row = f"{cls_idx} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"
                            
                            for i in range(17):
                                kp = next((k for k in data["keypoints"] if k["id"] == i), None)
                                if kp and kp.get("visible"):
                                    row += f" {kp['x']/iw:.6f} {kp['y']/ih:.6f} 2"
                                else:
                                    row += " 0.000000 0.000000 0"
                                    
                            txt_content += row + "\\n"

                if txt_content:
                    txt_filename = os.path.splitext(basename)[0] + ".txt"
                    zip_file.writestr(f"datasets/{split}/labels/{txt_filename}", txt_content)
                    
        # 2. Add data.yaml
        names_str = "\\n".join([f"  {i}: {c}" for i, c in enumerate(classes)])
        yaml_content = f\"\"\"path: ./datasets
train: train/images
val: val/images
test: test/images

nc: {nc}
names:
{names_str}
\"\"\"
        zip_file.writestr("data.yaml", yaml_content.strip())
        
        # 3. Add train.py
        train_py = f\"\"\"from ultralytics import YOLO

def main():
    # Load a standard YOLOv8 model
    model = YOLO('yolov8n.pt') 

    # Train the model
    results = model.train(
        data='data.yaml',
        epochs=100,
        imgsz=640,
        batch=16,
        project='runs',
        name='{project.name.replace(' ', '_').lower()}_train'
    )

if __name__ == '__main__':
    main()
\"\"\"
        zip_file.writestr("train.py", train_py)
        
        # 4. Add inference.py
        inference_py = f\"\"\"from ultralytics import YOLO
import cv2
import argparse

def main():
    parser = argparse.ArgumentParser(description="YOLO Inference")
    parser.add_argument('--source', type=str, default='0', help='Source: 0 for webcam, image.jpg, or video.mp4')
    parser.add_argument('--weights', type=str, default='runs/{project.name.replace(' ', '_').lower()}_train/weights/best.pt', help='Path to trained weights')
    args = parser.parse_args()

    # Load the trained model
    model = YOLO(args.weights)

    # Perform inference
    # if source is '0', it will open webcam
    source = int(args.source) if args.source == '0' else args.source
    
    results = model(source, show=True)

if __name__ == '__main__':
    main()
\"\"\"
        zip_file.writestr("inference.py", inference_py)
        
        # 5. Add requirements.txt
        req_txt = \"\"\"ultralytics>=8.0.0
opencv-python>=4.6.0
torch
torchvision
\"\"\"
        zip_file.writestr("requirements.txt", req_txt)
        
        # 6. Add README.md
        readme = f\"\"\"# {project.name} - YOLO Training Ready

This project is exported from SmartAnnotate AI.

## Directory Structure
- `datasets/`: Contains the images and labels for training and validation.
- `data.yaml`: Configuration file for YOLO.
- `train.py`: Script to start training.
- `inference.py`: Script to run inference on your trained model.

## Setup
1. Create a virtual environment (optional but recommended):
   `python -m venv venv`
   `source venv/bin/activate` (Linux/Mac) or `venv\\\\Scripts\\\\activate` (Windows)
2. Install dependencies:
   `pip install -r requirements.txt`

## Training
To train the model:
`python train.py`

## Inference
After training, you can run inference using your webcam:
`python inference.py --source 0`

Or on a specific video/image:
`python inference.py --source my_video.mp4`
\"\"\"
        zip_file.writestr("README.md", readme)
        
        # 7. Add runs folder
        zip_file.writestr("runs/.gitkeep", "")

    zip_buffer.seek(0)
    stem = project.name.replace(" ", "_").lower()
    return StreamingResponse(
        zip_buffer, 
        media_type="application/zip", 
        headers={"Content-Disposition": f'attachment; filename="{stem}_project_ready.zip"'}
    )
"""

if 'def download_project_zip' not in content:
    content += "\n" + zip_endpoint

with open(r"D:\anotation\backend\main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Backend patched successfully")
