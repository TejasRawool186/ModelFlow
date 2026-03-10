const path = require("path");
const fs = require("fs");

const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");
const MODELS_DIR = path.join(__dirname, "..", "..", "models");

// Ensure directories exist
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(MODELS_DIR, { recursive: true });

const storageService = {
  getUploadsDir() {
    return UPLOADS_DIR;
  },

  getModelsDir() {
    return MODELS_DIR;
  },

  saveFile(filename, buffer) {
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
  },

  readFile(filepath) {
    return fs.readFileSync(filepath, "utf-8");
  },

  deleteFile(filepath) {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  },

  fileExists(filepath) {
    return fs.existsSync(filepath);
  },
};

module.exports = storageService;
