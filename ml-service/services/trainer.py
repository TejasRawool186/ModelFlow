"""
Trainer service — trains ML models using scikit-learn.
Supports Logistic Regression, SVM, and Random Forest.
"""

import os
import uuid
import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
from sklearn.preprocessing import LabelEncoder

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

ALGORITHM_MAP = {
    "logistic_regression": LogisticRegression,
    "svm": SVC,
    "random_forest": RandomForestClassifier,
}


def train_model(embeddings, labels, algorithm="logistic_regression", test_split=0.2):
    """
    Train a classification model.
    
    Args:
        embeddings: numpy array of shape (n_samples, n_features)
        labels: list of string labels
        algorithm: one of logistic_regression, svm, random_forest
        test_split: fraction of data for testing
    
    Returns:
        dict with model_id, metrics, and file path
    """
    # Encode labels
    le = LabelEncoder()
    y = le.fit_transform(labels)
    X = np.array(embeddings)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_split, random_state=42, stratify=y if len(set(y)) > 1 else None
    )

    # Create model
    model_class = ALGORITHM_MAP.get(algorithm, LogisticRegression)
    
    if algorithm == "svm":
        model = model_class(kernel="linear", probability=True, random_state=42)
    elif algorithm == "random_forest":
        model = model_class(n_estimators=100, random_state=42)
    else:
        model = model_class(max_iter=1000, random_state=42)

    # Train
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "recall": round(recall_score(y_test, y_pred, average="weighted", zero_division=0), 4),
        "f1_score": round(f1_score(y_test, y_pred, average="weighted", zero_division=0), 4),
    }

    # Save model
    model_id = str(uuid.uuid4())
    model_path = os.path.join(MODELS_DIR, f"{model_id}.pkl")
    
    model_data = {
        "model": model,
        "label_encoder": le,
        "algorithm": algorithm,
        "classes": le.classes_.tolist(),
    }
    joblib.dump(model_data, model_path)

    return {
        "model_id": model_id,
        "algorithm": algorithm,
        "metrics": metrics,
        "model_path": model_path,
        "classes": le.classes_.tolist(),
    }


def load_model(model_id):
    """Load a saved model by ID."""
    model_path = os.path.join(MODELS_DIR, f"{model_id}.pkl")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model {model_id} not found")
    return joblib.load(model_path)
