# ⚡ Zero-Server RAG Assistant

> **Run a full RAG (Retrieval-Augmented Generation) pipeline entirely in your browser. No API keys. No servers. 100% Privacy.**

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![React](https://img.shields.io/badge/React-18-cyan) ![Transformers.js](https://img.shields.io/badge/AI-Transformers.js-yellow)

## 📖 Overview

This project is a Proof-of-Concept for **Client-Side AI**. Unlike traditional RAG applications that send your sensitive PDF data to OpenAI or Pinecone, this application performs every step—PDF parsing, embedding generation, vector storage, and LLM inference—locally within the user's browser.

It utilizes **Web Workers** to ensure the UI remains buttery smooth while running heavy Transformer models in the background.

## 📸 Demo

![Application Screenshot](./assets/demo.png)
*(Place a screenshot of your app here. If you don't have one yet, delete this line)*

## ✨ Key Features

* **🔒 Complete Privacy**: Your documents never leave your device.
* **💸 Zero Cost**: No bills from OpenAI, Anthropic, or vector database providers.
* **⚡ Web Worker Architecture**: Heavy AI inference runs on a separate thread, preventing UI freezes.
* **🧠 In-Browser Embeddings**: Uses `Xenova/all-MiniLM-L6-v2` for semantic search.
* **🤖 Local LLM**: Uses `Xenova/LaMini-Flan-T5-248M` for text generation.
* **📊 Real-time Metrics**: Tracks token speed (T/s), retrieval latency, and estimated cost savings.

## 🏗️ Architecture

How does it work without a backend?

```mermaid
graph TD
    User[User Uploads PDF] -->|ArrayBuffer| Worker[Web Worker]
    
    subgraph "Web Worker (Background Thread)"
        Worker -->|PDF.js| Text[Raw Text]
        Text -->|Chunking| Chunks[Text Segments]
        Chunks -->|all-MiniLM-L6-v2| Vectors[Embeddings]
        Vectors --> Store[(Local Vector Store)]
        
        Query[User Query] -->|all-MiniLM-L6-v2| QVec[Query Vector]
        QVec -->|Cosine Similarity| Store
        Store -->|Top 2 Contexts| Context
        
        Context + Query -->|LaMini-Flan-T5| Answer
    end
    
    Answer -->|Post Message| UI[React UI]