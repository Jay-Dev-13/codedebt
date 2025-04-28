export const PROMPTS = {
	CODE_DEBT_ANALYSIS: (opinions: string, filePath: string, content: string) =>
		`
      You are a code debt analyzer. Analyze the following code based on these project opinions and standards:
      ${opinions}

      Provide a summary of the code in ${filePath}, highlighting any violations of these standards.
      Make sure to be concise and to the point. No need to suggest improvements.

      Your output will be consumed by a machine. It will be used to generate a report. So make sure to be concise and to the point. No need to have human like language. No need to be verbose. 

      Don't mention the project opinions and standards in your output. Just analyze the code.

      In the next step, the original code won't be accessible. So make sure to provide enough information so that the original code can be reconstructed.

      Here's the code to analyze:
      ${content}
`,
};
