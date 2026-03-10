"""
Prediction router — POST /predict endpoint.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import numpy as np

from services.trainer import load_model
from services.embedder import generate_embeddings

router = APIRouter()


class PredictRequest(BaseModel):
    model_id: str
    text: str
    embedding_model: str = "all-MiniLM-L6-v2"


@router.post("/predict")
def predict_endpoint(req: PredictRequest):
    """Predict the label for a given text using a trained model."""
    try:
        model_data = load_model(req.model_id)
        model = model_data["model"]
        le = model_data["label_encoder"]

        # Generate embedding
        embedding = generate_embeddings([req.text], req.embedding_model)

        # Predict
        prediction_idx = model.predict(embedding)[0]
        prediction_label = le.inverse_transform([prediction_idx])[0]

        # Get confidence
        confidence = 0.0
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(embedding)[0]
            confidence = float(max(proba))
        elif hasattr(model, "decision_function"):
            confidence = float(min(abs(model.decision_function(embedding)[0]), 1.0))

        return {
            "prediction": prediction_label,
            "confidence": round(confidence, 4),
            "model_id": req.model_id,
            "text": req.text,
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Model {req.model_id} not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
