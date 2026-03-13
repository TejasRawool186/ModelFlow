const express = require("express");
const axios = require("axios");
const db = require("../db/database");

const router = express.Router();
const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000";

// POST /api/ml/train — Proxy to ML service
router.post("/train", async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/train`, req.body, {
      timeout: 120000,
    });

    const result = response.data;

    // Save model to local DB so Playground can find it
    if (result.model_id) {
      const { v4: uuidv4 } = require("uuid");
      const algo = result.algorithm || req.body.algorithm || "logistic_regression";
      const name = `${algo.replace(/_/g, " ")} — ${new Date().toLocaleDateString()}`;

      try {
        db.prepare(
          `INSERT OR REPLACE INTO models (id, name, algorithm, dataset_id, metrics, status) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          result.model_id,
          name,
          algo,
          req.body.dataset_id || "",
          JSON.stringify(result.metrics || {}),
          "completed"
        );
      } catch (dbErr) {
        console.error("Failed to save model to DB:", dbErr.message);
      }
    }

    res.json(result);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      // Return mock data if ML service isn't running
      const mockId = `mock_${Date.now()}`;
      const algo = req.body.algorithm || "logistic_regression";

      // Save mock model to DB too
      try {
        db.prepare(
          `INSERT OR REPLACE INTO models (id, name, algorithm, metrics, status) VALUES (?, ?, ?, ?, ?)`
        ).run(
          mockId,
          `${algo.replace(/_/g, " ")} (demo)`,
          algo,
          JSON.stringify({ accuracy: 0.87, precision: 0.85, recall: 0.89, f1_score: 0.87 }),
          "completed"
        );
      } catch {}

      res.json({
        model_id: mockId,
        algorithm: algo,
        status: "completed",
        metrics: {
          accuracy: 0.87,
          precision: 0.85,
          recall: 0.89,
          f1_score: 0.87,
        },
        message: "Demo mode — ML service not connected",
      });
    } else {
      res
        .status(err.response?.status || 500)
        .json(err.response?.data || { message: err.message });
    }
  }
});

const lingodevService = require("../services/lingodevService");

// POST /api/ml/predict — Proxy to ML service with translation support
router.post("/predict", async (req, res) => {
  try {
    const { model_id, text, sourceLanguage } = req.body;
    let textToPredict = text;
    let translationMessage = null;

    // 1. Fetch the model to determine its capability
    const model = db.prepare("SELECT multilingual FROM models WHERE id = ?").get(model_id);
    const isMultilingual = model && model.multilingual === 1;

    // 2. If testing in a non-English language on an English-only model, translate first!
    if (sourceLanguage && sourceLanguage !== "en" && !isMultilingual) {
      console.log(`[ML Route] Translating testing input from ${sourceLanguage} to en for English-only model...`);
      const transResults = await lingodevService.expandDataset([text], sourceLanguage, ["en"]);
      
      if (transResults[0] && transResults[0].translations && !transResults[0].error) {
        textToPredict = transResults[0].translations[0];
        translationMessage = `Translated from ${sourceLanguage.toUpperCase()}: "${textToPredict}"`;
      } else {
        console.warn("[ML Route] Translation failed for prediction fallback.");
      }
    }

    // 3. Send to actual ML service
    const response = await axios.post(`${ML_SERVICE_URL}/predict`, { 
      ...req.body, 
      text: textToPredict 
    }, {
      timeout: 10000,
    });
    
    // Add translation message to response if applicable
    const responseData = response.data;
    if (translationMessage) {
      responseData.translation_note = translationMessage;
    }
    
    res.json(responseData);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      const labels = [
        "refund_request",
        "payment_issue",
        "order_status",
        "cancellation",
        "account_update",
      ];
      res.json({
        prediction: labels[Math.floor(Math.random() * labels.length)],
        confidence: +(0.7 + Math.random() * 0.28).toFixed(3),
        message: "Demo mode — ML service not connected",
      });
    } else {
      res
        .status(err.response?.status || 500)
        .json(err.response?.data || { message: err.message });
    }
  }
});

// POST /api/ml/export — Proxy to ML service
router.post("/export", async (req, res) => {
  try {
    const response = await axios.post(`${ML_SERVICE_URL}/export`, req.body, {
      timeout: 30000,
    });
    res.json(response.data);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      res.json({
        format: req.body.format || "python_package",
        files: ["model.pkl", "predict.py", "requirements.txt", "api_server.py"],
        message: "Demo mode — ML service not connected",
      });
    } else {
      res
        .status(err.response?.status || 500)
        .json(err.response?.data || { message: err.message });
    }
  }
});

// GET /api/ml/export/download — Proxy download to ML service
router.get("/export/download", async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ message: "Missing path parameter" });
    }
    
    const response = await axios({
      method: "GET",
      url: `${ML_SERVICE_URL}/export/download`,
      params: { path: filePath },
      responseType: "stream",
      timeout: 30000,
    });
    
    // Forward headers
    if (response.headers["content-type"]) {
      res.setHeader("Content-Type", response.headers["content-type"]);
    }
    if (response.headers["content-disposition"]) {
      res.setHeader("Content-Disposition", response.headers["content-disposition"]);
    }
    
    response.data.pipe(res);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      res.status(503).json({ message: "Demo mode — ML service not connected" });
    } else {
      res
        .status(err.response?.status || 500)
        .json({ message: err.message || "Failed to download export" });
    }
  }
});

// GET /api/ml/models — List trained models
router.get("/models", (req, res) => {
  const models = db
    .prepare("SELECT * FROM models ORDER BY created_at DESC")
    .all();
  res.json(
    models.map((m) => ({
      id: m.id,
      name: m.name,
      algorithm: m.algorithm,
      metrics: JSON.parse(m.metrics || "{}"),
      status: m.status,
      multilingual: m.multilingual === 1,
      createdAt: m.created_at,
    }))
  );
});

module.exports = router;
