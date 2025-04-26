import { AnalysisMetrics, CombinedAnalysis } from './types';

export class MetricsAnalyzer {
    private combinedAnalysis: CombinedAnalysis;

    constructor(combinedAnalysis: CombinedAnalysis) {
        this.combinedAnalysis = combinedAnalysis;
    }

    public computeMetrics(): AnalysisMetrics {
        const issuesPerFile = new Map<string, number>();
        const issuesPerType = new Map<string, number>();
        const issuesPerSeverity = new Map<string, number>();
        let totalIssues = 0;
        let totalLines = 0;

        // Process all files
        for (const [filePath, analysis] of this.combinedAnalysis.files) {
            const issueCount = analysis.problems.length;
            issuesPerFile.set(filePath, issueCount);
            totalIssues += issueCount;
            totalLines += analysis.lineCount;

            // Count issues by type and severity
            for (const problem of analysis.problems) {
                const typeCount = issuesPerType.get(problem.type) || 0;
                issuesPerType.set(problem.type, typeCount + 1);

                const severity = problem.severity || 'unknown';
                const severityCount = issuesPerSeverity.get(severity) || 0;
                issuesPerSeverity.set(severity, severityCount + 1);
            }
        }

        // Calculate average issues per 1000 lines
        const averageIssuesPer1000Lines = totalLines > 0 
            ? (totalIssues / totalLines) * 1000 
            : 0;

        // Find files with highest issues
        const filesWithHighestIssues = Array.from(issuesPerFile.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([file, count]) => ({ file, count }));

        return {
            totalIssues,
            issuesPerFile,
            issuesPerType,
            issuesPerSeverity,
            averageIssuesPer1000Lines,
            filesWithHighestIssues
        };
    }

    public findProblemClusters(): Map<string, string[]> {
        const clusters = new Map<string, string[]>();

        // Group files by problem types
        for (const [filePath, analysis] of this.combinedAnalysis.files) {
            const problemTypes = new Set(analysis.problems.map(p => p.type));
            
            for (const type of problemTypes) {
                if (!clusters.has(type)) {
                    clusters.set(type, []);
                }
                clusters.get(type)?.push(filePath);
            }
        }

        return clusters;
    }

    public getProblemTypeDistribution(): Map<string, number> {
        return this.combinedAnalysis.problemTypes;
    }

    public getSeverityDistribution(): Map<string, number> {
        return this.combinedAnalysis.severityDistribution;
    }
} 