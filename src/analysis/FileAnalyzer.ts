import { FileAnalysis, Problem } from './types';
import CodeDebtAgent from '../agent';
import * as fs from 'fs';

export class FileAnalyzer {
    private agent: CodeDebtAgent;

    constructor(agent: CodeDebtAgent) {
        this.agent = agent;
    }

    public async analyzeFile(filePath: string): Promise<FileAnalysis> {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lineCount = content.split('\n').length;
        
        // Get the raw analysis from the existing agent
        const rawAnalysis = await this.agent.analyzeFile(filePath);
        
        // Parse the raw analysis into structured problems
        const problems = this.parseProblems(rawAnalysis, filePath);
        
        return {
            filePath,
            problems,
            lineCount
        };
    }

    private parseProblems(rawAnalysis: string, filePath: string): Problem[] {
        // This is a placeholder implementation that would need to be customized
        // based on the actual output format of your existing agent
        const problems: Problem[] = [];
        
        // Example parsing logic (to be replaced with actual implementation)
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
} 