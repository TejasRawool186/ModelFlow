"""
Exporter service — generates deployable model packages.
"""

import os
import zipfile
import tempfile


def export_model(model_id, model_path, format_type="python_package"):
    """
    Generate exportable model files.
    
    Returns:
        dict with export path and file list
    """
    export_dir = tempfile.mkdtemp(prefix=f"modelflow_export_{model_id}_")

    if format_type == "python_package":
        return _export_python_package(model_id, model_path, export_dir)
    elif format_type == "rest_api":
        return _export_rest_api(model_id, model_path, export_dir)
    else:
        raise ValueError(f"Unsupported export format: {format_type}")


def _export_python_package(model_id, model_path, export_dir):
    """Generate a Python package with model and prediction script."""
    files = []

    # Copy model
    import shutil
    model_dest = os.path.join(export_dir, "model.pkl")
    if os.path.exists(model_path):
        shutil.copy2(model_path, model_dest)
    files.append("model.pkl")

    # predict.py
    predict_code = '''"""
ModelFlow Exported Model — Prediction Script
"""
import joblib
import sys

def load_model(path="model.pkl"):
    data = joblib.load(path)
    return data["model"], data["label_encoder"]

def predict(text, model=None, label_encoder=None):
    if model is None:
        model, label_encoder = load_model()
    
    # Note: In production, you need the same embedding model used during training
    # This script assumes embeddings are pre-computed
    print(f"Model loaded. Classes: {label_encoder.classes_.tolist()}")
    return label_encoder.classes_.tolist()

if __name__ == "__main__":
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        result = predict(text)
        print(f"Available classes: {result}")
    else:
        print("Usage: python predict.py <text>")
'''
    with open(os.path.join(export_dir, "predict.py"), "w") as f:
        f.write(predict_code)
    files.append("predict.py")

    # requirements.txt
    requirements = "joblib==1.3.2\nscikit-learn==1.4.0\nnumpy==1.26.3\n"
    with open(os.path.join(export_dir, "requirements.txt"), "w") as f:
        f.write(requirements)
    files.append("requirements.txt")

    # Create zip
    zip_path = os.path.join(export_dir, f"model_{model_id}.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for fname in files:
            fpath = os.path.join(export_dir, fname)
            if os.path.exists(fpath):
                zf.write(fpath, fname)

    return {
        "export_dir": export_dir,
        "zip_path": zip_path,
        "files": files,
        "format": "python_package",
    }


def _export_rest_api(model_id, model_path, export_dir):
    """Generate a REST API server for the model."""
    files = []

    # Copy model
    import shutil
    model_dest = os.path.join(export_dir, "model.pkl")
    if os.path.exists(model_path):
        shutil.copy2(model_path, model_dest)
    files.append("model.pkl")

    # api_server.py
    api_code = '''"""
ModelFlow Exported Model — REST API Server
Run: python api_server.py
"""
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import uvicorn

app = FastAPI(title="ModelFlow Exported Model API")

# Load model on startup
model_data = joblib.load("model.pkl")
model = model_data["model"]
label_encoder = model_data["label_encoder"]


class PredictRequest(BaseModel):
    text: str


class PredictResponse(BaseModel):
    prediction: str
    confidence: float


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    # Note: You need to compute embeddings the same way as during training
    # This is a template — integrate your embedding pipeline here
    return PredictResponse(
        prediction="placeholder",
        confidence=0.0,
    )


@app.get("/health")
def health():
    return {"status": "ok", "classes": label_encoder.classes_.tolist()}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
'''
    with open(os.path.join(export_dir, "api_server.py"), "w") as f:
        f.write(api_code)
    files.append("api_server.py")

    # requirements.txt
    requirements = (
        "fastapi==0.109.0\nuvicorn==0.27.0\njoblib==1.3.2\n"
        "scikit-learn==1.4.0\nnumpy==1.26.3\npydantic==2.6.0\n"
    )
    with open(os.path.join(export_dir, "requirements.txt"), "w") as f:
        f.write(requirements)
    files.append("requirements.txt")

    # Create zip
    zip_path = os.path.join(export_dir, f"model_api_{model_id}.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        for fname in files:
            fpath = os.path.join(export_dir, fname)
            if os.path.exists(fpath):
                zf.write(fpath, fname)

    return {
        "export_dir": export_dir,
        "zip_path": zip_path,
        "files": files,
        "format": "rest_api",
    }
