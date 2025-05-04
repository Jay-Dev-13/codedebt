/*
    This file is responsible for computing the metrics of the code debt analysis.
    Any kind of metric can be computed here.

    This does not need to be a separate agent.
    It can be part of the analysis agent.

    Also, we need to analyze the folder structure of the provided codebase.
    This will help us to understand the codebase and the dependencies between the files.
*/

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { AnalysisMetrics, FileAnalysis, Problem } from "../types";

interface FolderStructure {
	name: string;
	type: "file" | "directory";
	children?: FolderStructure[];
	metrics?: {
		totalFiles: number;
		totalIssues: number;
		issuesByType: Record<string, number>;
		issuesBySeverity: Record<string, number>;
	};
}

export class MetricsCompute {
	private baseDir: string;
	private resultsDir: string;

	constructor(baseDir: string = "results/analysis") {
		this.baseDir = baseDir;
		this.resultsDir = join(this.baseDir, "results");
	}

	private async getAnalysisResults(): Promise<Record<string, FileAnalysis>> {
		try {
			const files = await readdir(this.resultsDir);
			const results: Record<string, FileAnalysis> = {};

			for (const file of files) {
				if (file.endsWith(".json")) {
					const content = await readFile(join(this.resultsDir, file), "utf-8");
					const rawAnalysis = JSON.parse(content);

					// Convert the raw analysis into the expected FileAnalysis format
					const analysis: FileAnalysis = {
						filePath: rawAnalysis.filePath,
						problems: this.parseProblemsFromAnalysis(rawAnalysis.analysis),
						lineCount: this.countLines(rawAnalysis.analysis),
					};

					results[analysis.filePath] = analysis;
				}
			}

			return results;
		} catch (error) {
			console.error("Error reading analysis results:", error);
			return {};
		}
	}

	private parseProblemsFromAnalysis(analysis: string | { error: string }): Problem[] {
		if (typeof analysis !== "string") {
			return [];
		}

		const problems: Problem[] = [];
		const lines = analysis.split("\n");
		let currentProblem: Partial<Problem> = {};

		for (const line of lines) {
			if (line.includes("Issue:")) {
				if (Object.keys(currentProblem).length > 0) {
					problems.push(currentProblem as Problem);
				}
				currentProblem = {
					type: line.split("Issue:")[1].trim(),
					location: { file: "" },
					description: "",
				};
			} else if (line.includes("Severity:")) {
				currentProblem.severity = line.split("Severity:")[1].trim() as "high" | "medium" | "low" | "unknown";
			} else if (line.includes("Location:")) {
				const location = line.split("Location:")[1].trim();
				currentProblem.location = {
					file: location,
					lineNumbers: undefined,
					functionName: undefined,
				};
			} else if (line.includes("Description:")) {
				currentProblem.description = line.split("Description:")[1].trim();
			}
		}

		// Add the last problem if it exists
		if (Object.keys(currentProblem).length > 0) {
			problems.push(currentProblem as Problem);
		}

		return problems;
	}

	private countLines(analysis: string | { error: string }): number {
		if (typeof analysis !== "string") {
			return 0;
		}
		return analysis.split("\n").length;
	}

	private computeIssueDistribution(analysisResults: Record<string, FileAnalysis>): {
		issuesPerType: Map<string, number>;
		issuesPerSeverity: Map<string, number>;
	} {
		const issuesPerType = new Map<string, number>();
		const issuesPerSeverity = new Map<string, number>();

		Object.values(analysisResults).forEach((analysis) => {
			if (analysis.problems) {
				analysis.problems.forEach((problem) => {
					// Count by type
					const typeCount = issuesPerType.get(problem.type) || 0;
					issuesPerType.set(problem.type, typeCount + 1);

					// Count by severity
					const severity = problem.severity || "unknown";
					const severityCount = issuesPerSeverity.get(severity) || 0;
					issuesPerSeverity.set(severity, severityCount + 1);
				});
			}
		});

		return { issuesPerType, issuesPerSeverity };
	}

	private computeFileMetrics(analysisResults: Record<string, FileAnalysis>): Map<string, number> {
		const issuesPerFile = new Map<string, number>();

		Object.entries(analysisResults).forEach(([filePath, analysis]) => {
			issuesPerFile.set(filePath, analysis.problems?.length || 0);
		});

		return issuesPerFile;
	}

	private async analyzeFolderStructure(directory: string): Promise<FolderStructure> {
		const structure: FolderStructure = {
			name: directory,
			type: "directory",
			children: [],
			metrics: {
				totalFiles: 0,
				totalIssues: 0,
				issuesByType: {},
				issuesBySeverity: {},
			},
		};

		const entries = await readdir(directory, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isDirectory()) {
				const childStructure = await this.analyzeFolderStructure(join(directory, entry.name));
				structure.children?.push(childStructure);

				// Aggregate metrics from children
				if (childStructure.metrics) {
					structure.metrics!.totalFiles += childStructure.metrics.totalFiles;
					structure.metrics!.totalIssues += childStructure.metrics.totalIssues;

					// Merge issue type counts
					Object.entries(childStructure.metrics.issuesByType).forEach(([type, count]) => {
						structure.metrics!.issuesByType[type] = (structure.metrics!.issuesByType[type] || 0) + count;
					});

					// Merge severity counts
					Object.entries(childStructure.metrics.issuesBySeverity).forEach(([severity, count]) => {
						structure.metrics!.issuesBySeverity[severity] =
							(structure.metrics!.issuesBySeverity[severity] || 0) + count;
					});
				}
			} else if (entry.isFile() && entry.name.endsWith(".json")) {
				const filePath = join(directory, entry.name);
				const content = await readFile(filePath, "utf-8");
				const rawAnalysis = JSON.parse(content);
				const analysis: FileAnalysis = {
					filePath: rawAnalysis.filePath,
					problems: this.parseProblemsFromAnalysis(rawAnalysis.analysis),
					lineCount: this.countLines(rawAnalysis.analysis),
				};

				structure.metrics!.totalFiles++;
				structure.metrics!.totalIssues += analysis.problems.length;

				// Count issues by type and severity
				analysis.problems.forEach((problem) => {
					structure.metrics!.issuesByType[problem.type] =
						(structure.metrics!.issuesByType[problem.type] || 0) + 1;
					const severity = problem.severity || "unknown";
					structure.metrics!.issuesBySeverity[severity] =
						(structure.metrics!.issuesBySeverity[severity] || 0) + 1;
				});
			}
		}

		return structure;
	}

	public async computeMetrics(): Promise<AnalysisMetrics & { folderStructure: FolderStructure }> {
		console.info("Computing metrics...");
		const analysisResults = await this.getAnalysisResults();

		// Compute different types of metrics
		const { issuesPerType, issuesPerSeverity } = this.computeIssueDistribution(analysisResults);
		console.info("Issues categorized by type and severity");
		const issuesPerFile = this.computeFileMetrics(analysisResults);
		console.info("Issues categorized by file");

		// Calculate total issues
		const totalIssues = Array.from(issuesPerFile.values()).reduce((sum, count) => sum + count, 0);
		console.info("Total issues", totalIssues);

		// Calculate average issues per 1000 lines
		const totalLines = Object.values(analysisResults).reduce((sum, analysis) => sum + analysis.lineCount, 0);
		const averageIssuesPer1000Lines = (totalIssues / totalLines) * 1000;
		console.info("Average issues per 1000 lines", averageIssuesPer1000Lines);

		// Get files with highest issues
		const filesWithHighestIssues = Array.from(issuesPerFile.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([file, count]) => ({ file, count }));
		console.info("Files with highest issues", filesWithHighestIssues);

		// Analyze folder structure
		const folderStructure = await this.analyzeFolderStructure(this.resultsDir);
		console.info("Folder structure", folderStructure);

		return {
			totalIssues,
			issuesPerFile,
			issuesPerType,
			issuesPerSeverity,
			averageIssuesPer1000Lines,
			filesWithHighestIssues,
			folderStructure,
		};
	}
}
