require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const errorHandler = require("./middleware/errorHandler");
const datasetsRouter = require("./routes/datasets");
const pipelinesRouter = require("./routes/pipelines");
const executionRouter = require("./routes/execution");
const mlRouter = require("./routes/ml");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "modelflow-backend", timestamp: new Date().toISOString() });
});

// API Routes
app.use("/api/datasets", datasetsRouter);
app.use("/api/pipelines", pipelinesRouter);
app.use("/api/execution", executionRouter);
app.use("/api/ml", mlRouter);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n  ✓ ModelFlow Backend running at http://localhost:${PORT}`);
  console.log(`  ✓ Health check: http://localhost:${PORT}/health`);
  console.log(`  ✓ API base: http://localhost:${PORT}/api\n`);
});

module.exports = app;
