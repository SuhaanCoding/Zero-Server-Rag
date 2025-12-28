import * as pdfjs from 'pdfjs-dist';
import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;
const EXECUTION_DEVICE = 'cpu'; 
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
declare const self: DedicatedWorkerGlobalScope;

let extractor: any = null;
let generator: any = null; 
let vectorStore: { index: number, text: string, vector: number[] }[] = []; 

const calculateCostSavings = (tokens: number) => ((tokens / 1000) * 0.005).toFixed(6);

const cleanPDFText = (text: string) => {
    return text
        .replace(/(\w) ff (\w)/g, "$1ff$2")
        .replace(/(\w) fi (\w)/g, "$1fi$2")
        .replace(/([a-z])\s+([a-z])\b/g, "$1$2")
        .replace(/\n/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const getExtractor = async () => {
    if (!extractor) extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return extractor;
}

const getGenerator = async () => {
    if (!generator) generator = await pipeline('text2text-generation', 'Xenova/LaMini-Flan-T5-248M', { quantized: true, device: EXECUTION_DEVICE });
    return generator;
}

const getTextFromPDF = async (pdfUrl: ArrayBuffer) => {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + ' '; 
    }
    return cleanPDFText(text);
}

const chunkText = (text: string) => {
    const words = text.split(" ");
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 120) { 
        chunks.push(words.slice(i, i + 150).join(" "));
    }
    return chunks;
}

const cosineSimilarity = (a: number[], b: number[]) => {
    return a.reduce((acc, cur, i) => acc + cur * b[i], 0); 
};

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    switch (type) {
        case 'PARSE-PDF':
            try {
                vectorStore = []; 
                const rawText = await getTextFromPDF(payload);
                const chunks = chunkText(rawText);
                const pipe = await getExtractor();
                
                const processChunks = chunks.slice(0, 200); 
                const output = await pipe(processChunks, { pooling: 'mean', normalize: true });
                const embeddings = output.tolist();
                
                processChunks.forEach((chunk, i) => vectorStore.push({ index: i, text: chunk, vector: embeddings[i] }));
                self.postMessage({ type: 'PARSE-PDF', payload: { chunkCount: vectorStore.length } });
            } catch (err: any) { self.postMessage({ type: 'ERROR', payload: err.message }); }
            break;

        case 'ANSWER':
            try {
                if (vectorStore.length === 0) throw new Error("No PDF!");
                self.postMessage({ type: 'STATUS', payload: 'Thinking...' });

                const t0 = performance.now();
                const pipe = await getExtractor();
                const output = await pipe(payload, { pooling: 'mean', normalize: true });
                const queryVector = output.tolist()[0];
                const results = vectorStore.map(item => ({ 
                    ...item, 
                    score: cosineSimilarity(queryVector, item.vector) 
                }));
                const topResults = results.sort((a, b) => b.score - a.score).slice(0, 2);
                let context = topResults.map(r => r.text).join("\n ... \n");
                if (context.length > 1100) context = context.substring(0, 1100);

                const t1 = performance.now();
                const prompt = `Task: Answer and infer details. Context: ${context} Question: "${payload}"`;

                const generator = await getGenerator();
                const answer = await generator(prompt, {
                    max_new_tokens: 150,
                    temperature: 0.1, 
                    do_sample: false,
                    repetition_penalty: 1.2
                });

                const t2 = performance.now();
                
                let cleanAnswer = answer[0].generated_text.replace(/^Answer:\s*/i, "").trim();
                cleanAnswer = cleanAnswer.charAt(0).toUpperCase() + cleanAnswer.slice(1);

                self.postMessage({
                    type: 'ANSWER_RESULT',
                    payload: {
                        answer: cleanAnswer,
                        sources: topResults,
                        metrics: {
                            retrievalTime: (t1 - t0).toFixed(2),
                            generationTime: (t2 - t1).toFixed(2),
                            tokensPerSec: ((cleanAnswer.length/4) / ((t2-t1)/1000)).toFixed(2),
                            costSavings: calculateCostSavings((prompt.length + cleanAnswer.length)/4)
                        }
                    }
                });
            } catch (err: any) { self.postMessage({ type: 'ERROR', payload: err.message }); }
            break;
    }
});