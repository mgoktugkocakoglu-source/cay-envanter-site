/**
 * Minimal ambient type declarations for third-party packages that ship no
 * TypeScript definitions. Only the surface area used by this codebase is typed.
 */

declare module 'mammoth' {
    interface ExtractInput {
        buffer: Buffer;
    }

    interface ExtractMessage {
        type: string;
        message: string;
    }

    interface ExtractResult {
        value: string;
        messages: ExtractMessage[];
    }

    export function extractRawText(input: ExtractInput): Promise<ExtractResult>;
}
