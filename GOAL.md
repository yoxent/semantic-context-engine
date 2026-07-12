# Semantic Context Engine (SCE)

## Vision

Build **Semantic Context Engine (SCE)**, a production-quality, local-first semantic retrieval framework designed to provide intelligent context for AI coding agents.

SCE is **NOT** a vector database.

A vector database is only one interchangeable implementation detail within the framework.

The purpose of SCE is to help AI agents understand large codebases by intelligently retrieving the most relevant context while minimizing LLM token usage.

The framework should support AI agents such as:

- Pi Harness
- OpenCode
- Cursor
- Claude Code
- Codex
- Custom agentic workflows

SCE should be modular, extensible, provider-agnostic, and designed for long-term maintenance.

=========================================================
CORE PHILOSOPHY
=========================================================

Think of SCE as the "Context Layer" between an AI agent and a repository.

Instead of immediately sending large portions of a repository to an LLM, SCE should determine the best retrieval strategy, gather only the most relevant context, rank it, and return a concise result.

The objective is to maximize answer quality while minimizing cost, latency, and context size.

=========================================================
HIGH LEVEL PIPELINE
=========================================================

User Question

↓

Intent Analysis

↓

Determine Retrieval Strategy

↓

Keyword Search
AST Search
Semantic Search
Hybrid Search

↓

Merge Results

↓

Rank Results

↓

Read Only Necessary Context

↓

Return Context

↓

AI Agent

↓

Final Response

=========================================================
PRIMARY OBJECTIVES
=========================================================

The framework must support:

• Local-first operation

• Exact search

• Symbol search

• Semantic search

• Hybrid retrieval

• Intelligent ranking

• Incremental indexing

• Efficient chunking

• Multiple repositories

• Multiple embedding providers

• Multiple vector storage implementations

• Future multimodal indexing

Everything should run locally by default.

No cloud services should be required.

=========================================================
DESIGN PRINCIPLES
=========================================================

Follow:

SOLID

Clean Architecture

Dependency Injection

Interface-first design

Plugin architecture

Composition over inheritance

High cohesion

Low coupling

Testability

Every major subsystem should be independently replaceable.

=========================================================
PROJECT MODULES
=========================================================

Core

Search Interfaces

Embedding Interfaces

Storage Interfaces

Chunk Interfaces

Ranking Interfaces

Configuration

Logging

Dependency Injection

---------------------------------------------------------

Indexing

Repository Discovery

File Discovery

File Watching

Incremental Indexing

Metadata Extraction

Chunk Generation

Language Detection

---------------------------------------------------------

Parsing

Tree-sitter

Roslyn (C#)

TypeScript AST

Markdown Parser

JSON Parser

YAML Parser

---------------------------------------------------------

Retrieval

Keyword Search

ripgrep

AST Search

Semantic Search

Hybrid Search

Context Assembly

---------------------------------------------------------

Embedding

Embedding Provider Interface

LM Studio

Ollama

OpenAI

Future Providers

---------------------------------------------------------

Storage

Metadata Storage

Embedding Storage

Search Index

Cache

---------------------------------------------------------

Ranking

Vector Similarity

Keyword Score

Symbol Score

Filename Score

Path Score

Recency Score

Popularity Score

Optional Cross Encoder

=========================================================
SUPPORTED FILE TYPES
=========================================================

Initial support

C#

C++

TypeScript

JavaScript

Markdown

JSON

YAML

Future support

Python

Go

Rust

HTML

CSS

XML

=========================================================
SEARCH MODES
=========================================================

1.

Keyword Search

Use ripgrep.

Best for

Identifiers

Class names

Methods

Constants

Strings

---------------------------------------------------------

2.

AST Search

Use language-specific parsers.

Best for

Inheritance

References

Call hierarchy

Method lookup

Type lookup

Navigation

---------------------------------------------------------

3.

Semantic Search

Use embeddings.

Best for

Natural language questions

Architecture

Patterns

Implementation concepts

Design discussions

---------------------------------------------------------

4.

Hybrid Search

Combine

Keyword

AST

Semantic

Merge

Rank

Return best context

=========================================================
INTENT ROUTING
=========================================================

The engine should automatically decide which retrieval strategy is appropriate.

Examples

"Find PlayerController"

↓

Keyword Search

------------------------------------

"Where is SaveGame()"

↓

AST Search

------------------------------------

"How is inventory persisted?"

↓

Semantic Search

------------------------------------

"How do cards flip?"

↓

Hybrid Search

=========================================================
CHUNKING
=========================================================

Never embed entire files.

Chunk intelligently.

Preferred chunk types

Namespace

Class

Interface

Struct

Enum

Method

Function

Markdown Heading

Markdown Section

Documentation Block

Each chunk stores

Unique ID

Repository

Relative Path

Language

Namespace

Class

Method

Start Line

End Line

Git Commit Hash

File Hash

Timestamp

Chunk Text

Embedding

=========================================================
EMBEDDING SYSTEM
=========================================================

Embeddings should be provider-independent.

Create

IEmbeddingProvider

Implementations

LM Studio

Ollama

OpenAI

Future Providers

The embedding provider should only generate embeddings.

It should know nothing about storage.

=========================================================
VECTOR STORAGE
=========================================================

The vector store should be completely abstracted.

Create

IVectorStore

Possible implementations

BinaryVectorStore

SQLiteVectorStore

LanceDBVectorStore

FAISSVectorStore

QdrantVectorStore

ChromaVectorStore

InMemoryVectorStore

Swapping implementations should require no code changes elsewhere.

=========================================================
LOCAL STORAGE
=========================================================

Everything should work without a server.

Suggested structure

semantic/

    metadata.sqlite

    embeddings.bin

    vector.index

    cache/

    config.json

Metadata

Store in SQLite

Embeddings

Store in binary format

Search index

Store independently

This allows replacing the vector storage implementation later.

=========================================================
INCREMENTAL INDEXING
=========================================================

Never rebuild an entire repository.

Track

Added files

Modified files

Deleted files

Only regenerate affected chunks.

Reuse cached embeddings whenever possible.

=========================================================
RANKING
=========================================================

Ranking should combine

Embedding Similarity

Keyword Match

AST Match

Filename

Directory

Git Recency

Popularity

Optional reranker

The final result should be ranked before being returned.

=========================================================
PUBLIC API
=========================================================

IndexRepository()

UpdateRepository()

DeleteRepository()

Search()

SemanticSearch()

KeywordSearch()

ASTSearch()

HybridSearch()

GetChunk()

GetFile()

Statistics()

Optimize()

=========================================================
CONFIGURATION
=========================================================

Support JSON configuration.

Embedding Provider

Vector Store

Chunk Size

Chunk Overlap

Ignored Directories

Ignored Extensions

Search Limits

Ranking Weights

Cache Settings

=========================================================
IGNORE DIRECTORIES
=========================================================

.git

node_modules

Library

Temp

Build

obj

bin

DerivedData

=========================================================
LOGGING
=========================================================

Provide structured logging.

Track

Repositories Indexed

Files Indexed

Chunks Generated

Embedding Time

Search Time

Ranking Time

Cache Hits

Cache Misses

Errors

=========================================================
TESTING
=========================================================

Every subsystem should include

Unit Tests

Integration Tests

Performance Benchmarks

Mock Embedding Provider

Mock Vector Store

=========================================================
PERFORMANCE TARGETS
=========================================================

Design for

Small

1,000 files

Medium

10,000 files

Large

100,000+ files

Optimize

Memory

Indexing

Search latency

Incremental updates

=========================================================
FUTURE FEATURES
=========================================================

Leave extension points for

Image embeddings

PDF indexing

Git history indexing

Issue tracker indexing

Slack indexing

Discord indexing

Notion indexing

Confluence indexing

API documentation indexing

Cross-repository search

Knowledge graphs

Long-term agent memory

=========================================================
OUTPUT REQUIREMENTS
=========================================================

Do NOT immediately generate implementation code.

Instead work through the project in phases.

Phase 1

Review the entire specification.

Identify architectural issues.

Suggest improvements.

Ask clarification questions if necessary.

---------------------------------------------------------

Phase 2

Design the complete architecture.

Produce component diagrams.

Describe responsibilities.

---------------------------------------------------------

Phase 3

Design the folder structure.

Explain why each folder exists.

---------------------------------------------------------

Phase 4

Define all interfaces.

Explain each abstraction.

---------------------------------------------------------

Phase 5

Design storage.

Metadata format

Embedding format

Index format

Caching

---------------------------------------------------------

Phase 6

Design retrieval pipelines.

Keyword

AST

Semantic

Hybrid

---------------------------------------------------------

Phase 7

Design chunking.

Compare multiple chunking strategies.

Choose the most maintainable approach.

---------------------------------------------------------

Phase 8

Design ranking.

Explain scoring and weighting.

---------------------------------------------------------

Phase 9

Design incremental indexing.

---------------------------------------------------------

Phase 10

Produce a complete implementation roadmap.

Break the project into small, independently testable milestones.

For every milestone:

- Define the objective.
- List deliverables.
- Define acceptance criteria.
- Identify dependencies.
- Recommend unit tests and integration tests.

=========================================================
FINAL GOAL
=========================================================

The end result should be a reusable, open-source Semantic Context Engine that serves as the retrieval layer for AI coding agents.

It should remain independent of any specific LLM, embedding model, vector database, or coding agent, allowing each to be swapped through well-defined interfaces without affecting the rest of the system.

Don't build anything from scratch. Reuse proven libraries for the low-level components.

Ideal Structure
├── Indexer
├── Chunker
├── Parser
├── Embedding
├── Vector Store
├── Grep Search
├── AST Search
├── Hybrid Search
├── Ranker
├── Cache
├── Incremental Indexer
└── Agent API