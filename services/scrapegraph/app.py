"""
ScrapeGraphAI sidecar — SmartScraperGraph + SearchGraph behind FastAPI.
Uses OpenRouter (OpenAI-compatible) as the LLM backend via LiteLLM inside scrapegraphai.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

os.environ.setdefault("SCRAPEGRAPHAI_TELEMETRY_ENABLED", "false")

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("scrapegraph-sidecar")

app = FastAPI(title="Info-Sentry ScrapeGraph Sidecar", version="1.0.0")

DEFAULT_SMART_PROMPT = """Extract from this page:
1. The canonical article or page title.
2. The main author or byline if visible.
3. The publication or update date if visible (ISO 8601 if possible).
4. The full main text content as clean plain text (paragraphs separated by blank lines).
5. A one-sentence summary.

Respond as JSON with keys: title (string), author (string or null), published_at (string or null),
content (string), summary (string)."""


def _base_llm() -> dict[str, Any]:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    model = os.environ.get("SGAI_MODEL", "google/gemini-2.0-flash-001").strip()
    # LiteLLM: route OpenRouter models explicitly
    if model.startswith("openrouter/"):
        litellm_model = model
    elif "/" in model:
        litellm_model = f"openrouter/{model}"
    else:
        litellm_model = model

    return {
        "api_key": api_key,
        "model": litellm_model,
        "base_url": os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        "temperature": float(os.environ.get("SGAI_TEMPERATURE", "0.2")),
    }


def _graph_config(**extra_top_level: Any) -> dict[str, Any]:
    cfg: dict[str, Any] = {
        "llm": _base_llm(),
        "verbose": os.environ.get("SGAI_VERBOSE", "false").lower() == "true",
        "headless": os.environ.get("SGAI_HEADLESS", "true").lower() != "false",
    }
    cfg.update(extra_top_level)
    return cfg


class SmartScrapeRequest(BaseModel):
    url: str = Field(..., description="Page URL to scrape")
    prompt: str | None = Field(None, description="Extraction prompt (JSON-oriented recommended)")


class SearchScrapeRequest(BaseModel):
    topic: str = Field(..., description="High-level topic")
    prompt: str = Field(..., description="What to find across search results")
    max_results: int = Field(5, ge=1, le=15)


class FollowRedirectsRequest(BaseModel):
    url: str


def _run_smart_scrape(url: str, prompt: str) -> dict[str, Any]:
    from scrapegraphai.graphs import SmartScraperGraph

    graph = SmartScraperGraph(
        prompt=prompt,
        source=url,
        config=_graph_config(),
    )
    result = graph.run()
    return result if isinstance(result, dict) else {"raw": result}


def _run_search_scrape(topic: str, prompt: str, max_results: int) -> dict[str, Any]:
    from scrapegraphai.graphs import SearchGraph

    full_prompt = f"Topic: {topic}\n\n{prompt}"
    cfg = _graph_config(max_results=max_results)
    graph = SearchGraph(prompt=full_prompt, config=cfg)
    result = graph.run()
    return result if isinstance(result, dict) else {"raw": result}


def _run_follow_redirects(url: str) -> dict[str, str]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError(f"playwright not available: {e}") from e

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
            )
            page = ctx.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=45_000)
            return {"url": page.url}
        finally:
            browser.close()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/smart-scrape")
async def smart_scrape(body: SmartScrapeRequest) -> dict[str, Any]:
    prompt = body.prompt or DEFAULT_SMART_PROMPT
    try:
        return await asyncio.to_thread(_run_smart_scrape, body.url, prompt)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        log.exception("smart-scrape failed")
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/search-scrape")
async def search_scrape(body: SearchScrapeRequest) -> dict[str, Any]:
    try:
        return await asyncio.to_thread(
            _run_search_scrape, body.topic, body.prompt, body.max_results
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        log.exception("search-scrape failed")
        raise HTTPException(status_code=502, detail=str(e)) from e


@app.post("/follow-redirects")
async def follow_redirects(body: FollowRedirectsRequest) -> dict[str, str]:
    try:
        return await asyncio.to_thread(_run_follow_redirects, body.url)
    except Exception as e:
        log.exception("follow-redirects failed")
        raise HTTPException(status_code=502, detail=str(e)) from e
