import { ChromaClient } from "chromadb";

let client: ChromaClient | undefined;

export function getChromaClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({
      path: process.env["CHROMA_URL"] ?? "http://localhost:8000",
    });
  }
  return client;
}

export const COLLECTIONS = {
  ARTICLE_SUMMARIES: "article_summaries",
  PREDICTIONS: "predictions",
} as const;

export async function initCollections(): Promise<void> {
  const chroma = getChromaClient();
  for (const name of Object.values(COLLECTIONS)) {
    await chroma.getOrCreateCollection({ name });
  }
}
