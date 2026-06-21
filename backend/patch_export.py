import sys
import re

with open(r"D:\anotation\backend\main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Add imports if missing
if "import zipfile" not in content:
    content = content.replace("import os", "import os\nimport zipfile\nimport io\nfrom fastapi.responses import StreamingResponse\n")

# Add the export endpoint before upload_images
export_code = """
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
                                txt_content += f"{cls_idx} {x_center:.6f} {y_center:.6f} {w:.6f} {h:.6f}\\n"
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

"""

if "def export_dataset" not in content:
    content = content.replace("@app.post(\"/datasets/{dataset_id}/upload\")", export_code + "\n@app.post(\"/datasets/{dataset_id}/upload\")")

with open(r"D:\anotation\backend\main.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Patched main.py with export endpoint")
