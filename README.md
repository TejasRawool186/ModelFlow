<div align="center">

# ModelFlow

**Visual Multilingual AI Model Builder**

ModelFlow is a no-code visual pipeline builder that allows teams to ingest data, connect machine learning algorithms, and deploy production-ready models. Powered by Lingo.dev, ModelFlow natively supports automatic language expansion, allowing your AI to understand global audiences instantly.

[Features](#features) • [How it Works](#how-it-works) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started) • [Documentation](#documentation)

<br/>
<img src="frontend/public/README-assets/hero.png" alt="ModelFlow Hero Banner" width="100%" />

</div>

---

## Demo

Watch the project demo on YouTube:

[ModelFlow Demo Video](https://youtu.be/oy5obVnUl4M)

## The Vision

Most machine learning models suffer from severe language bias due to the dominance of English training data. Building localized datasets for every language is slow, expensive, and scales poorly.

ModelFlow solves this by integrating visual model building with immediate, automated language expansion. By dragging a single node into your training pipeline, your English dataset is automatically translated into multiple languages via Lingo.dev before the model is trained. The result is a single, robust model capable of classifying and understanding sentiment across the globe.

## Features

- **No-Code Visual Pipeline**: Drag and drop nodes to build complex ML workflows visually. No Python or Pandas knowledge required.
- **Multilingual Language Expansion**: Powered by Lingo.dev, multiply your training data into multiple languages in real-time to train robust, globally-aware models.
- **Instant Live Playground**: Test your trained models immediately within the browser using text inputs in any language.
- **Multiple ML Algorithms**: Choose from proven industry-standard algorithms including Random Forest, Support Vector Machines (SVM), and Logistic Regression.
- **One-Click Export**: Download your completely trained, production-ready model as an executable zip package.
- **Data Preprocessing**: Integrated nodes for handling missing values, label encoding, and data normalization.

<p align="center">
  <img src="frontend/public/README-assets/nodes.png" alt="ModelFlow Pipeline Nodes" width="100%" />
</p>
<br/>

## How It Works

ModelFlow operates on a simple, sequential node-based architecture.

1. **Ingest**: Connect a Dataset Node (`.csv`, `.json`, `.txt`) containing your base data.
2. **Clean**: Connect Preprocessing Nodes to handle NaN values and normalize distributions.
3. **Expand**: Connect the Language Expansion Node. The system interfaces with Lingo.dev to translate the dataset into configured target languages, massively expanding the training scope.
4. **Train**: Connect a Model Node and configure hyperparameters visually. The backend FastAPI service handles the computationally intensive training process.
5. **Deploy**: Connect an Export Node to package the finalized `.pkl` model and deployment scripts.

## Tech Stack

ModelFlow utilizes a modern, decoupled microservices architecture designed for high throughput and rapid iteration.

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS v4 with a custom Bauhaus design system
- **Workspace**: React Flow for node-based visual rendering

### Backend API
- **Runtime**: Node.js with Express
- **Architecture**: REST API for managing project state, datasets, and pipeline configurations.

### Machine Learning Service
- **Runtime**: Python 3.10+ / FastAPI
- **Engine**: Scikit-Learn, Pandas, NumPy
- **Integration**: Lingo.dev SDK for automated language translation and dataset expansion.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.10 or higher)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TejasRawool186/ModelFlow-.git
   cd ModelFlow-
   ```

2. **Start the ML Service**
   ```bash
   cd ml-service
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

3. **Start the Node Backend**
   ```bash
   cd ../backend
   npm install
   npm run dev
   ```

4. **Start the Frontend Client**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## Architecture Overview

The system operates across three primary layers:

1. **The Client (Next.js)**: Manages the React Flow graph state and compiles the visual nodes into a JSON pipeline configuration.
2. **The Orchestrator (Node.js)**: Validates the pipeline configuration, manages raw dataset storage, and handles request routing.
3. **The Engine (Python)**: Parses the pipeline JSON, executes the Pandas data manipulation, triggers external SDK calls (Lingo.dev), and utilizes Scikit-learn to train and serialize the final model.

## Design System

The application interface strictly adheres to Bauhaus design principles:
- **Color Palette**: High-contrast primary triad (Red, Yellow, Blue).
- **Typography**: Geometric sans-serif (Inter) utilized in heavy weights for structural hierarchy.
- **Componentry**: Hard edges, 2px solid borders, and functional geometric accents removing unnecessary visual noise.

## License

This project is licensed under the MIT License.
