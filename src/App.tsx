import { useState, useEffect, useRef } from 'react'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/rag.worker.ts', 
      import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      setLogs(prevLogs => [...prevLogs, `[${type}], ${JSON.stringify(payload)}`])

    };

  }, []);
  
  const testconn = () => {
    workerRef.current?.postMessage({ type: 'TEST_CONN'});
  };

  const listLogs = () => (
    logs.map((log, index) => (
      <li key={index}>{log}
      </li>

    )));
  
  
  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center" >
        <h1 className="text-4xl font-bold text-blue-500">
          Testing Phase 1 
        </h1>
        <br />
        <button onClick={testconn}>
          (BUTTON IS HERE)
        </button>
        <ul>
          {listLogs()}
        </ul>

       
      </div>
    </>
  )
}

export default App
