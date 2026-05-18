#!/usr/bin/env tsx
/**
 * scout-pdf.ts — PDF text extraction for Info-Sentry
 *
 * Usage:
 *   npx tsx scripts/scout-pdf.ts --url=https://example.com/paper.pdf [--source=<id>]
 *   npx tsx scripts/scout-pdf.ts --file=/path/to/document.pdf [--source=<id>]
 *
 * Extracts text from PDF documents and saves them as articles.
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getScoutDb, disconnectAll } from "./lib/prisma.js";

const ARTICLES_DIR = process.env["ARTICLES_DIR"] ?? "./data/articles";
const PDF_DIR = process.env["PDF_DIR"] ?? "./data/pdfs";

interface PDFOptions {
  url?: string;
  file?: string;
  sourceId?: string;
  dryRun?: boolean;
}

function parseArgs(): PDFOptions {
  const args = process.argv.slice(2);
  const options: PDFOptions = {};

  for (const arg of args) {
    if (arg.startsWith("--url=")) {
      options.url = arg.split("=")[1];
    } else if (arg.startsWith("--file=")) {
      options.file = arg.split("=")[1];
    } else if (arg.startsWith("--source=")) {
      options.sourceId = arg.split("=")[1];
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    }
  }

  if (!options.url && !options.file) {
    console.error("Usage: npx tsx scripts/scout-pdf.ts --url=<pdf-url> | --file=<pdf-path> [--source=<id>]");
    process.exit(1);
  }

  return options;
}

// Dynamic import for pdf-parse to avoid bundling issues
async function loadPdfParse() {
  const pdfModule = await import("pdf-parse/lib/pdf-parse.js");
  return pdfModule.default || pdfModule;
}

async function fetchPDF(url: string): Promise<Buffer> {
  console.log(`[pdf] Fetching ${url}`);
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Info-Sentry Scout/1.0 (Academic/Research Bot)",
    },
    signal: AbortSignal.timeout(60000), // 60s for large PDFs
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function readPDFFile(path: string): Promise<Buffer> {
  const { readFile } = await import("node:fs/promises");
  return readFile(path);
}

async function extractText(buffer: Buffer): Promise<{ text: string; metadata: any }> {
  const pdfParse = await loadPdfParse();
  const result = await pdfParse(buffer);

  // Clean up extracted text
  const cleanText = result.text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\f/g, "\n\n--- Page Break ---\n\n")
    .trim();

  return {
    text: cleanText,
    metadata: {
      pages: result.numpages,
      info: result.info,
    },
  };
}

function generateExtractId(url?: string): string {
  const timestamp = Date.now();
  const source = url ? url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50) : "local";
  return `pdf_${source}_${timestamp}`;
}

async function extractTitle(text: string, metadata: { info?: { Title?: string } }, url?: string): Promise<string> {
  // Try metadata first
  if (metadata.info?.Title) {
    return metadata.info.Title;
  }

  // Try first line
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    const firstLine = lines[0]!.trim();
    if (firstLine.length > 10 && firstLine.length < 200) {
      return firstLine;
    }
  }

  // Fall back to URL or generic
  if (url) {
    const urlObj = new URL(url);
    const filename = urlObj.pathname.split("/").pop()?.replace(".pdf", "");
    if (filename) {
      return filename.replace(/[_-]/g, " ");
    }
  }

  return "PDF Document";
}

async function main(): Promise<void> {
  const options = parseArgs();

  try {
    // Get PDF buffer
    const buffer = options.url
      ? await fetchPDF(options.url)
      : await readPDFFile(options.file!);

    console.log(`[pdf] Loaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    // Extract text
    const { text, metadata } = await extractText(buffer);
    console.log(`[pdf] Extracted ${text.length} chars from ${metadata.pages} pages`);

    if (text.length < 100) {
      console.warn("[pdf] Warning: Extracted text is very short, may be image-based PDF");
    }

    // Generate content
    const title = await extractTitle(text, metadata, options.url);
    const url = options.url || `file://${options.file}`;

    const content = `# ${title}

**Source:** ${url}
**Pages:** ${metadata.pages}
**Extracted:** ${new Date().toISOString()}

---

${text.slice(0, 50000)} ${text.length > 50000 ? "\n\n[Content truncated for analysis]" : ""}
`;

    if (options.dryRun) {
      console.log("\n--- Extracted Content Preview ---");
      console.log(content.slice(0, 1000));
      console.log("\n[... truncated in dry-run mode]");
      await disconnectAll();
      return;
    }

    // Save to file
    const extractId = generateExtractId(options.url);
    const filename = `${extractId}.md`;
    const filePath = join(ARTICLES_DIR, filename);

    await mkdir(ARTICLES_DIR, { recursive: true });
    await writeFile(filePath, content, "utf-8");
    console.log(`[pdf] Saved to ${filePath}`);

    // Save to database if source provided
    if (options.sourceId) {
      const db = getScoutDb();

      const source = await db.source.findUnique({
        where: { id: options.sourceId },
      });

      if (!source) {
        console.warn(`[pdf] Source ${options.sourceId} not found, skipping DB save`);
      } else {
        // Check for duplicate
        const existing = await db.article.findUnique({
          where: { url },
        });

        if (existing) {
          console.log(`[pdf] Article already exists: ${existing.id}`);
        } else {
          const article = await db.article.create({
            data: {
              sourceId: options.sourceId,
              url,
              title,
              rawFilePath: filePath,
              status: "SCRAPED",
            },
          });
          console.log(`[pdf] Created article ${article.id}`);
        }
      }

      await disconnectAll();
    }

    console.log("[pdf] Complete");
  } catch (err) {
    console.error("[pdf] Error:", err);
    await disconnectAll();
    process.exit(1);
  }
}

main();
