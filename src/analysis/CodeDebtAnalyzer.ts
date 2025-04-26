import { FileAnalyzer } from './FileAnalyzer';
import { CombinedAnalyzer } from './CombinedAnalyzer';
import { MetricsAnalyzer } from './MetricsAnalyzer';
import { CodeDebtScorer } from './CodeDebtScorer';
import { AnalysisMetrics, CodeDebtScore, CombinedAnalysis, FileAnalysis } from './types';
import CodeDebtAgent from '../agent';
import * as fs from 'fs';
import * as path from 'path';

export class CodeDebtAnalyzer {
    private agent: CodeDebtAgent;
    private fileAnalyzer: FileAnalyzer;
    private combinedAnalyzer: CombinedAnalyzer;
    private metricsAnalyzer: MetricsAnalyzer | null = null;
    private codeDebtScorer: CodeDebtScorer | null = null;

    constructor(agent: CodeDebtAgent) {
        this.agent = agent;
        this.fileAnalyzer = new FileAnalyzer(agent);
        this.combinedAnalyzer = new CombinedAnalyzer();
    }

    public async analyzeCodebase(
        directory: string,
        excludePatterns: string[] = ['node_modules', 'dist']
    ): Promise<{
        combinedAnalysis: CombinedAnalysis;
        metrics: AnalysisMetrics;
        scores: CodeDebtScore;
    }> {
        // Stage 1: Analyze individual files
        await this.analyzeFiles(directory, excludePatterns);

        // Stage 2: Combine analyses
        const combinedAnalysis = this.combinedAnalyzer.getCombinedAnalysis();

        // Stage 3: Compute metrics
        this.metricsAnalyzer = new MetricsAnalyzer(combinedAnalysis);
        const metrics = this.metricsAnalyzer.computeMetrics();

        // Stage 4: Compute scores
        this.codeDebtScorer = new CodeDebtScorer(combinedAnalysis, metrics);
        const scores = this.codeDebtScorer.computeScores();

        return {
            combinedAnalysis,
            metrics,
            scores
        };
    }

    private async analyzeFiles(directory: string, excludePatterns: string[]): Promise<void> {
        const processDirectory = async (dir: string) => {
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);

                if (stat.isDirectory()) {
                    if (!excludePatterns.some(pattern => filePath.includes(pattern))) {
                        await processDirectory(filePath);
                    }
                } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                    console.log(`Analyzing ${filePath}...`);
                    const analysis = await this.fileAnalyzer.analyzeFile(filePath);
                    this.combinedAnalyzer.addFileAnalysis(analysis);
                }
            }
        };

        await processDirectory(directory);
    }

    public getProblemClusters(): Map<string, string[]> | null {
        return this.metricsAnalyzer?.findProblemClusters() || null;
    }

    public getProblemTypeDistribution(): Map<string, number> | null {
        return this.metricsAnalyzer?.getProblemTypeDistribution() || null;
    }

    public getSeverityDistribution(): Map<string, number> | null {
        return this.metricsAnalyzer?.getSeverityDistribution() || null;
    }

    public getUniqueProblems(): any[] {
        return this.combinedAnalyzer.getUniqueProblems();
    }
} 