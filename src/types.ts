export interface Problem {
	type: string;
	location: {
		file: string;
		lineNumbers?: [number, number];
		functionName?: string;
	};
	description: string;
	severity?: "high" | "medium" | "low" | "unknown";
}

export interface FileAnalysis {
	filePath: string;
	problems: Problem[];
	lineCount: number;
}

export interface CombinedAnalysis {
	files: Map<string, FileAnalysis>;
	totalProblems: number;
	problemTypes: Map<string, number>;
	severityDistribution: Map<string, number>;
}

export interface AnalysisMetrics {
	totalIssues: number;
	issuesPerFile: Map<string, number>;
	issuesPerType: Map<string, number>;
	issuesPerSeverity: Map<string, number>;
	averageIssuesPer1000Lines: number;
	filesWithHighestIssues: Array<{ file: string; count: number }>;
}

export interface CodeDebtScore {
	fileScores: Map<
		string,
		{
			score: number;
			priority: "high" | "medium" | "low";
			factors: {
				issueCount: number;
				severityWeight: number;
				densityScore: number;
				diversityScore: number;
			};
		}
	>;
	projectScore: {
		score: number;
		priority: "high" | "medium" | "low";
		factors: {
			totalIssues: number;
			averageSeverity: number;
			averageDensity: number;
			averageDiversity: number;
		};
	};
}
