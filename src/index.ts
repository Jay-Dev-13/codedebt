import CodeDebtAgent from './codeDebtAgent';
import * as path from 'path';

async function analyzeSingleFile(filePath: string) {
    try {
        const agent = new CodeDebtAgent();
        console.log(`Analyzing demo file: ${filePath}`);
        
        const analysis = await agent.analyzeFile(filePath);
        
        console.log('\nCode Debt Analysis Results:');
        console.log('==========================\n');
        console.log(`File: ${path.relative(process.cwd(), filePath)}`);
        console.log('------------------------');
        console.log(analysis);
    } catch (error) {
        console.error('Error analyzing demo file:', error);
        process.exit(1);
    }
}

async function analyzeCodebase(directory: string) {
    try {
        const agent = new CodeDebtAgent();
        console.log(`Analyzing codebase in: ${directory}`);
        const results = await agent.analyzeCodebase(directory);
        
        console.log('\nCode Debt Analysis Results:');
        console.log('==========================\n');
        
        for (const [filePath, analysis] of results) {
            console.log(`File: ${path.relative(process.cwd(), filePath)}`);
            console.log('------------------------');
            console.log(analysis);
            console.log('\n');
        }
    } catch (error) {
        console.error('Error running code debt analysis:', error);
        process.exit(1);
    }
}

const demoFile = path.join(__dirname, 'demo', 'calculator.ts');

if (process.argv[2] === '--demo') {
    analyzeSingleFile(demoFile);
} else {
    const targetDirectory = process.argv[2] || process.cwd();
    analyzeCodebase(targetDirectory);
} 