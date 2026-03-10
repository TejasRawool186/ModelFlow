const express = require("express");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/database");
const storageService = require("../services/storageService");

const router = express.Router();

// Configure multer
const upload = multer({
  dest: storageService.getUploadsDir(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".csv", ".json", ".txt"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Supported formats: CSV, JSON, TXT"));
    }
  },
});

// POST /api/datasets/upload
router.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "No file provided" });
  }

  const id = uuidv4();
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");

  // Count rows (simple line count for CSV/TXT)
  let rows = 0;
  try {
    const content = storageService.readFile(file.path);
    rows = content.split("\n").filter((l) => l.trim()).length;
    if (ext === "csv") rows = Math.max(0, rows - 1); // exclude header
  } catch {}

  const stmt = db.prepare(
    `INSERT INTO datasets (id, name, format, filepath, rows, status) VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(id, file.originalname, ext, file.path, rows, "uploaded");

  res.json({
    id,
    name: file.originalname,
    format: ext,
    rows,
    status: "uploaded",
    createdAt: new Date().toISOString(),
  });
});

// GET /api/datasets
router.get("/", (req, res) => {
  const datasets = db
    .prepare("SELECT * FROM datasets ORDER BY created_at DESC")
    .all();
  res.json(
    datasets.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      rows: d.rows,
      status: d.status,
      createdAt: d.created_at,
    }))
  );
});

// GET /api/datasets/:id/preview
router.get("/:id/preview", (req, res) => {
  const ds = db.prepare("SELECT * FROM datasets WHERE id = ?").get(req.params.id);
  if (!ds) return res.status(404).json({ message: "Dataset not found" });

  try {
    const content = storageService.readFile(ds.filepath);
    let headers = [];
    let rows = [];

    if (ds.format === "csv") {
      const lines = content.split("\n").filter((l) => l.trim());
      headers = lines[0].split(",").map((h) => h.trim());
      rows = lines.slice(1).map((line) => {
        const vals = line.split(",");
        const row = {};
        headers.forEach((h, i) => (row[h] = vals[i]?.trim() || ""));
        return row;
      });
    } else if (ds.format === "json") {
      const data = JSON.parse(content);
      const arr = Array.isArray(data) ? data : [data];
      headers = arr.length > 0 ? Object.keys(arr[0]) : [];
      rows = arr;
    } else {
      headers = ["text"];
      rows = content
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => ({ text: l.trim() }));
    }

    res.json({ headers, rows: rows.slice(0, 100) });
  } catch (err) {
    res.status(500).json({ message: "Failed to read dataset: " + err.message });
  }
});

// POST /api/datasets/:id/validate
router.post("/:id/validate", (req, res) => {
  const ds = db.prepare("SELECT * FROM datasets WHERE id = ?").get(req.params.id);
  if (!ds) return res.status(404).json({ message: "Dataset not found" });

  try {
    const content = storageService.readFile(ds.filepath);
    const lines = content.split("\n").filter((l) => l.trim());

    if (lines.length < 2) {
      return res.json({ valid: false, message: "Dataset must have at least 2 rows" });
    }

    db.prepare("UPDATE datasets SET status = ? WHERE id = ?").run("validated", ds.id);

    res.json({ valid: true, rows: lines.length, message: "Dataset is valid" });
  } catch (err) {
    res.json({ valid: false, message: err.message });
  }
});

// DELETE /api/datasets/:id
router.delete("/:id", (req, res) => {
  const ds = db.prepare("SELECT * FROM datasets WHERE id = ?").get(req.params.id);
  if (!ds) return res.status(404).json({ message: "Dataset not found" });

  storageService.deleteFile(ds.filepath);
  db.prepare("DELETE FROM datasets WHERE id = ?").run(req.params.id);

  res.json({ message: "Dataset deleted" });
});

module.exports = router;
