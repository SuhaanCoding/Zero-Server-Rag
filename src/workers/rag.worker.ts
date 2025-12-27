import * as pdfjs from 'pdfjs-dist';
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

declare const self: DedicatedWorkerGlobalScope;

let extractor: any = null;
let vectorStore: { text: string, vector: number[] }[] = []; 

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

const chunkText = (text: string, chunkSize: number = 150, overlap: number = 20) => {
    const cleanText = text.replace(/\s+/g, " ").trim();
    const words = cleanText.split(" ");
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
        const chunk = words.slice(i, i + chunkSize).join(" ");
        if (chunk.length > 50) {
            chunks.push(chunk);
        }
    }
    
    return chunks;
}

const cosineSimilarity = (a: number[], b: number[]) => {
    const dot = a.reduce((acc, cur, i) => acc + cur * b[i], 0);
    const magA = Math.sqrt(a.reduce((acc, cur) => acc + cur ** 2, 0));
    const magB = Math.sqrt(b.reduce((acc, cur) => acc + cur ** 2, 0));
    return dot / (magA * magB);
};

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'PARSE-PDF':
            try {
                vectorStore = []; 

                const rawText = await getTextFromPDF(payload);
                const chunks = chunkText(rawText);

                console.log(`Worker: Chunked into ${chunks.length} parts`);

                const pipe = await getExtractor();
                
                const output = await pipe(chunks, { pooling: 'mean', normalize: true });

                const embeddings = output.tolist();
                
                chunks.forEach((chunk, i) => {
                    vectorStore.push({
                        text: chunk,
                        vector: embeddings[i]
                    });
                });

                self.postMessage({
                    type: 'PARSE-PDF',
                    payload: { 
                        chunkCount: vectorStore.length,
                        preview: vectorStore[0]?.text || "No text found"
                    }
                });

            } catch (err: any) {
                self.postMessage({ type: 'ERROR', payload: err.message });
            }
            break;

        case 'SEARCH':
            try {
                if (vectorStore.length === 0) {
                    throw new Error("No PDF loaded!");
                }

                const pipe = await getExtractor();
                const output = await pipe(payload, { pooling: 'mean', normalize: true });
                const queryVector = output.tolist()[0];

                const results = vectorStore.map(item => ({
                    text: item.text,
                    score: cosineSimilarity(queryVector, item.vector)
                }));
                
                const topResults = results
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);

                self.postMessage({
                    type: 'SEARCH_RESULT',
                    payload: topResults
                });

            } catch (err: any) {
                self.postMessage({ type: 'ERROR', payload: err.message });
            }
            break;
    }
});