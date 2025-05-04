export interface VectorStorage {
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
	retriever: {
		retrieve: (query: string, k?: number) => Promise<string[]>;
	};
}

// Add new interfaces for validation and fallback
export interface ValidationResult {
	isValid: boolean;
	errors?: string[];
	warnings?: string[];
}

export interface Validator {
	validate(analysis: DocumentAnalysis): ValidationResult;
}

export interface FallbackStrategy {
	name: string;
	priority: number;
	execute(): Promise<DocumentAnalysis>;
}
