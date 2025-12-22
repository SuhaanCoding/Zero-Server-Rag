import { useState, useEffect, useRef } from 'react'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [pdfText, setPDFText] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/rag.worker.ts', 
      import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'PARSE-PDF':
          const { text, chunkCount, vectors } = payload;
          
          setPDFText(prev => [...prev, text]);
          setLogs(prev => [...prev, `[SUCCESS] PDF Chunked: ${chunkCount} paragraphs`]);
          setLogs(prev => [...prev, `[AI] Generated Vectors: [${vectors[0].slice(0, 5).join(', ')}...]`]);
          break;

        case 'ERROR':
          setLogs(prev => [...prev, `[ERROR]: ${payload}`]);
          break;

        default:
           setLogs(prev => [...prev, `[${type}]: ${JSON.stringify(payload)}`]);
           break;
      }
    };
    
    return () => workerRef.current?.terminate();
  }, []);
  
  const testconn = () => {
    workerRef.current?.postMessage({ type: 'TEST_CONN'});
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    setPDFText([]);
    setLogs(prev => [...prev, `ui Reading ${selectedFile.name}...`]);

    const fileBuffer = await selectedFile.arrayBuffer();

    workerRef.current?.postMessage({
      type: 'PARSE-PDF',
      payload: fileBuffer,
    });
  }
  
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <div className="flex flex-col items-center p-8 gap-6 border-b border-gray-800">
        <h1 className="text-4xl font-bold text-blue-500">Phase 3: The Librarian</h1>

        <div className="flex gap-4">
            <label className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded cursor-pointer font-bold transition">
            Upload PDF
            <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
            </label>
            <button onClick={testconn} className="px-6 py-2 bg-gray-700 rounded font-bold hover:bg-gray-600">
            Test Connection
            </button>
        </div>
        <ul className="w-full max-w-2xl bg-black p-4 rounded h-40 overflow-y-auto border border-gray-700 font-mono text-xs text-green-400">
          {logs.map((log, index) => <li key={index}>{log}</li>)}
        </ul>
      </div>

      <div className="flex-1 bg-white text-black p-10 flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-8 text-gray-800">Document Content</h2>
        <div className="w-full max-w-4xl">
            {pdfText.length === 0 ? (
                <p className="text-center text-gray-400 mt-10 italic">Upload a PDF to begin analysis...</p>
            ) : (
                <ul className="list-none space-y-4">
                    {pdfText.map((txt, i) => (
                        <li key={i} className="whitespace-pre-wrap p-4 bg-gray-50 rounded shadow-sm leading-relaxed border border-gray-200">
                            {txt}
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>
    </div>
  )
}

export default App