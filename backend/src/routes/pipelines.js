const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/database");

const router = express.Router();

// POST /api/pipelines — Save new pipeline
router.post("/", (req, res) => {
  const { name, description, nodes, edges } = req.body;
  const id = uuidv4();

  db.prepare(
    `INSERT INTO pipelines (id, name, description, nodes, edges) VALUES (?, ?, ?, ?, ?)`
  ).run(
    id,
    name || "Untitled Pipeline",
    description || "",
    JSON.stringify(nodes || []),
    JSON.stringify(edges || [])
  );

  res.json({
    id,
    name: name || "Untitled Pipeline",
    description: description || "",
    createdAt: new Date().toISOString(),
  });
});

// GET /api/pipelines — List all pipelines
router.get("/", (req, res) => {
  const pipelines = db
    .prepare("SELECT * FROM pipelines ORDER BY updated_at DESC")
    .all();
  res.json(
    pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      nodeCount: JSON.parse(p.nodes).length,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))
  );
});

// GET /api/pipelines/:id — Get single pipeline
router.get("/:id", (req, res) => {
  const p = db
    .prepare("SELECT * FROM pipelines WHERE id = ?")
    .get(req.params.id);
  if (!p) return res.status(404).json({ message: "Pipeline not found" });

  res.json({
    id: p.id,
    name: p.name,
    description: p.description,
    nodes: JSON.parse(p.nodes),
    edges: JSON.parse(p.edges),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  });
});

// PUT /api/pipelines/:id — Update pipeline
router.put("/:id", (req, res) => {
  const p = db
    .prepare("SELECT * FROM pipelines WHERE id = ?")
    .get(req.params.id);
  if (!p) return res.status(404).json({ message: "Pipeline not found" });

  const { name, description, nodes, edges } = req.body;

  db.prepare(
    `UPDATE pipelines SET name = ?, description = ?, nodes = ?, edges = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    name || p.name,
    description ?? p.description,
    JSON.stringify(nodes || JSON.parse(p.nodes)),
    JSON.stringify(edges || JSON.parse(p.edges)),
    req.params.id
  );

  res.json({ message: "Pipeline updated" });
});

// DELETE /api/pipelines/:id — Delete pipeline
router.delete("/:id", (req, res) => {
  const p = db
    .prepare("SELECT * FROM pipelines WHERE id = ?")
    .get(req.params.id);
  if (!p) return res.status(404).json({ message: "Pipeline not found" });

  db.prepare("DELETE FROM pipelines WHERE id = ?").run(req.params.id);
  res.json({ message: "Pipeline deleted" });
});

module.exports = router;
