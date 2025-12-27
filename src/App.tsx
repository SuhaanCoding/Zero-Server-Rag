import { useState, useEffect, useRef } from 'react'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<{text: string, score: number}[]>([]);
  const [query, setQuery] = useState("");
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/rag.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'PARSE-PDF':
          setLogs(prev => [...prev, `[SUCCESS] Indexed ${payload.chunkCount} paragraphs`]);
          break;
          
        case 'SEARCH_RESULT':
          setResults(payload);
          setLogs(prev => [...prev, `[AI] Found ${payload.length} relevant matches`]);
          break;

        case 'ERROR':
          setLogs(prev => [...prev, `[ERROR] ${payload}`]);
          break;
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogs(prev => [...prev, `Reading ${file.name}...`]);
    const buffer = await file.arrayBuffer();
    workerRef.current?.postMessage({ type: 'PARSE-PDF', payload: buffer });
  };

  const handleSearch = () => {
    if (!query) return;
    setLogs(prev => [...prev, `[USER] Searching: "${query}"...`]);
    workerRef.current?.postMessage({ type: 'SEARCH', payload: query });
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white p-10 gap-8">
      <h1 className="text-4xl font-bold text-blue-500 text-center">Phase 4: The Search</h1>

      <div className="flex justify-center gap-4">
        <label className="px-6 py-2 bg-blue-600 rounded cursor-pointer font-bold hover:bg-blue-700">
          1. Upload PDF
          <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
      <div className="flex gap-2 max-w-2xl mx-auto w-full">
        <input 
            className="flex-1 p-2 rounded text-black"
            placeholder="2. Ask a question about the PDF..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} className="px-6 py-2 bg-green-600 rounded font-bold hover:bg-green-700">
            Search
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-black p-4 rounded border border-gray-700 h-64 overflow-y-auto font-mono text-xs text-green-400">
             {logs.map((log, i) => <div key={i}>{log}</div>)}
          </div>
          <div className="bg-white text-black p-6 rounded h-64 overflow-y-auto">
             <h3 className="font-bold border-b pb-2 mb-2 text-lg">Top Matches</h3>
             {results.length === 0 && <p className="text-gray-400 italic">No results yet.</p>}
             {results.map((res, i) => (
                 <div key={i} className="mb-4 bg-gray-100 p-3 rounded">
                     <div className="text-xs font-bold text-blue-600 mb-1">Match #{i+1} (Score: {(res.score * 100).toFixed(1)}%)</div>
                     <p className="text-sm">{res.text}</p>
                 </div>
             ))}
          </div>
      </div>
    </div>
  )
}

export default App