"""
ModelFlow ML Service — FastAPI application
Provides training, prediction, embedding, and export endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import train, predict, export

app = FastAPI(
    title="ModelFlow ML Service",
    description="Machine learning service for ModelFlow pipeline execution",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(train.router, tags=["Training"])
app.include_router(predict.router, tags=["Prediction"])
app.include_router(export.router, tags=["Export"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "modelflow-ml-service",
    }


@app.get("/")
def root():
    return {"message": "ModelFlow ML Service", "docs": "/docs"}
