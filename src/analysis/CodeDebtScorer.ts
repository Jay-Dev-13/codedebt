import { AnalysisMetrics, CodeDebtScore, CombinedAnalysis } from './types';

export class CodeDebtScorer {
    private combinedAnalysis: CombinedAnalysis;
    private metrics: AnalysisMetrics;

    constructor(combinedAnalysis: CombinedAnalysis, metrics: AnalysisMetrics) {
        this.combinedAnalysis = combinedAnalysis;
        this.metrics = metrics;
    }

    public computeScores(): CodeDebtScore {
        const fileScores = new Map<string, {
            score: number;
            priority: 'high' | 'medium' | 'low';
            factors: {
                issueCount: number;
                severityWeight: number;
                densityScore: number;
                diversityScore: number;
            };
        }>();

        // Compute scores for each file
        for (const [filePath, analysis] of this.combinedAnalysis.files) {
            const score = this.computeFileScore(filePath, analysis);
            fileScores.set(filePath, score);
        }

        // Compute project score
        const projectScore = this.computeProjectScore(fileScores);

        return {
            fileScores,
            projectScore
        };
    }

    private computeFileScore(filePath: string, analysis: any): {
        score: number;
        priority: 'high' | 'medium' | 'low';
        factors: {
            issueCount: number;
            severityWeight: number;
            densityScore: number;
            diversityScore: number;
        };
    } {
        const issueCount = analysis.problems.length;
        const severityWeight = this.computeSeverityWeight(analysis.problems);
        const densityScore = this.computeDensityScore(issueCount, analysis.lineCount);
        const diversityScore = this.computeDiversityScore(analysis.problems);

        // Calculate final score (0-100, where 100 is excellent)
        const score = Math.max(0, Math.min(100, Math.round(
            100 - (
                (issueCount * 5) + // Each issue reduces score by 5 points
                (severityWeight * 10) + // Severity weight reduces score by up to 10 points
                (densityScore * 15) + // Density reduces score by up to 15 points
                (diversityScore * 10) // Diversity reduces score by up to 10 points
            )
        )));

        // Determine priority based on score
        const priority = score < 30 ? 'high' : score < 70 ? 'medium' : 'low';

        return {
            score,
            priority,
            factors: {
                issueCount,
                severityWeight,
                densityScore,
                diversityScore
            }
        };
    }

    private computeProjectScore(fileScores: Map<string, any>): {
        score: number;
        priority: 'high' | 'medium' | 'low';
        factors: {
            totalIssues: number;
            averageSeverity: number;
            averageDensity: number;
            averageDiversity: number;
        };
    } {
        const scores = Array.from(fileScores.values());
        
        const totalIssues = this.metrics.totalIssues;
        const averageSeverity = scores.reduce((sum, s) => sum + s.factors.severityWeight, 0) / scores.length;
        const averageDensity = scores.reduce((sum, s) => sum + s.factors.densityScore, 0) / scores.length;
        const averageDiversity = scores.reduce((sum, s) => sum + s.factors.diversityScore, 0) / scores.length;

        // Calculate project score as weighted average of file scores
        const score = Math.round(
            scores.reduce((sum, s) => sum + s.score, 0) / scores.length
        );

        // Determine project priority based on score
        const priority = score < 30 ? 'high' : score < 70 ? 'medium' : 'low';

        return {
            score,
            priority,
            factors: {
                totalIssues,
                averageSeverity,
                averageDensity,
                averageDiversity
            }
        };
    }

    private computeSeverityWeight(problems: any[]): number {
        const severityWeights = {
            high: 1.0,
            medium: 0.6,
            low: 0.3,
            unknown: 0.5
        };

        return problems.reduce((sum, p) => {
            const severity = p.severity || 'unknown';
            return sum + (severityWeights[severity as keyof typeof severityWeights] || 0);
        }, 0) / problems.length;
    }

    private computeDensityScore(issueCount: number, lineCount: number): number {
        if (lineCount === 0) return 1;
        const issuesPer1000Lines = (issueCount / lineCount) * 1000;
        return Math.min(1, issuesPer1000Lines / 10); // Normalize to 0-1, where 10 issues per 1000 lines is max
    }

    private computeDiversityScore(problems: any[]): number {
        if (problems.length === 0) return 0;
        const uniqueTypes = new Set(problems.map(p => p.type)).size;
        return Math.min(1, uniqueTypes / 5); // Normalize to 0-1, where 5 different types is max
    }
} 