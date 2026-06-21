from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./smartannotate.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    role = Column(String, default="user")
    password_hash = Column(String)

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    classes = Column(String) # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Image(Base):
    __tablename__ = "images"
    id = Column(String, primary_key=True, index=True)
    dataset_id = Column(String, ForeignKey("datasets.id"))
    filename = Column(String)
    url = Column(String)
    width = Column(Integer)
    height = Column(Integer)
    status = Column(String, default="unannotated") # unannotated, annotated, auto_approved, review_required
    split = Column(String, default="train") # train, val, test
    created_at = Column(DateTime, default=datetime.utcnow)

class Annotation(Base):
    __tablename__ = "annotations"
    id = Column(String, primary_key=True, index=True)
    image_id = Column(String, ForeignKey("images.id"))
    class_id = Column(Integer)
    class_name = Column(String)
    type = Column(String) # bbox, polygon
    bbox_x = Column(Float, nullable=True)
    bbox_y = Column(Float, nullable=True)
    bbox_w = Column(Float, nullable=True)
    bbox_h = Column(Float, nullable=True)
    polygon = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    source = Column(String) # manual, auto, reviewed
    created_at = Column(DateTime, default=datetime.utcnow)

class TrainingJob(Base):
    __tablename__ = "training_jobs"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    model_type = Column(String) # yolo11n, yolo11s
    status = Column(String) # running, completed, failed
    epochs = Column(Integer)
    current_epoch = Column(Integer, default=0)
    map50 = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    loss = Column(Float, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

class MLModel(Base):
    __tablename__ = "models"
    id = Column(String, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    version = Column(String)
    model_type = Column(String)
    weights_path = Column(String)
    map50 = Column(Float)
    map50_95 = Column(Float)
    precision = Column(Float)
    recall = Column(Float)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
