import sys

file_path = r'D:\anotation\backend\main.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

analytics_endpoint = """

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
"""

if "get_analytics_overview" not in content:
    with open(file_path, 'a', encoding='utf-8') as f:
        f.write(analytics_endpoint)
    print("Analytics endpoint added to main.py")
else:
    print("Analytics endpoint already exists")
