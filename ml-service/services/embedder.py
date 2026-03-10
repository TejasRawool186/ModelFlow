"""
Embedder service — generates text embeddings using sentence-transformers.
"""

import numpy as np

# Lazy import to avoid slow startup
_model_cache = {}


def get_model(model_name="all-MiniLM-L6-v2"):
    """Get or load a sentence-transformers model."""
    if model_name not in _model_cache:
        try:
            from sentence_transformers import SentenceTransformer
            _model_cache[model_name] = SentenceTransformer(model_name)
        except Exception as e:
            print(f"Warning: Could not load model {model_name}: {e}")
            return None
    return _model_cache[model_name]


def generate_embeddings(texts, model_name="all-MiniLM-L6-v2"):
    """
    Generate embeddings for a list of texts.
    Falls back to random embeddings if sentence-transformers isn't available.
    """
    model = get_model(model_name)
    
    if model is not None:
        embeddings = model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()
    else:
        # Fallback: generate random embeddings for demo
        print("Using random embeddings (sentence-transformers not available)")
        return np.random.rand(len(texts), 384).tolist()
