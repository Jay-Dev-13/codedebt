import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { glob } from "glob";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { join } from "path";
import { ENVIRONMENT_VARIABLES } from "../env";
import { GEMINI_MODELS } from "../llm/GeminiProvider";
import { Logger } from "../logger";
import { BATCH_SIZE, DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, DEFAULT_TOP_K, MAX_FILE_SIZE } from "./constants";
import { VectorStorage } from "./types";

const logger = new Logger("Vector");

// Internal helpers (move above buildVectorStore)
async function* loadDocumentsStream(directory: string, excludePatterns: string[] = []): AsyncGenerator<string[]> {
	const files = await glob("**/*.{ts,js,tsx,jsx}", {
		cwd: directory,
		ignore: excludePatterns,
		absolute: true,
	});

	logger.info(`Found ${files.length} files to process`);

	let currentBatch: string[] = [];
	for (const file of files) {
		try {
			const stats = await stat(file);
			if (stats.size > MAX_FILE_SIZE) {
				logger.warn(`Skipping ${file}: File too large (${stats.size} bytes)`);
				continue;
			}
			const content = await readFile(file, "utf-8");
			currentBatch.push(content);
			if (currentBatch.length >= BATCH_SIZE) {
				yield currentBatch;
				currentBatch = [];
			}
		} catch (error) {
			logger.error(`Error reading file ${file}:`, error);
		}
	}
	if (currentBatch.length > 0) {
		yield currentBatch;
	}
}

async function splitText(
	text: string,
	chunkSize = DEFAULT_CHUNK_SIZE,
	chunkOverlap = DEFAULT_CHUNK_OVERLAP
): Promise<string[]> {
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize,
		chunkOverlap,
		separators: ["\n\n", "\n", " ", ""],
	});
	return splitter.splitText(text);
}

async function vectorize(texts: string[], apiKey: string): Promise<number[][]> {
	// TODO: Create LLM through LLMFactory
	const embeddings = new GoogleGenerativeAIEmbeddings({
		apiKey,
		modelName: GEMINI_MODELS.GeminiEmbedding001,
	});
	const vectors: number[][] = [];
	for (let i = 0; i < texts.length; i += BATCH_SIZE) {
		const batch = texts.slice(i, i + BATCH_SIZE);
		const batchVectors = await embeddings.embedDocuments(batch);
		vectors.push(...batchVectors);
	}
	return vectors;
}

function createRetriever(
	apiKey: string,
	texts: string[]
): {
	addDocuments: () => Promise<void>;
	retrieve: (query: string, k?: number) => Promise<string[]>;
} {
	// TODO: Create LLM through LLMFactory and share the same instance
	const embeddings = new GoogleGenerativeAIEmbeddings({
		apiKey,
		modelName: GEMINI_MODELS.GeminiEmbedding001,
	});
	const vectorStore = new MemoryVectorStore(embeddings);
	const documents = texts.map((text) => new Document({ pageContent: text }));
	return {
		async addDocuments() {
			await vectorStore.addDocuments(documents);
		},
		async retrieve(query: string, k: number = DEFAULT_TOP_K): Promise<string[]> {
			logger.info("Retrieving documents from vector store");
			const results = await vectorStore.similaritySearch(query, k);
			logger.info(`Retrieved documents: ${results.length}`);
			return results.map((doc: Document) => doc.pageContent);
		},
	};
}

/**
 * Utility functions for vector storage
 */
export async function buildVectorStore(
	directory: string,
	excludePatterns: string[] = []
): Promise<{
	chunks: string[];
	vectors: number[][];
	retrieve: (query: string, k?: number) => Promise<string[]>;
}> {
	const apiKey = ENVIRONMENT_VARIABLES.GEMINI_API_KEY;
	const useCache = ENVIRONMENT_VARIABLES.USE_CACHE;

	if (useCache) {
		logger.info("Loading cached vectors...");
		const cached = await loadCachedVectors(directory, excludePatterns);
		if (cached) {
			const retriever = createRetriever(apiKey, cached.chunks);
			await retriever.addDocuments();
			return {
				chunks: cached.chunks,
				vectors: cached.vectors,
				retrieve: retriever.retrieve,
			};
		} else {
			logger.warn("No cached vectors found.");
		}
	}

	logger.info("Creating new vectors...");

	const chunks: string[] = [];
	const vectors: number[][] = [];

	for await (const batch of loadDocumentsStream(directory, excludePatterns)) {
		const batchChunks = await Promise.all(batch.map((doc) => splitText(doc)));
		const flatChunks = batchChunks.flat();
		chunks.push(...flatChunks);
		const batchVectors = await vectorize(flatChunks, apiKey);
		vectors.push(...batchVectors);
	}

	logger.info(`Total chunks processed: ${chunks.length}`);

	const retriever = createRetriever(apiKey, chunks);
	await retriever.addDocuments();

	// Update cache
	await cacheVectors(directory, excludePatterns, vectors, chunks);
	logger.info("Cached vectors to disk.");

	return {
		chunks,
		vectors,
		retrieve: retriever.retrieve,
	};
}

export async function loadCachedVectors(directory: string, excludePatterns: string[]): Promise<VectorStorage | null> {
	try {
		const cacheDir = join(process.cwd(), "cache", "vectors");
		const cacheFile = join(cacheDir, `${directory.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
		const data = await readFile(cacheFile, "utf-8");
		const storage: VectorStorage = JSON.parse(data);
		if (isValidCache(storage, directory, excludePatterns)) {
			logger.info("Loaded vectors from cache.");
			return storage;
		}
	} catch (error) {
		logger.error("Error loading cached vectors:", error);
		return null;
	}
	logger.warn("No cached vectors found.");
	return null;
}

function isValidCache(storage: VectorStorage, directory: string, excludePatterns: string[]): boolean {
	return (
		storage.metadata.directory === directory &&
		JSON.stringify(storage.metadata.excludePatterns) === JSON.stringify(excludePatterns) &&
		storage.metadata.model === GEMINI_MODELS.GeminiEmbedding001
	);
}

export async function cacheVectors(
	directory: string,
	excludePatterns: string[],
	vectors: number[][],
	chunks: string[]
): Promise<void> {
	const cacheDir = join(process.cwd(), "cache", "vectors");
	await mkdir(cacheDir, { recursive: true });
	const storage: VectorStorage = {
		vectors,
		chunks,
		metadata: {
			directory,
			excludePatterns,
			timestamp: new Date().toISOString(),
			model: GEMINI_MODELS.GeminiEmbedding001,
		},
	};
	const cacheFile = join(cacheDir, `${directory.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
	await writeFile(cacheFile, JSON.stringify(storage, null, 2));
}
