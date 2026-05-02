import { initCollections } from "./lib/chromadb.js";

async function main() {
  await initCollections();
  console.log("ChromaDB initialized successfully");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
