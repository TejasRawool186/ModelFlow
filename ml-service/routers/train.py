"""
Training router — POST /train and POST /embed endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

from services.trainer import train_model
from services.embedder import generate_embeddings

router = APIRouter()


class TrainRequest(BaseModel):
    texts: Optional[List[str]] = None
    labels: Optional[List[str]] = None
    embeddings: Optional[List[List[float]]] = None
    dataset_id: Optional[str] = None
    algorithm: str = "logistic_regression"
    test_split: float = 0.2
    embedding_model: str = "all-MiniLM-L6-v2"
    hyperparams: Optional[dict] = None


class EmbedRequest(BaseModel):
    texts: List[str]
    model: str = "all-MiniLM-L6-v2"


@router.post("/train")
def train_endpoint(req: TrainRequest):
    """Train a model from texts + labels or pre-computed embeddings."""
    try:
        # If raw texts provided, generate embeddings first
        if req.texts and req.labels:
            if len(req.texts) != len(req.labels):
                raise HTTPException(
                    status_code=400,
                    detail="texts and labels must have the same length",
                )
            embeddings = generate_embeddings(req.texts, req.embedding_model)
        elif req.embeddings and req.labels:
            embeddings = req.embeddings
        else:
            # Demo mode with sample data
            demo_texts = [
                "refund my money", "payment failed", "where is my order",
                "cancel subscription", "change my address", "talk to human",
                "I want a refund", "payment error", "order tracking",
                "unsubscribe", "update profile", "speak to agent",
            ]
            demo_labels = [
                "refund_request", "payment_issue", "order_status",
                "cancellation", "account_update", "escalation",
                "refund_request", "payment_issue", "order_status",
                "cancellation", "account_update", "escalation",
            ]
            embeddings = generate_embeddings(demo_texts, req.embedding_model)
            req.labels = demo_labels

        result = train_model(
            embeddings=embeddings,
            labels=req.labels,
            algorithm=req.algorithm,
            test_split=req.test_split,
            hyperparams=req.hyperparams,
        )

        return {
            "status": "completed",
            **result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/embed")
def embed_endpoint(req: EmbedRequest):
    """Generate embeddings for a list of texts."""
    try:
        embeddings = generate_embeddings(req.texts, req.model)
        return {
            "embeddings": embeddings,
            "model": req.model,
            "count": len(embeddings),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
