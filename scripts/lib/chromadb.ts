/**
 * ChromaDB client wrapper
 * Connects to local ChromaDB instance at CHROMA_URL
 * Uses default embedding function for automatic embeddings
 */

import { ChromaClient } from "chromadb";
import { DefaultEmbeddingFunction } from "@chroma-core/default-embed";

let client: ChromaClient | undefined;
const ef = new DefaultEmbeddingFunction();

export function getChromaClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({
      path: process.env["CHROMA_URL"] ?? "http://localhost:8000",
    });
  }
  return client;
}

export function getEmbeddingFunction(): DefaultEmbeddingFunction {
  return ef;
}

export const COLLECTIONS = {
  ARTICLE_SUMMARIES: "article_summaries",
  PREDICTIONS: "predictions",
} as const;

// Flag to disable ChromaDB ops if unavailable
let chromaAvailable = true;
let collectionsInitialized = false;

export function isChromaAvailable(): boolean {
  return chromaAvailable;
}

export async function initCollections(): Promise<void> {
  if (!chromaAvailable || collectionsInitialized) return;
  
  try {
    const chroma = getChromaClient();
    for (const name of Object.values(COLLECTIONS)) {
      await chroma.getOrCreateCollection({ name });
    }
    collectionsInitialized = true;
    console.log("[chromadb] Collections initialized:", Object.values(COLLECTIONS));
  } catch (err) {
    console.warn("[chromadb] Failed to initialize:", (err as Error).message);
    chromaAvailable = false;
  }
}
