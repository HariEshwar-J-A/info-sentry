"""
ScrapeGraphAI sidecar — SmartScraperGraph + SearchGraph behind FastAPI.

OpenRouter is wired via LangChain ChatOpenAI + custom base_url (OpenAI-compatible API).
ScrapeGraphAI must receive an llm **model_instance** (never a bare `model` string like
`openrouter/...`) — recent library versions split on "/" and reject provider `openrouter`.
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

_llm_patch_installed = False


def _patch_scrapegraph_abstract_graph_llm() -> None:
    """
    Upstream AbstractGraph may merge llm defaults or parse `model` before honoring
    `model_instance`, yielding Provider openrouter is not supported for OpenRouter URLs.
    Always short-circuit when we pass a LangChain chat model explicitly.
    """
    global _llm_patch_installed
    if _llm_patch_installed:
        return

    from scrapegraphai.graphs.abstract_graph import AbstractGraph

    _orig = AbstractGraph._create_llm

    def _create_llm_infosentry(self: Any, llm_config: dict[str, Any]) -> Any:
        inst = llm_config.get("model_instance")
        if inst is not None:
            try:
                tokens = llm_config["model_tokens"]
            except KeyError as exc:
                raise KeyError("model_tokens not specified") from exc
            self.model_token = tokens
            return inst
        return _orig(self, llm_config)

    AbstractGraph._create_llm = _create_llm_infosentry  # type: ignore[method-assign]
    _llm_patch_installed = True
    log.info("Patched scrapegraphai AbstractGraph._create_llm for OpenRouter model_instance")


def _normalize_openrouter_model_id(raw: str) -> str:
    """Strip repeated `openrouter/` prefixes so OpenRouter model IDs stay provider-neutral."""
    model_id = raw.strip()
    lowered_prefix = "openrouter/"
    while model_id.lower().startswith(lowered_prefix):
        model_id = model_id[len(lowered_prefix) :].lstrip()
    return model_id


def _scrapegraphai_version() -> str:
    try:
        from importlib.metadata import version as pkg_version

        return pkg_version("scrapegraphai")
    except Exception:
        return "unknown"

DEFAULT_SMART_PROMPT = """Extract from this page:
1. The canonical article or page title.
2. The main author or byline if visible.
3. The publication or update date if visible (ISO 8601 if possible).
4. The full main text content as clean plain text (paragraphs separated by blank lines).
5. A one-sentence summary.

Respond as JSON with keys: title (string), author (string or null), published_at (string or null),
content (string), summary (string)."""


def _base_llm() -> dict[str, Any]:
    """LangChain chat model + tokens — passed to ScrapeGraphAI only via model_instance."""
    from langchain_core.language_models.chat_models import BaseChatModel
    from langchain_openai import ChatOpenAI

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    raw_model = os.environ.get("SGAI_MODEL", "google/gemini-2.0-flash-001")
    model_id = _normalize_openrouter_model_id(raw_model)

    base_url = os.environ.get("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
    temperature = float(os.environ.get("SGAI_TEMPERATURE", "0.2"))
    timeout_s = float(os.environ.get("SGAI_CHAT_TIMEOUT_S", "180"))

    llm = ChatOpenAI(
        model=model_id,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        timeout=timeout_s,
    )

    if not isinstance(llm, BaseChatModel):
        raise TypeError("ChatOpenAI instance expected for model_instance")

    model_tokens = int(os.environ.get("SGAI_MODEL_TOKENS", "131072"))

    return {
        "model_instance": llm,
        "model_tokens": model_tokens,
    }


def _graph_llm_dict() -> dict[str, Any]:
    """Only keys consumed by AbstractGraph's model_instance branch — avoids stray `model` strings."""
    base = _base_llm()
    return {"model_instance": base["model_instance"], "model_tokens": base["model_tokens"]}


def _graph_config(**extra_top_level: Any) -> dict[str, Any]:
    cfg: dict[str, Any] = {
        "llm": _graph_llm_dict(),
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
    _patch_scrapegraph_abstract_graph_llm()
    from scrapegraphai.graphs import SmartScraperGraph

    graph = SmartScraperGraph(
        prompt=prompt,
        source=url,
        config=_graph_config(),
    )
    result = graph.run()
    return result if isinstance(result, dict) else {"raw": result}


def _run_search_scrape(topic: str, prompt: str, max_results: int) -> dict[str, Any]:
    _patch_scrapegraph_abstract_graph_llm()
    from scrapegraphai.graphs import SearchGraph

    full_prompt = f"Topic: {topic}\n\n{prompt}"
    cfg = _graph_config(max_results=max_results)
    # Constructor is positional: SearchGraph(prompt, config[, schema])
    graph = SearchGraph(full_prompt, cfg)
    answer = graph.run()
    urls = graph.get_considered_urls()
    return {"answer": answer, "considered_urls": urls}


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


@app.on_event("startup")
def _log_build_info() -> None:
    _patch_scrapegraph_abstract_graph_llm()
    raw = os.environ.get("SGAI_MODEL", "google/gemini-2.0-flash-001")
    log.info(
        "scrapegraphai %s — SGAI_MODEL %r → ChatOpenAI model %r",
        _scrapegraphai_version(),
        raw.strip(),
        _normalize_openrouter_model_id(raw),
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "scrapegraphai": _scrapegraphai_version()}


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
