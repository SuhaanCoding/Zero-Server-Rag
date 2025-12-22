import * as pdfjs from 'pdfjs-dist';
import { pipeline, env } from '@xenova/transformers';

// 1. CONFIGURATION: Force download from Hugging Face (Fixes 404 Error)
env.allowLocalModels = false;
env.useBrowserCache = false;

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

declare const self: DedicatedWorkerGlobalScope;

// 2. SINGLETON: Only load the AI model ONCE.
let extractor: any = null;

const getExtractor = async () => {
    if (!extractor) {
        console.log("Worker: Loading AI Model...");
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return extractor;
}

const getTextFromPDF = async (pdfUrl: ArrayBuffer) => {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    let text = '';
    for (let pagenum = 1; pagenum <= pdf.numPages; pagenum++) {
        const page = await pdf.getPage(pagenum);
        const pageText = await page.getTextContent();
        const strings = pageText.items.map((item: any) => item.str);
        text += strings.join(' ') + '\n\n';
    }
    return text;
}

const cleanPageText = (text: string) => {
    return text
        .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'TEST_CONN':
            self.postMessage({ type: 'TEST_CONN', payload: 'Connection established' })
            break;

        case 'PARSE-PDF':
            try {
                // Step A: Extract Text
                const allText = await getTextFromPDF(payload);
                const cleanText = cleanPageText(allText);

                // Step B: CHUNKING (Critical Fix)
                // We split by double newline to get paragraphs.
                const chunks = cleanText.split('\n\n').filter(c => c.length > 50);

                console.log(`Worker: Chunked PDF into ${chunks.length} parts.`);

                // Step C: Embeddings
                const pipe = await getExtractor();

                // LIMIT: Process only 3 chunks for testing (prevents browser freeze)
                const output = await pipe(chunks.slice(0, 3), {
                    pooling: 'mean',
                    normalize: true
                });

                // Step D: Send Data Safely
                self.postMessage({
                    type: 'PARSE-PDF',
                    payload: {
                        text: cleanText,           // Readable text for UI
                        chunkCount: chunks.length, // Stats
                        vectors: output.tolist()   // Numbers for the Console/Log
                    }
                });

            } catch (err: any) {
                console.error("Worker Error:", err);
                self.postMessage({ type: 'ERROR', payload: err.message })
            }
            break;

        default:
            console.error(`Unknown command: ${type}`)
    }
});