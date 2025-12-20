import * as pdfjs from 'pdfjs-dist';
import { pipeline, env } from '@xenova/transformers';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
env.allowLocalModels = false;
env.useBrowserCache = false;
declare const self: DedicatedWorkerGlobalScope;

let extractor = null;

const getTextFromPDF = async (pdfUrl) => {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    let text = '';
    for (let pagenum = 1;  pagenum <= pdf.numPages; pagenum++){
        const page = await pdf.getPage(pagenum);
        const pageText = await page.getTextContent();
        const strings = pageText.items.map((item: any) => item.str || '');
        const pagestrings = strings.join(' ')
        text = text + '\n\n' + pagestrings;
    }
    return text;
}

const vectorEmbeddings = async (content) => {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    const result = await extractor(content, {
        pooling: 'mean',
        normalize: true 
    });

    return Array.from(result.data);
}

const cleanPageText = (text) => {
    return text
        .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F]/g, "") 
        .replace(/\s+/g, " ") 
        .replace(/-\s/g, "") 
        .trim();
}

const chunkText = (text, maxLength = 500, overlap = 50) => {
    const allSentences = [];
    const sentences = text.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [text];
    
    let char = 0;
    let curr_chunk = '';
    
    for (const sentence of sentences) {
        const sentence_length = sentence.length;

        if ((char + sentence_length) <= maxLength) {
            curr_chunk += sentence + ' ';
            char += sentence_length + 1;
        } 
        else {
            if (curr_chunk) allSentences.push(curr_chunk.trim());

            const overlapText = curr_chunk.slice(-overlap);
            curr_chunk = overlapText + sentence + ' ';
            char = curr_chunk.length;
        }
    }
    
    if (curr_chunk) {
        allSentences.push(curr_chunk.trim());
    }

    return allSentences;
}

self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;
    console.log(`worker received a message of: ${type} type` );
    
    switch (type){
        case 'TEST_CONN':
            self.postMessage({
                type: 'TEST_CONN',
                payload: 'Connection has been established'
            })
            break;
        
        case 'PARSE-PDF':
            try {
                const allText = await getTextFromPDF(payload);
                const parsedText = cleanPageText(allText);
                const arraysOfText = chunkText(parsedText); 
                
                const totalEmbedded = [];
                
                for (const chunkString of arraysOfText){
                    const Embedded = await vectorEmbeddings(chunkString);
                    
                    totalEmbedded.push({
                        text: chunkString,
                        vector: Embedded
                    });
                }

                self.postMessage({
                    type: 'PARSE-PDF',
                    payload: parsedText,
                });

                self.postMessage({
                    type: 'VECTOR-OUTPUT',
                    payload: totalEmbedded
                });
            } catch (e) {
                console.error(e);
                self.postMessage({ type: 'ERROR', payload: e.message });
            }
            break; 

        default:
             console.error(`Unknown command: ${type}`);
    }
});