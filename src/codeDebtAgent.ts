import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

interface OllamaResponse {
    response: string;
    done: boolean;
}

class CodeDebtAgent {
    private baseUrl: string;
    private model: string;
    private opinions: string;
    private totalFiles: number = 0;
    private processedFiles: number = 0;

    constructor() {
        this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        this.model = process.env.OLLAMA_MODEL || 'llama2';
        this.opinions = this.loadOpinions();
    }

    private loadOpinions(): string {
        try {
            return fs.readFileSync(path.join(process.cwd(), 'opinions.md'), 'utf-8');
        } catch (error) {
            console.error('Error loading opinions file:', error);
            return '';
        }
    }

    public async analyzeFile(filePath: string): Promise<string> {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const prompt = `
                You are a code debt analyzer. Analyze the following code based on these project opinions and standards:
                ${this.opinions}
                
                Provide a detailed analysis of the code in ${filePath}, highlighting any violations of these standards and suggesting improvements.
                
                Here's the code to analyze:
                ${content}
            `;

            const response = await axios.post<OllamaResponse>(`${this.baseUrl}/api/generate`, {
                model: this.model,
                prompt: prompt,
                stream: false
            });

            this.processedFiles++;
            this.reportProgress();
            return response.data.response;
        } catch (error: any) {
            console.error(`Error analyzing file ${filePath}:`, error);
            this.processedFiles++;
            this.reportProgress();
            return `Error analyzing file ${filePath}: ${error?.message || 'Unknown error'}`;
        }
    }

    private reportProgress(): void {
        const percentage = Math.round((this.processedFiles / this.totalFiles) * 100);
        process.stdout.write(`\rProgress: ${percentage}% (${this.processedFiles}/${this.totalFiles} files)`);
    }

    private countFiles(directory: string, excludePatterns: string[]): number {
        let count = 0;
        const files = fs.readdirSync(directory);
        
        for (const file of files) {
            const filePath = path.join(directory, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                if (!excludePatterns.some(pattern => filePath.includes(pattern))) {
                    count += this.countFiles(filePath, excludePatterns);
                }
            } else if (file.endsWith('.ts') || file.endsWith('.js')) {
                count++;
            }
        }
        
        return count;
    }

    public async analyzeCodebase(directory: string, excludePatterns: string[] = ['node_modules', 'dist']): Promise<Map<string, string>> {
        const results = new Map<string, string>();
        
        // Count total files first
        this.totalFiles = this.countFiles(directory, excludePatterns);
        this.processedFiles = 0;
        console.log(`Found ${this.totalFiles} files to analyze.`);
        
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
                    console.log(`\nAnalyzing ${filePath}...`);
                    const analysis = await this.analyzeFile(filePath);
                    results.set(filePath, analysis);
                }
            }
        };

        await processDirectory(directory);
        console.log('\nAnalysis complete!');
        return results;
    }
}

export default CodeDebtAgent; 