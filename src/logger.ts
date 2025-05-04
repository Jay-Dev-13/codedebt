import chalk from "chalk";
import { ENVIRONMENT_VARIABLES, LOG_LEVEL } from "./env";

export class Logger {
	private source: string;

	constructor(source: string) {
		this.source = source;
	}

	log(message: string, ...args: any[]) {
		console.log(chalk.green(`[${this.source}] ${message}`, ...args));
	}

	error(message: string, ...args: any[]) {
		console.error(chalk.red(`[${this.source}] ${message}`, ...args));
	}

	warn(message: string, ...args: any[]) {
		console.warn(chalk.yellow(`[${this.source}] ${message}`, ...args));
	}

	info(message: string, ...args: any[]) {
		if (ENVIRONMENT_VARIABLES.LOG_LEVEL === LOG_LEVEL.Enum.verbose) {
			console.info(chalk.blue(`[${this.source}] ${message}`, ...args));
		}
	}
}
