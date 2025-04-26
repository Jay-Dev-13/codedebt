import { RunnableSequence } from "@langchain/core/runnables";
import { FileAnalysis, Problem, CombinedAnalysis, AnalysisMetrics, CodeDebtScore } from './types';
import CodeDebtAgent from '../agent';
import * as fs from 'fs';
import * as path from 'path';

// File Analysis Node
async function analyzeFile(filePath: string): Promise<FileAnalysis> {
    const agent = new CodeDebtAgent();
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').length;
    
    const rawAnalysis = await agent.analyzeFile(filePath);
    const problems = parseProblems(rawAnalysis, filePath);
    
    return {
        filePath,
        problems,
        lineCount
    };
}

// Combine Analyses Node
function combineAnalyses(fileAnalyses: Map<string, FileAnalysis>): CombinedAnalysis {
    const problemTypes = new Map<string, number>();
    const severityDistribution = new Map<string, number>();
    let totalProblems = 0;

    for (const [filePath, analysis] of fileAnalyses) {
        totalProblems += analysis.problems.length;

        for (const problem of analysis.problems) {
            const typeCount = problemTypes.get(problem.type) || 0;
            problemTypes.set(problem.type, typeCount + 1);

            const severity = problem.severity || 'unknown';
            const severityCount = severityDistribution.get(severity) || 0;
            severityDistribution.set(severity, severityCount + 1);
        }
    }

    return {
        files: fileAnalyses,
        totalProblems,
        problemTypes,
        severityDistribution
    };
}

// Compute Metrics Node
function computeMetrics(combinedAnalysis: CombinedAnalysis): AnalysisMetrics {
    const issuesPerFile = new Map<string, number>();
    const issuesPerType = new Map<string, number>();
    const issuesPerSeverity = new Map<string, number>();
    let totalIssues = 0;
    let totalLines = 0;

    for (const [filePath, analysis] of combinedAnalysis.files) {
        const issueCount = analysis.problems.length;
        issuesPerFile.set(filePath, issueCount);
        totalIssues += issueCount;
        totalLines += analysis.lineCount;

        for (const problem of analysis.problems) {
            const typeCount = issuesPerType.get(problem.type) || 0;
            issuesPerType.set(problem.type, typeCount + 1);

            const severity = problem.severity || 'unknown';
            const severityCount = issuesPerSeverity.get(severity) || 0;
            issuesPerSeverity.set(severity, severityCount + 1);
        }
    }

    const averageIssuesPer1000Lines = totalLines > 0 
        ? (totalIssues / totalLines) * 1000 
        : 0;

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

// Compute Scores Node
function computeScores(combinedAnalysis: CombinedAnalysis, metrics: AnalysisMetrics): CodeDebtScore {
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

    // Compute file scores
    for (const [filePath, analysis] of combinedAnalysis.files) {
        const issueCount = analysis.problems.length;
        const severityWeight = computeSeverityWeight(analysis.problems);
        const densityScore = computeDensityScore(issueCount, analysis.lineCount);
        const diversityScore = computeDiversityScore(analysis.problems);

        const score = Math.max(0, Math.min(100, Math.round(
            100 - (
                (issueCount * 5) +
                (severityWeight * 10) +
                (densityScore * 15) +
                (diversityScore * 10)
            )
        )));

        const priority = score < 30 ? 'high' : score < 70 ? 'medium' : 'low';

        fileScores.set(filePath, {
            score,
            priority,
            factors: {
                issueCount,
                severityWeight,
                densityScore,
                diversityScore
            }
        });
    }

    // Compute project score
    const scores = Array.from(fileScores.values());
    const projectScore = {
        score: Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length),
        priority: scores[0]?.priority || 'low',
        factors: {
            totalIssues: metrics.totalIssues,
            averageSeverity: scores.reduce((sum, s) => sum + s.factors.severityWeight, 0) / scores.length,
            averageDensity: scores.reduce((sum, s) => sum + s.factors.densityScore, 0) / scores.length,
            averageDiversity: scores.reduce((sum, s) => sum + s.factors.diversityScore, 0) / scores.length
        }
    };

    return {
        fileScores,
        projectScore
    };
}

// Helper functions
function parseProblems(rawAnalysis: string, filePath: string): Problem[] {
    const problems: Problem[] = [];
    const lines = rawAnalysis.split('\n');
    let currentProblem: Partial<Problem> | null = null;
    
    for (const line of lines) {
        if (line.startsWith('Problem Type:')) {
            if (currentProblem) {
                problems.push(currentProblem as Problem);
            }
            currentProblem = {
                type: line.replace('Problem Type:', '').trim(),
                location: { file: filePath },
                description: ''
            };
        } else if (line.startsWith('Location:')) {
            const location = line.replace('Location:', '').trim();
            if (currentProblem && currentProblem.location) {
                if (location.includes(':')) {
                    const [functionName, lineRange] = location.split(':');
                    currentProblem.location.functionName = functionName.trim();
                    if (lineRange.includes('-')) {
                        const [start, end] = lineRange.split('-').map(n => parseInt(n.trim()));
                        currentProblem.location.lineNumbers = [start, end];
                    }
                }
            }
        } else if (line.startsWith('Description:')) {
            if (currentProblem) {
                currentProblem.description = line.replace('Description:', '').trim();
            }
        } else if (line.startsWith('Severity:')) {
            if (currentProblem) {
                const severity = line.replace('Severity:', '').trim().toLowerCase();
                currentProblem.severity = severity as 'high' | 'medium' | 'low' | 'unknown';
            }
        }
    }
    
    if (currentProblem) {
        problems.push(currentProblem as Problem);
    }
    
    return problems;
}

function computeSeverityWeight(problems: Problem[]): number {
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

function computeDensityScore(issueCount: number, lineCount: number): number {
    if (lineCount === 0) return 1;
    const issuesPer1000Lines = (issueCount / lineCount) * 1000;
    return Math.min(1, issuesPer1000Lines / 10);
}

function computeDiversityScore(problems: Problem[]): number {
    if (problems.length === 0) return 0;
    const uniqueTypes = new Set(problems.map(p => p.type)).size;
    return Math.min(1, uniqueTypes / 5);
}

// Create the analysis chain
export function createCodeDebtChain() {
    return RunnableSequence.from([
        // Step 1: Analyze files
        async (input: { directory: string; excludePatterns: string[] }) => {
            const fileAnalyses = new Map<string, FileAnalysis>();
            const processDirectory = async (dir: string) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    
                    if (stat.isDirectory()) {
                        if (!input.excludePatterns.some(pattern => filePath.includes(pattern))) {
                            await processDirectory(filePath);
                        }
                    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                        console.log(`Analyzing ${filePath}...`);
                        const analysis = await analyzeFile(filePath);
                        fileAnalyses.set(filePath, analysis);
                    }
                }
            };
            
            await processDirectory(input.directory);
            return { fileAnalyses };
        },
        // Step 2: Combine analyses
        (state: { fileAnalyses: Map<string, FileAnalysis> }) => {
            const combinedAnalysis = combineAnalyses(state.fileAnalyses);
            return { ...state, combinedAnalysis };
        },
        // Step 3: Compute metrics
        (state: { fileAnalyses: Map<string, FileAnalysis>; combinedAnalysis: CombinedAnalysis }) => {
            const metrics = computeMetrics(state.combinedAnalysis);
            return { ...state, metrics };
        },
        // Step 4: Compute scores
        (state: { fileAnalyses: Map<string, FileAnalysis>; combinedAnalysis: CombinedAnalysis; metrics: AnalysisMetrics }) => {
            const scores = computeScores(state.combinedAnalysis, state.metrics);
            return { ...state, scores };
        }
    ]);
}

// Export a function to run the analysis
export async function analyzeCodebase(directory: string, excludePatterns: string[] = ['node_modules', 'dist']) {
    const chain = createCodeDebtChain();
    const result = await chain.invoke({
        directory,
        excludePatterns
    });
    return result;
} 