# Semantic Context Engine

Semantic Context Engine (SCE) is a local-first semantic retrieval framework designed for AI coding agents.

Instead of relying solely on keyword searches or vector databases, SCE combines multiple retrieval strategies—including exact search, AST/symbol analysis, semantic embeddings, hybrid ranking, and incremental indexing—to provide AI agents with the most relevant project context while minimizing LLM token usage.

SCE is designed to be modular, extensible, and provider-agnostic. Embedding models, vector stores, parsers, rerankers, and search strategies can all be replaced without affecting the rest of the system.

The project is intended to serve as the retrieval layer for AI coding assistants such as Pi Harness, OpenCode, Cursor, Claude Code, or custom agentic workflows.
