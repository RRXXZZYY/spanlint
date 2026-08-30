import type { ParsedInput } from "./types.js";
export declare function decodeAnyValue(value: unknown): unknown;
export declare function decodeAttributes(value: unknown): Record<string, unknown>;
export declare function parseInputFiles(paths: string[]): Promise<ParsedInput>;
export declare function parseInputText(text: string, sourceFile?: string): ParsedInput;
//# sourceMappingURL=otlp.d.ts.map