// TODO: Create a document loader that can load all the code files in the given directory.

// TODO: Implement text splitter that can split the code files into chunks.

// TODO: Implement a vectorizer that can vectorize the code files and embeddings.

// TODO: Implement a retriever that can retrieve the most relevant chunks from the database.

import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { mkdir, readFile, writeFile } from "fs/promises";
import { glob } from "glob";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { join } from "path";
import { GEMINI_MODELS } from "../llm/GeminiProvider";

interface VectorStorage {
	vectors: number[][];
	chunks: string[];
	metadata: {
		directory: string;
		excludePatterns: string[];
		timestamp: string;
		model: string;
	};
}

export interface DocumentAnalysis {
	vectors: number[][];
	chunks: string[];
	retriever: CodeRetriever;
}

// Add new interfaces for validation and fallback
interface ValidationResult {
	isValid: boolean;
	errors?: string[];
	warnings?: string[];
}

interface FallbackStrategy {
	name: string;
	priority: number;
	execute: () => Promise<DocumentAnalysis>;
}

// Add validation class
export class RAGValidator {
	static validateDocumentAnalysis(analysis: DocumentAnalysis): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate vectors
		if (!analysis.vectors || analysis.vectors.length === 0) {
			errors.push("No vectors generated");
		} else {
			// Check vector dimensions
			const dimensions = analysis.vectors[0].length;
			if (dimensions !== 768) {
				// Expected dimension for Gemini embeddings
				warnings.push(`Unexpected vector dimensions: ${dimensions}`);
			}
		}

		// Validate chunks
		if (!analysis.chunks || analysis.chunks.length === 0) {
			errors.push("No text chunks generated");
		} else {
			// Check chunk quality
			const emptyChunks = analysis.chunks.filter((chunk) => !chunk.trim());
			if (emptyChunks.length > 0) {
				warnings.push(`Found ${emptyChunks.length} empty chunks`);
			}
		}

		// Validate retriever
		if (!analysis.retriever) {
			errors.push("No retriever initialized");
		}

		return {
			isValid: errors.length === 0,
			errors: errors.length > 0 ? errors : undefined,
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	}
}

// Add fallback strategies
export class RAGFallbackManager {
	private strategies: FallbackStrategy[] = [];

	constructor() {
		this.initializeStrategies();
	}

	private initializeStrategies() {
		this.strategies = [
			{
				name: "cached_analysis",
				priority: 1,
				execute: async () => {
					// Try to load from cache with different parameters
					const cacheDir = join(process.cwd(), "cache", "vectors");
					const files = await glob("*.json", { cwd: cacheDir });
					if (files.length > 0) {
						const latestCache = files.sort().pop();
						const data = await readFile(join(cacheDir, latestCache!), "utf-8");
						const storage: VectorStorage = JSON.parse(data);
						const retriever = new CodeRetriever();
						await retriever.addDocuments(storage.chunks);
						return {
							vectors: storage.vectors,
							chunks: storage.chunks,
							retriever,
						};
					}
					throw new Error("No cache available");
				},
			},
			{
				name: "reduced_chunk_size",
				priority: 2,
				execute: async () => {
					// Try with smaller chunk size
					const loader = new CodeDocumentLoader();
					const documents = await loader.loadDocuments(process.cwd(), ["node_modules"]);
					const splitter = new CodeTextSplitter(500, 100); // Reduced chunk size
					const chunks = await splitter.splitText(documents.join("\n"));
					const vectorizer = new CodeVectorizer();
					const vectors = await vectorizer.vectorize(chunks);
					const retriever = new CodeRetriever();
					await retriever.addDocuments(chunks);
					return { vectors, chunks, retriever };
				},
			},
		];
	}

	async executeFallback(error: Error): Promise<DocumentAnalysis> {
		for (const strategy of this.strategies.sort((a, b) => a.priority - b.priority)) {
			try {
				console.log(`Attempting fallback strategy: ${strategy.name}`);
				const result = await strategy.execute();
				const validation = RAGValidator.validateDocumentAnalysis(result);
				if (validation.isValid) {
					return result;
				}
			} catch (e) {
				console.warn(`Fallback strategy ${strategy.name} failed:`, e);
			}
		}
		throw new Error("All fallback strategies failed");
	}
}

// Modify the loadDocuments function to use validation and fallbacks
export async function loadDocuments(directory: string, excludePatterns: string[] = []): Promise<DocumentAnalysis> {
	const fallbackManager = new RAGFallbackManager();
	const maxRetries = 3;
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			// Check if we have cached vectors
			const cachedData = await loadCachedVectors(directory, excludePatterns);
			if (cachedData) {
				const retriever = new CodeRetriever();
				await retriever.addDocuments(cachedData.chunks);
				const result = {
					vectors: cachedData.vectors,
					chunks: cachedData.chunks,
					retriever,
				};

				// Validate cached results
				const validation = RAGValidator.validateDocumentAnalysis(result);
				if (validation.isValid) {
					return result;
				}
				console.warn("Cached results validation failed:", validation.warnings);
			}

			const loader = new CodeDocumentLoader();
			const documents = await loader.loadDocuments(directory, excludePatterns);

			const splitter = new CodeTextSplitter();
			const chunks = await splitter.splitText(documents.join("\n"));

			const vectorizer = new CodeVectorizer();
			const vectors = await vectorizer.vectorize(chunks);

			// Cache the vectors
			await cacheVectors(directory, excludePatterns, vectors, chunks);

			// Create retriever and add documents
			const retriever = new CodeRetriever();
			await retriever.addDocuments(chunks);

			const result = {
				vectors,
				chunks,
				retriever,
			};

			// Validate the results
			const validation = RAGValidator.validateDocumentAnalysis(result);
			if (validation.isValid) {
				return result;
			}

			throw new Error(`Validation failed: ${validation.errors?.join(", ")}`);
		} catch (error) {
			lastError = error as Error;
			console.warn(`Attempt ${attempt} failed:`, error);

			if (attempt === maxRetries) {
				// Try fallback strategies
				try {
					return await fallbackManager.executeFallback(lastError);
				} catch (fallbackError: unknown) {
					const errorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
					throw new Error(
						`All attempts failed. Last error: ${lastError.message}. Fallback error: ${errorMessage}`
					);
				}
			}

			// Wait before retrying
			await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
		}
	}

	throw lastError || new Error("Failed to load documents");
}

async function loadCachedVectors(directory: string, excludePatterns: string[]): Promise<VectorStorage | null> {
	try {
		const cacheDir = join(process.cwd(), "cache", "vectors");
		const cacheFile = join(cacheDir, `${directory.replace(/[^a-zA-Z0-9]/g, "_")}.json`);

		const data = await readFile(cacheFile, "utf-8");
		const storage: VectorStorage = JSON.parse(data);

		// Check if the cache is still valid
		if (
			storage.metadata.directory === directory &&
			JSON.stringify(storage.metadata.excludePatterns) === JSON.stringify(excludePatterns) &&
			storage.metadata.model === GEMINI_MODELS.GeminiEmbeddingExp0307
		) {
			return storage;
		}
	} catch (error) {
		// If file doesn't exist or there's an error, return null
		return null;
	}
	return null;
}

async function cacheVectors(
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
			model: GEMINI_MODELS.GeminiEmbeddingExp0307,
		},
	};

	const cacheFile = join(cacheDir, `${directory.replace(/[^a-zA-Z0-9]/g, "_")}.json`);
	await writeFile(cacheFile, JSON.stringify(storage, null, 2));
}

// Document loader for code files
export class CodeDocumentLoader {
	async loadDocuments(directory: string, excludePatterns: string[] = []): Promise<string[]> {
		const files = await glob("**/*.{ts,js,tsx,jsx}", {
			cwd: directory,
			ignore: excludePatterns,
			absolute: true,
		});

		const documents: string[] = [];
		for (const file of files) {
			console.log("File being loaded:", file);
			const content = await readFile(file, "utf-8");
			documents.push(content);
		}

		return documents;
	}
}

// Text splitter for code files
export class CodeTextSplitter {
	private splitter: RecursiveCharacterTextSplitter;

	constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
		this.splitter = new RecursiveCharacterTextSplitter({
			chunkSize,
			chunkOverlap,
			separators: ["\n\n", "\n", " ", ""],
		});
	}

	async splitText(text: string): Promise<string[]> {
		return this.splitter.splitText(text);
	}
}

// Vectorizer for code chunks
export class CodeVectorizer {
	private embeddings: GoogleGenerativeAIEmbeddings;

	constructor(apiKey: string = process.env.GEMINI_API_KEY || "") {
		if (!apiKey) {
			throw new Error("Gemini API key is required");
		}
		this.embeddings = new GoogleGenerativeAIEmbeddings({
			apiKey,
			modelName: GEMINI_MODELS.GeminiEmbeddingExp0307,
		});
	}

	async vectorize(texts: string[]): Promise<number[][]> {
		return this.embeddings.embedDocuments(texts);
	}
}

// Retriever for code chunks
export class CodeRetriever {
	private vectorStore: MemoryVectorStore;
	private embeddings: GoogleGenerativeAIEmbeddings;

	constructor(apiKey: string = process.env.GEMINI_API_KEY || "") {
		if (!apiKey) {
			throw new Error("Gemini API key is required");
		}
		this.embeddings = new GoogleGenerativeAIEmbeddings({
			apiKey,
			modelName: GEMINI_MODELS.GeminiEmbeddingExp0307,
		});
		this.vectorStore = new MemoryVectorStore(this.embeddings);
	}

	async addDocuments(texts: string[]): Promise<void> {
		await this.vectorStore.addDocuments(texts.map((text) => new Document({ pageContent: text })));
	}

	async retrieve(query: string, k: number = 4): Promise<string[]> {
		console.log("Retrieving documents from vector store");
		const results = await this.vectorStore.similaritySearch(query, k);
		console.log("Retrieved documents:", results.length);
		return results.map((doc: Document) => doc.pageContent);
	}
}
