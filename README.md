# Code Debt Analyzer

An AI-powered agent that analyzes codebases for technical debt based on project-specific opinions and standards.

## Features

- Analyzes code against project-specific standards defined in `opinions.md`
- Uses Ollama with Llama2 model for code analysis
- Supports TypeScript and JavaScript files
- Provides detailed analysis of code violations and improvement suggestions
- Includes demo mode for quick testing

## Prerequisites

- Node.js (v14 or higher)
- Ollama installed and running locally
- Llama2 model pulled in Ollama

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Make sure Ollama is running and Llama2 model is pulled:
   ```bash
   ollama pull llama2
   ```

## Configuration

1. Create an `opinions.md` file in the project root with your project's standards and opinions
2. Configure environment variables in `.env` file if needed

## Usage

To analyze a codebase:

```bash
# Development mode (analyze entire codebase)
npm run dev [path/to/codebase]

# Production mode (analyze entire codebase)
npm run build
npm start [path/to/codebase]

# Demo mode (analyze single demo file)
npm run demo
```

If no path is provided in full analysis mode, the current directory will be analyzed.

The demo mode analyzes a small calculator file with intentional code debt issues, making it perfect for quick testing and understanding how the analyzer works.

## Output

The analyzer will provide a detailed report for each TypeScript/JavaScript file, including:
- Violations of project standards
- Suggestions for improvements
- Code quality metrics

## Contributing

Feel free to submit issues and enhancement requests! 