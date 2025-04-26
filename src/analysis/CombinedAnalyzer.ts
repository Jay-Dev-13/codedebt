import { CombinedAnalysis, FileAnalysis, Problem } from './types';

export class CombinedAnalyzer {
    private fileAnalyses: Map<string, FileAnalysis>;

    constructor() {
        this.fileAnalyses = new Map();
    }

    public addFileAnalysis(analysis: FileAnalysis): void {
        this.fileAnalyses.set(analysis.filePath, analysis);
    }

    public getCombinedAnalysis(): CombinedAnalysis {
        const problemTypes = new Map<string, number>();
        const severityDistribution = new Map<string, number>();
        let totalProblems = 0;

        // Process all file analyses
        for (const [filePath, analysis] of this.fileAnalyses) {
            totalProblems += analysis.problems.length;

            // Count problem types and severity distribution
            for (const problem of analysis.problems) {
                // Count problem types
                const typeCount = problemTypes.get(problem.type) || 0;
                problemTypes.set(problem.type, typeCount + 1);

                // Count severity distribution
                const severity = problem.severity || 'unknown';
                const severityCount = severityDistribution.get(severity) || 0;
                severityDistribution.set(severity, severityCount + 1);
            }
        }

        return {
            files: this.fileAnalyses,
            totalProblems,
            problemTypes,
            severityDistribution
        };
    }

    public getUniqueProblems(): Problem[] {
        const uniqueProblems = new Set<string>();
        const problems: Problem[] = [];

        for (const analysis of this.fileAnalyses.values()) {
            for (const problem of analysis.problems) {
                // Create a unique key for each problem
                const key = `${problem.type}:${problem.location.file}:${problem.location.lineNumbers?.join('-')}:${problem.description}`;
                
                if (!uniqueProblems.has(key)) {
                    uniqueProblems.add(key);
                    problems.push(problem);
                }
            }
        }

        return problems;
    }
} 