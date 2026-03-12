const axios = require("axios");
const db = require("../db/database");
const storageService = require("./storageService");
const lingodevService = require("./lingodevService");

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Pipeline executor — reads pipeline graph, topologically sorts nodes,
 * and executes each node in order, passing real data between steps.
 */
const pipelineExecutor = {
  async execute(nodes, edges, context = {}) {
    const sorted = topologicalSort(nodes, edges);
    const nodeOutputs = {};
    const results = [];

    for (const node of sorted) {
      console.log(`[Executor] Running node: ${node.type} (${node.id})`);

      try {
        const inputs = getNodeInputs(node.id, edges, nodeOutputs);
        const output = await executeNode(node, inputs, context);
        nodeOutputs[node.id] = output;

        results.push({
          nodeId: node.id,
          type: node.type,
          status: "completed",
          output,
        });
      } catch (err) {
        console.error(`[Executor] Node ${node.type} (${node.id}) failed:`, err.message);
        results.push({
          nodeId: node.id,
          type: node.type,
          status: "error",
          error: err.message,
        });
        break; // Stop pipeline on error
      }
    }

    return results;
  },
};

async function executeNode(node, inputs, context) {
  const config = node.data?.config || {};

  switch (node.type) {
    case "data_preview":
      return await executeDataPreviewNode(config, inputs);

    case "dataset":
      return await executeDatasetNode(config, inputs);

    case "preprocessing":
      return await executePreprocessingNode(config, inputs);

    case "language":
      return await executeLangNode(config, inputs);

    case "embedding":
      return await executeEmbeddingNode(config, inputs);

    case "validation":
      return await executeValidationNode(config, inputs);

    case "training":
      return await executeTrainingNode(config, inputs);

    case "evaluation":
      return await executeEvaluationNode(config, inputs);

    case "testing":
      return await executeTestingNode(config, inputs);

    case "export":
      return await executeExportNode(config, inputs);

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

/**
 * Dataset node — reads actual file content from DB and returns parsed data
 */
async function executeDatasetNode(config) {
  const datasetId = config.datasetId;
  if (!datasetId) {
    throw new Error("No dataset selected. Please configure the Dataset node.");
  }

  const ds = db.prepare("SELECT * FROM datasets WHERE id = ?").get(datasetId);
  if (!ds) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  let content;
  try {
    content = storageService.readFile(ds.filepath);
  } catch (err) {
    throw new Error(`Cannot read dataset file: ${err.message}`);
  }

  // Parse CSV content
  let headers = [];
  let rows = [];

  if (ds.format === "csv") {
    const lines = content.split("\n").filter((l) => l.trim() && !l.split(",").every((c) => !c.trim()));
    if (lines.length < 2) {
      throw new Error("Dataset must have at least a header and one data row");
    }
    headers = lines[0].split(",").map((h) => h.trim().replace(/\r/g, ""));
    rows = lines.slice(1).map((line) => {
      const vals = line.split(",");
      const row = {};
      headers.forEach((h, i) => (row[h] = vals[i]?.trim().replace(/\r/g, "") || ""));
      return row;
    });
  } else if (ds.format === "json") {
    const data = JSON.parse(content);
    const arr = Array.isArray(data) ? data : [data];
    headers = arr.length > 0 ? Object.keys(arr[0]) : [];
    rows = arr;
  } else {
    // TXT — treat each line as a text entry
    headers = ["text"];
    rows = content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => ({ text: l.trim() }));
  }

  console.log(`[Executor] Dataset loaded: ${ds.name}, ${rows.length} rows, columns: [${headers.join(", ")}]`);

  return {
    datasetId,
    datasetName: ds.name,
    format: ds.format,
    headers,
    rows,
    rowCount: rows.length,
    textColumn: config.textColumn || null,
    labelColumn: config.labelColumn || null,
  };
}

/**
 * Data Preview node — passes data through but specifically truncates it for preview
 */
async function executeDataPreviewNode(config, inputs) {
  const data = inputs;
  if (!data || !data.rows) {
    throw new Error("No data received. Connect a Dataset or Preprocessing node first.");
  }
  const numRows = config.numRows || 5;
  return {
    ...data,
    previewRows: data.rows.slice(0, numRows),
    previewHeaders: data.headers || Object.keys(data.rows[0] || {}),
    totalRowCount: data.rows.length,
    numPreviewRows: numRows,
    isDataPreview: true,
  };
}

/**
 * Preprocessing node — select columns, clean text, filter empty rows
 */
async function executePreprocessingNode(config, inputs) {
  const textColumn = config.textColumn || inputs.textColumn;
  const labelColumn = config.labelColumn || inputs.labelColumn;
  let rows = inputs.rows || [];
  const headers = inputs.headers || [];

  if (!textColumn) {
    throw new Error("No text column specified. Configure the Preprocessing node or Dataset node.");
  }
  if (!labelColumn) {
    throw new Error("No label column specified. Configure the Preprocessing node or Dataset node.");
  }
  if (!headers.includes(textColumn)) {
    throw new Error(`Text column "${textColumn}" not found in dataset. Available columns: ${headers.join(", ")}`);
  }
  if (!headers.includes(labelColumn)) {
    throw new Error(`Label column "${labelColumn}" not found in dataset. Available columns: ${headers.join(", ")}`);
  }

  // Filter rows with empty text or label
  const beforeCount = rows.length;
  rows = rows.filter((r) => r[textColumn]?.trim() && r[labelColumn]?.trim());

  // Apply text cleaning
  const texts = rows.map((r) => {
    let text = r[textColumn];
    if (config.lowercase) text = text.toLowerCase();
    if (config.stripHtml) text = text.replace(/<[^>]*>/g, "");
    if (config.removePunctuation) text = text.replace(/[^\w\s]/g, "");
    return text.trim();
  });

  const labels = rows.map((r) => r[labelColumn].trim());

  const uniqueLabels = [...new Set(labels)];

  console.log(`[Executor] Preprocessing: ${beforeCount} → ${texts.length} rows, ${uniqueLabels.length} classes`);

  return {
    texts,
    labels,
    textColumn,
    labelColumn,
    rowCount: texts.length,
    removedRows: beforeCount - texts.length,
    uniqueLabels,
    classCount: uniqueLabels.length,
    classCounts: uniqueLabels.reduce((acc, l) => {
      acc[l] = labels.filter((lb) => lb === l).length;
      return acc;
    }, {}),
  };
}

/**
 * Validation node — check data quality before training
 */
async function executeValidationNode(config, inputs) {
  const texts = inputs.texts || [];
  const labels = inputs.labels || [];
  const issues = [];
  const warnings = [];

  const minRows = config.minRows || 10;
  const minClasses = config.minClasses || 2;

  if (texts.length === 0) {
    issues.push("No data found. Make sure the dataset and preprocessing are configured correctly.");
  }
  if (texts.length < minRows) {
    warnings.push(`Only ${texts.length} rows — recommended minimum is ${minRows} for reliable training.`);
  }

  const uniqueLabels = [...new Set(labels)];
  if (uniqueLabels.length < minClasses) {
    issues.push(`Only ${uniqueLabels.length} class(es) found — need at least ${minClasses} for classification.`);
  }

  // Check class balance
  const classCounts = {};
  labels.forEach((l) => (classCounts[l] = (classCounts[l] || 0) + 1));
  const counts = Object.values(classCounts);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  if (maxCount > minCount * 5) {
    warnings.push(`Class imbalance detected: largest class has ${maxCount} samples, smallest has ${minCount}.`);
  }

  // Check for very short texts
  const shortTexts = texts.filter((t) => t.split(/\s+/).length < 3).length;
  if (shortTexts > texts.length * 0.3) {
    warnings.push(`${shortTexts} texts (${Math.round(shortTexts / texts.length * 100)}%) have fewer than 3 words.`);
  }

  const valid = issues.length === 0;

  console.log(`[Executor] Validation: ${valid ? "PASSED" : "FAILED"}, ${issues.length} issues, ${warnings.length} warnings`);

  if (!valid) {
    throw new Error(`Validation failed: ${issues.join("; ")}`);
  }

  return {
    valid,
    issues,
    warnings,
    stats: {
      totalRows: texts.length,
      classCount: uniqueLabels.length,
      classes: uniqueLabels,
      classCounts,
    },
    // Pass through data
    texts,
    labels,
    textColumn: inputs.textColumn,
    labelColumn: inputs.labelColumn,
    uniqueLabels: inputs.uniqueLabels,
  };
}

async function executeLangNode(config, inputs) {
  const texts = inputs.texts || inputs.rows?.map((r) => r[inputs.textColumn]) || ["sample text"];
  const result = await lingodevService.expandDataset(
    texts,
    config.sourceLanguage || "en",
    config.languages || ["hi", "es"]
  );
  return {
    data: { texts, translations: result },
    // Pass through
    texts: inputs.texts,
    labels: inputs.labels,
    textColumn: inputs.textColumn,
    labelColumn: inputs.labelColumn,
  };
}

async function executeEmbeddingNode(config, inputs) {
  const texts = inputs.texts || [];

  if (texts.length === 0) {
    throw new Error("No texts to embed. Connect a Preprocessing or Dataset node first.");
  }

  try {
    const res = await axios.post(`${ML_SERVICE_URL}/embed`, {
      texts,
      model: config.model || "all-MiniLM-L6-v2",
    }, { timeout: 120000 });
    console.log(`[Executor] Embedded ${texts.length} texts using ${config.model || "all-MiniLM-L6-v2"}`);
    return {
      embeddings: res.data.embeddings,
      embeddingModel: config.model || "all-MiniLM-L6-v2",
      count: texts.length,
      // Pass through
      texts,
      labels: inputs.labels,
      textColumn: inputs.textColumn,
      labelColumn: inputs.labelColumn,
      uniqueLabels: inputs.uniqueLabels,
    };
  } catch (err) {
    throw new Error(`Embedding failed: ${err.response?.data?.detail || err.message}`);
  }
}

/**
 * Training node — sends real data to ML service and saves model to backend DB
 */
async function executeTrainingNode(config, inputs) {
  const texts = inputs.texts || [];
  const labels = inputs.labels || [];
  const embeddings = inputs.embeddings || null;
  const algorithm = config.algorithm || "logistic_regression";
  const testSplit = config.testSplit || 0.2;

  if (texts.length === 0 && !embeddings) {
    throw new Error("No training data. Connect a Preprocessing node or provide data upstream.");
  }
  if (labels.length === 0) {
    throw new Error("No labels found. Make sure a label column is configured in the Preprocessing node.");
  }

  try {
    const payload = {
      algorithm,
      test_split: testSplit,
      embedding_model: config.embeddingModel || inputs.embeddingModel || "all-MiniLM-L6-v2",
      hyperparams: { ...config }
    };

    // Send pre-computed embeddings if available, otherwise send raw texts
    if (embeddings) {
      payload.embeddings = embeddings;
      payload.labels = labels;
    } else {
      payload.texts = texts;
      payload.labels = labels;
    }

    require('fs').writeFileSync('D:/ModelFlow/last_train_payload.json', JSON.stringify(payload, null, 2));

    console.log(`[Executor] Training ${algorithm} model with ${texts.length || embeddings?.length} samples...`);

    const res = await axios.post(`${ML_SERVICE_URL}/train`, payload, {
      timeout: 300000, // 5 min timeout for training
    });

    const result = res.data;

    // Save model to backend DB so Playground can find it
    if (result.model_id) {
      const modelName = `${algorithm.replace(/_/g, " ")} — ${new Date().toLocaleDateString()}`;
      try {
        db.prepare(
          `INSERT OR REPLACE INTO models (id, name, algorithm, dataset_id, metrics, status) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          result.model_id,
          modelName,
          algorithm,
          inputs.datasetId || "",
          JSON.stringify(result.metrics || {}),
          "completed"
        );
        console.log(`[Executor] Model saved to DB: ${result.model_id} (${modelName})`);
      } catch (dbErr) {
        console.error("[Executor] Failed to save model to DB:", dbErr.message);
      }
    }

    return {
      modelId: result.model_id,
      algorithm,
      metrics: result.metrics,
      classes: result.classes || inputs.uniqueLabels || [],
      status: "completed",
      // Pass through for downstream nodes
      texts,
      labels,
    };
  } catch (err) {
    throw new Error(`Training failed: ${err.response?.data?.detail || err.message}`);
  }
}

/**
 * Evaluation node — display training metrics
 */
async function executeEvaluationNode(config, inputs) {
  const metrics = inputs.metrics || {};
  const classes = inputs.classes || [];

  return {
    metrics,
    classes,
    algorithm: inputs.algorithm,
    modelId: inputs.modelId,
    summary: {
      accuracy: metrics.accuracy ? `${(metrics.accuracy * 100).toFixed(1)}%` : "N/A",
      precision: metrics.precision ? `${(metrics.precision * 100).toFixed(1)}%` : "N/A",
      recall: metrics.recall ? `${(metrics.recall * 100).toFixed(1)}%` : "N/A",
      f1_score: metrics.f1_score ? `${(metrics.f1_score * 100).toFixed(1)}%` : "N/A",
    },
    // Pass through
    modelId: inputs.modelId,
    texts: inputs.texts,
    labels: inputs.labels,
  };
}

/**
 * Testing node — uses the correct model_id from training output
 */
async function executeTestingNode(config, inputs) {
  const modelId = inputs.modelId;
  const testInput = config.testInput || "test";

  if (!modelId) {
    throw new Error("No trained model found. Connect a Training node before Testing.");
  }

  try {
    const res = await axios.post(`${ML_SERVICE_URL}/predict`, {
      model_id: modelId,
      text: testInput,
      embedding_model: inputs.embeddingModel || "all-MiniLM-L6-v2",
    }, { timeout: 30000 });

    console.log(`[Executor] Test prediction: "${testInput}" → ${res.data.prediction} (${res.data.confidence})`);

    return {
      prediction: res.data.prediction,
      confidence: res.data.confidence,
      text: testInput,
      modelId,
    };
  } catch (err) {
    throw new Error(`Prediction failed: ${err.response?.data?.detail || err.message}`);
  }
}

async function executeExportNode(config, inputs) {
  const modelId = inputs.modelId;

  if (!modelId) {
    throw new Error("No trained model found. Connect a Training node before Export.");
  }

  try {
    const res = await axios.post(`${ML_SERVICE_URL}/export`, {
      model_id: modelId,
      format: config.format || "python_package",
    }, { timeout: 60000 });

    return {
      export: res.data,
      modelId,
    };
  } catch (err) {
    throw new Error(`Export failed: ${err.response?.data?.detail || err.message}`);
  }
}

function topologicalSort(nodes, edges) {
  const nodeMap = {};
  nodes.forEach((n) => (nodeMap[n.id] = n));

  const inDegree = {};
  const adj = {};
  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach((e) => {
    adj[e.source] = adj[e.source] || [];
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const sorted = [];

  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(nodeMap[id]);
    (adj[id] || []).forEach((target) => {
      inDegree[target]--;
      if (inDegree[target] === 0) queue.push(target);
    });
  }

  return sorted;
}

function getNodeInputs(nodeId, edges, nodeOutputs) {
  const input = {};
  edges
    .filter((e) => e.target === nodeId)
    .forEach((e) => {
      if (nodeOutputs[e.source]) {
        Object.assign(input, nodeOutputs[e.source]);
      }
    });
  return input;
}

module.exports = pipelineExecutor;
