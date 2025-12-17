import * as pdfjs from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

declare const self: DedicatedWorkerGlobalScope;

const getTextFromPDF = async (pdfUrl) => {
    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    let text = '';
    for (let pagenum = 1;  pagenum <= pdf.numPages; pagenum++){
        const page = await pdf.getPage(pagenum);
        const pageText = await page.getTextContent();
        const strings = pageText.items.map((item) => item.str);
        const pagestrings = strings.join(' ')
        text = text + '\n\n' + pagestrings;
        
    }
return text;
}
self.addEventListener('message', async (event) => {
    const { type, payload } = event.data;

    console.log(`worker received a message of: ${type} type` );
    
    switch (type){

        case 'TEST_CONN':
            console.log(`A connection has been established here`);
            
            self.postMessage({
                type: 'TEST_CONN',
                payload: 'Connection has been established'

            })
            break;
        
        case 'PARSE-PDF':
            { const alltext = await getTextFromPDF(payload);
            self.postMessage({
                type: 'PARSE-PDF',
                payload: alltext,
            });
            break; 
        }

        default:
            console.error(`A command has been receieved with ${type} and not certain what it is`)
            self.postMessage({type: `error`, payload: {type}})
        
    }


}


)
