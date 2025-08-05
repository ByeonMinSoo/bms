declare module 'pdf-parse' {
  
  interface PDFData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }
  
  function pdfParse(dataBuffer: Buffer): Promise<PDFData>;
  export = pdfParse;
}

declare module 'fs-extra' {
  export * from 'fs';
  export function readJSON(file: string): Promise<any>;
  export function writeJSON(file: string, obj: any, options?: any): Promise<void>;
  export function pathExists(path: string): Promise<boolean>;
  export function remove(path: string): Promise<void>;
}

declare module 'cosine-similarity' {
  function similarity(a: number[], b: number[]): number;
  export = similarity;
}

declare module 'uuid' {
  export function v4(): string;
} 