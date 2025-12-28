import { useState, useEffect, useRef } from 'react';
import { Upload, Send, Terminal, Bot, User, FileText, ChevronDown, ChevronRight, Activity, Cpu, Zap, DollarSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatHistoryTurn {
    question: string;
    answer: string;
    sources: {text: string, score: number}[];
    metrics?: PerformanceMetrics; 
}

interface PerformanceMetrics {
    retrievalTime: string;
    generationTime: string;
    tokensPerSec: string;
    costSavings: string;
}

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [sources, setSources] = useState<{text: string, score: number}[]>([]); 
  const [answer, setAnswer] = useState<string>(""); 
  const [status, setStatus] = useState("Idle"); 
  const [query, setQuery] = useState("");
  const [displayQuestion, setDisplayQuestion] = useState(""); 
  
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics | null>(null);

  const [history, setHistory] = useState<ChatHistoryTurn[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/rag.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;
      
      switch (type) {
        case 'PARSE-PDF':
          setLogs(prev => [...prev, `Indexed ${payload.chunkCount} chunks`]);
          setStatus("Ready");
          break;

        case 'STATUS': 
          setStatus(payload);
          break;
          
        case 'ANSWER_RESULT': 
          setAnswer(payload.answer);
          setSources(payload.sources);
          setCurrentMetrics(payload.metrics);
          setStatus("Done");
          setLogs(prev => [...prev, `Inference finished in ${payload.metrics.generationTime}ms`]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          break;

        case 'ERROR':
          setLogs(prev => [...prev, `[ERROR] ${payload}`]);
          setStatus("Error");
          break;
      }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLogs(prev => [...prev, `[User] Uploading ${file.name}...`]);
    setStatus("Processing PDF...");
    const buffer = await file.arrayBuffer();
    workerRef.current?.postMessage({ type: 'PARSE-PDF', payload: buffer });
  };

  const handleSearch = () => { 
    if (!query) return;

    if (displayQuestion && answer) {
        setHistory(prev => [...prev, { 
            question: displayQuestion, 
            answer, 
            sources,
            metrics: currentMetrics || undefined 
        }]);
    }

    setDisplayQuestion(query); 
    setAnswer(""); 
    setSources([]); 
    setCurrentMetrics(null);
    setLogs(prev => [...prev, `[User] Asking: "${query}"`]);
    workerRef.current?.postMessage({ type: 'ANSWER', payload: query });
    setQuery(""); 
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const MetricsCard = ({ metrics }: { metrics: PerformanceMetrics }) => (
      <div className="flex flex-wrap gap-2 mt-4 animate-in fade-in slide-in-from-top-1 duration-500">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-600">
              <Zap size={12} className="text-yellow-500" />
              <span>Retrieval: {metrics.retrievalTime}ms</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-600">
              <Cpu size={12} className="text-blue-500" />
              <span>Inference: {metrics.generationTime}ms</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-600">
              <Activity size={12} className="text-green-500" />
              <span>Speed: {metrics.tokensPerSec} T/s</span>
          </div>
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-mono text-green-700">
              <DollarSign size={12} />
              <span>Saved: ${metrics.costSavings}</span>
          </div>
      </div>
  );

  const AIResponseBlock = ({ text, srcs, isThinking, metrics }: { text: string, srcs: any[], isThinking?: boolean, metrics?: PerformanceMetrics }) => (
    <div className="flex justify-start w-full max-w-4xl mb-8 animate-in fade-in duration-300">
        <div className="w-10 h-10 bg-black rounded-full mr-3 flex items-center justify-center shrink-0">
            <Bot className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-col gap-3 w-full">
            <div className="bg-white border border-gray-200 p-6 rounded-2xl rounded-tl-none shadow-sm w-full">
                {isThinking ? (
                    <div className="flex items-center gap-2 text-gray-500 italic animate-pulse">Thinking...</div>
                ) : (
                    <>
                        <div className="prose prose-slate max-w-none prose-p:leading-relaxed prose-li:marker:text-black">
                            <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                        {metrics && <MetricsCard metrics={metrics} />}
                    </>
                )}
            </div>
            
            {!isThinking && srcs.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200/50">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-3">
                        <FileText size={16} /><span>Sources Used</span>
                    </div>
                    <div className="grid gap-2">
                        {srcs.map((src, i) => (
                            <div key={i} className="bg-white p-3 rounded-md border border-gray-200 text-xs shadow-sm">
                                <div className="flex justify-between mb-1"><span className="font-bold text-blue-600">Source #{i+1}</span><span className="text-gray-400">{(src.score * 100).toFixed(1)}%</span></div>
                                <p className="line-clamp-2 text-gray-700">{src.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    </div>
  );

  const UserQuestionBlock = ({ text }: { text: string }) => (
     <div className="flex justify-end mb-8 animate-in fade-in duration-300">
        <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-md text-lg">
            {text}
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full ml-3 flex items-center justify-center shrink-0">
            <User className="text-gray-500 w-6 h-6" />
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-slate-800 font-sans">
      
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-2">
            <div className="p-2 bg-black rounded-lg"><Bot className="w-6 h-6 text-white" /></div>
            <h1 className="text-xl font-bold text-gray-900">Zero-Server RAG Assistant</h1>
        </div>
        <div className="text-xs font-mono px-3 py-1 bg-gray-50 rounded-full border border-gray-200 text-gray-500">
            Status: <span className={status === 'Ready' || status === 'Done' ? "text-green-600 font-bold" : "text-blue-600"}>{status}</span>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
        
        {history.length === 0 && !displayQuestion && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4 opacity-50">
                <Bot size={64} /><p className="text-lg">Upload a PDF to begin chatting</p>
            </div>
        )}

        {history.map((turn, index) => (
            <div key={index}>
                <UserQuestionBlock text={turn.question} />
                <AIResponseBlock text={turn.answer} srcs={turn.sources} metrics={turn.metrics} />
            </div>
        ))}

        {displayQuestion && <UserQuestionBlock text={displayQuestion} />}
        {(answer || status === 'Thinking...') && (
             <AIResponseBlock 
                text={answer} 
                srcs={sources} 
                isThinking={status === 'Thinking...'} 
                metrics={currentMetrics || undefined} 
             />
        )}
        
        <div ref={bottomRef} />
      </main>

      <div className={`border-t border-gray-200 bg-gray-900 text-white transition-all duration-300 ease-in-out ${isLogsOpen ? 'h-48' : 'h-10'}`}>
        <div onClick={() => setIsLogsOpen(!isLogsOpen)} className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-gray-800">
            <div className="flex items-center gap-2 text-xs font-mono text-green-400"><Terminal size={14} /><span>Terminal Log</span></div>
            {isLogsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="p-4 pt-0 h-36 overflow-y-auto font-mono text-xs text-gray-300 space-y-1">
            {logs.map((log, i) => <div key={i} className="border-l-2 border-green-500 pl-2">{log}</div>)}
        </div>
      </div>

      <footer className="bg-white p-4 border-t border-gray-200">
        <div className="max-w-4xl mx-auto flex gap-3">
            <label className="flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-600 rounded-xl cursor-pointer hover:bg-blue-100 transition-colors font-medium border border-blue-200">
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} />
                <Upload size={20} className="mr-2" /><span className="hidden sm:inline">Upload PDF</span>
            </label>
            <div className="flex-1 relative">
                <input 
                    className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-800 placeholder-gray-400"
                    placeholder="Ask a question about your document..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
            </div>
            <button onClick={handleSearch} disabled={!query && status !== 'Thinking...'} className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md flex items-center">
                <Send size={20} />
            </button>
        </div>
      </footer>
    </div>
  )
}

export default App