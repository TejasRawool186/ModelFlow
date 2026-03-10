"""
Export router — POST /export endpoint.
"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from services.exporter import export_model

router = APIRouter()

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")


class ExportRequest(BaseModel):
    model_id: str
    format: str = "python_package"  # python_package or rest_api


@router.post("/export")
def export_endpoint(req: ExportRequest):
    """Export a trained model as a downloadable package."""
    model_path = os.path.join(MODELS_DIR, f"{req.model_id}.pkl")

    if not os.path.exists(model_path):
        # Return mock response for demo
        return {
            "status": "demo",
            "model_id": req.model_id,
            "format": req.format,
            "files": ["model.pkl", "predict.py", "requirements.txt"]
            + (["api_server.py"] if req.format == "rest_api" else []),
            "message": "Model not found — demo export generated",
        }

    try:
        result = export_model(req.model_id, model_path, req.format)
        return {
            "status": "completed",
            "model_id": req.model_id,
            "format": req.format,
            "files": result["files"],
            "download_path": result.get("zip_path", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
