# Glossary

| Term | Definition |
|------|------------|
| **MCP** | **Model Context Protocol**. An open standard that enables AI models to interact with external tools and data. >the_collective uses MCP to connect VS Code Copilot with our memory system and Gemini tools. |
| **Bi-encoder** | A type of model that encodes the query and the document independently into vectors. It allows for very fast retrieval (nearest neighbor search) but is less accurate than a cross-encoder. We use this for the first stage of retrieval. |
| **Cross-encoder** | A type of model that takes a query and a document *together* as input and outputs a similarity score. It is much more accurate but computationally expensive. We use this to "rerank" the top results from the bi-encoder. |
| **Reranker** | The second stage of our search pipeline. It takes the top ~50 results from the fast vector search and re-scores them using a cross-encoder to find the absolute best matches. |
| **HNSW** | **Hierarchical Navigable Small World**. An algorithm used for approximate nearest neighbor search. It's the indexing method used by DuckDB to make vector search fast. |
| **Embeddings** | Vector representations of text. We convert your code and memories into lists of numbers (vectors) so we can search them by meaning (semantics) rather than just keywords. |
| **DuckDB** | An in-process SQL OLAP database management system. We use it as our local vector database because it's fast, file-based (no server to manage), and supports vector operations. |
| **Hugging Face Transformers (Node.js)** | The JavaScript/Node.js implementation for running transformer models locally. We use `@huggingface/transformers` for embedders and rerankers; on desktop platforms it relies on `onnxruntime-node` for native inference. |
| **Gemini Bridge** | Our integration with Google's Gemini model. It acts as a "bridge" between the MCP protocol and the Google AI Studio API, providing a second opinion and cognitive diversity. |
