const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/database");
const pipelineExecutor = require("../services/pipelineExecutor");

const router = express.Router();

// POST /api/execution/run — Execute a pipeline
router.post("/run", async (req, res) => {
  const { pipelineId, nodes, edges } = req.body;
  let pipelineNodes = nodes;
  let pipelineEdges = edges;

  // If pipelineId is provided, load from DB
  if (pipelineId) {
    const pipeline = db
      .prepare("SELECT * FROM pipelines WHERE id = ?")
      .get(pipelineId);
    if (!pipeline) {
      return res.status(404).json({ message: "Pipeline not found" });
    }
    pipelineNodes = JSON.parse(pipeline.nodes);
    pipelineEdges = JSON.parse(pipeline.edges);
  }

  if (!pipelineNodes || pipelineNodes.length === 0) {
    return res.status(400).json({ message: "Pipeline has no nodes" });
  }

  const executionId = uuidv4();

  // Create execution record
  db.prepare(
    `INSERT INTO executions (id, pipeline_id, status) VALUES (?, ?, ?)`
  ).run(executionId, pipelineId || "inline", "running");

  try {
    const results = await pipelineExecutor.execute(
      pipelineNodes,
      pipelineEdges
    );

    const hasError = results.some((r) => r.status === "error");

    db.prepare(
      `UPDATE executions SET status = ?, results = ?, completed_at = datetime('now') WHERE id = ?`
    ).run(
      hasError ? "failed" : "completed",
      JSON.stringify(results),
      executionId
    );

    res.json({
      executionId,
      status: hasError ? "failed" : "completed",
      results,
    });
  } catch (err) {
    db.prepare(
      `UPDATE executions SET status = ?, error = ?, completed_at = datetime('now') WHERE id = ?`
    ).run("failed", err.message, executionId);

    res.status(500).json({
      executionId,
      status: "failed",
      error: err.message,
    });
  }
});

// GET /api/execution/:id/status
router.get("/:id/status", (req, res) => {
  const exec = db
    .prepare("SELECT * FROM executions WHERE id = ?")
    .get(req.params.id);
  if (!exec) return res.status(404).json({ message: "Execution not found" });

  res.json({
    id: exec.id,
    pipelineId: exec.pipeline_id,
    status: exec.status,
    results: JSON.parse(exec.results || "{}"),
    error: exec.error,
    startedAt: exec.started_at,
    completedAt: exec.completed_at,
  });
});

module.exports = router;
