const axios = require("axios");
const lingodevService = require("./lingodevService");

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Pipeline executor — reads pipeline graph, topologically sorts nodes,
 * and executes each node in order.
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
    case "dataset":
      return { datasetId: config.datasetId, format: config.format };

    case "language":
      return await executeLangNode(config, inputs);

    case "embedding":
      return await executeEmbeddingNode(config, inputs);

    case "training":
      return await executeTrainingNode(config, inputs);

    case "testing":
      return await executeTestingNode(config, inputs);

    case "export":
      return await executeExportNode(config, inputs);

    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

async function executeLangNode(config, inputs) {
  const texts = inputs.data?.texts || ["sample text"];
  const result = await lingodevService.expandDataset(
    texts,
    config.sourceLanguage || "en",
    config.languages || ["hi", "es"]
  );
  return { data: { texts, translations: result } };
}

async function executeEmbeddingNode(config, inputs) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/embed`, {
      texts: inputs.data?.texts || [],
      model: config.model || "all-MiniLM-L6-v2",
    });
    return { embeddings: res.data };
  } catch {
    return { embeddings: { status: "mock", message: "ML service not available" } };
  }
}

async function executeTrainingNode(config, inputs) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/train`, {
      dataset_id: inputs.datasetId || "demo",
      algorithm: config.algorithm || "logistic_regression",
      test_split: config.testSplit || 0.2,
    });
    return { model: res.data };
  } catch {
    return {
      model: {
        status: "mock",
        metrics: { accuracy: 0.87, precision: 0.85, recall: 0.89, f1: 0.87 },
      },
    };
  }
}

async function executeTestingNode(config, inputs) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/predict`, {
      model_id: inputs.model?.id || "demo",
      text: config.testInput || "test",
    });
    return { prediction: res.data };
  } catch {
    return {
      prediction: {
        status: "mock",
        label: "demo_label",
        confidence: 0.92,
      },
    };
  }
}

async function executeExportNode(config, inputs) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/export`, {
      model_id: inputs.model?.id || "demo",
      format: config.format || "python_package",
    });
    return { export: res.data };
  } catch {
    return {
      export: {
        status: "mock",
        files: ["model.pkl", "predict.py", "requirements.txt", "api_server.py"],
      },
    };
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
