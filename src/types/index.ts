export interface FolderStructure {
	name: string;
	path: string;
	type: "file" | "directory";
	children?: FolderStructure[];
	metrics?: {
		totalFiles: number;
		totalIssues: number;
		issuesByType: Record<string, number>;
		issuesBySeverity: Record<string, number>;
	};
}
