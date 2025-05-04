import { z } from "zod";

// Schema for code debt analysis output
export const CodeDebtAnalysisSchema = z.object({
	totalIssues: z.number(),
	issuesBySeverity: z.record(z.string(), z.object({ score: z.number(), issues: z.array(z.string()) })),
	issues: z.array(
		z.object({
			type: z.string(),
			frequency: z.number(),
			severity: z.number().min(1).max(10),
			affectedComponents: z.array(z.string()),
			confidence: z.number().min(1).max(10),
		})
	),
});

// Schema for code debt summary output
export const CodeDebtSummarySchema = z.string();

// Schema for RAG output validation
export const RAGOutputSchema = z.object({
	vectors: z.array(z.array(z.number())),
	chunks: z.array(z.string()),
	retriever: z.any(), // Since this is a class instance, we'll validate it separately
});

// Types derived from schemas
export type CodeDebtAnalysis = z.infer<typeof CodeDebtAnalysisSchema>;
export type CodeDebtSummary = z.infer<typeof CodeDebtSummarySchema>;
export type RAGOutput = z.infer<typeof RAGOutputSchema>;
