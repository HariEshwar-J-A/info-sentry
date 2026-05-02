#!/usr/bin/env tsx
import "dotenv/config";
import { getOpenClawDb, disconnectAll } from "./lib/prisma.js";

async function main() {
  const db = getOpenClawDb();
  const summaries = await db.summary.findMany({
    include: { article: { include: { predictions: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log("📊 INFO-SENTRY RESULTS\n");
  console.log(`Found ${summaries.length} summaries\n`);

  let i = 0;
  for (const s of summaries) {
    i++;
    const score = s.sentimentScore ?? 0;
    const sentiment = score > 0.3 ? "🟢 Positive" : score < -0.3 ? "🔴 Negative" : "🟡 Neutral";
    const predictions = s.article.predictions || [];

    console.log(`${"=".repeat(60)}`);
    console.log(`${i}. ${s.article.title}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`   📍 Source: ${s.article.url}`);
    console.log(`   🏷️  Topics: ${s.keyTopics.join(', ')}`);
    console.log(`   📈 Relevance: ${((s.relevanceScore ?? 0) * 100).toFixed(0)}%`);
    console.log(`   😊 Sentiment: ${sentiment} (${score.toFixed(2)})`);
    console.log(`\n   📝 Summary:`);
    const snippet = s.content.length > 1200 ? s.content.substring(0, 1200) + "..." : s.content;
    console.log(`   ${snippet.replace(/\n/g, '\n   ')}`);

    if (predictions.length > 0) {
      console.log(`\n   🔮 Predictions (${predictions.length}):`);
      for (const p of predictions) {
        const emoji = p.confidence > 0.7 ? "🎯" : p.confidence > 0.5 ? "📊" : "💭";
        console.log(`      ${emoji} [${(p.confidence * 100).toFixed(0)}%] ${p.timeHorizon || 'N/A'}`);
        console.log(`         ${p.content.substring(0, 200).replace(/\n/g, '\n         ')}...`);
        console.log();
      }
    } else {
      console.log("\n   🔮 Predictions: None generated");
    }
    console.log();
  }
  
  await disconnectAll();
}

main().catch(console.error);
