import { useState } from 'react'
import Worker from 'src\workers\rag.worker.ts'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [templogdata, setTemplogdata] = useState<string>();
  const workerRef = useRef<Worker | null>(null);

  UseEffect(() => {
    workerRef.current = new Worker(new URL('src\workers\rag.worker.ts', 
      import.meta.url), {type = 'module'});

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      setLogs(prevLogs => [...prevLogs, `[${type}], ${JSON.stringify(payload)}`])

    };
    }


  ))





  return (
    <>
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <h1 className="text-4xl font-bold text-blue-500">
          Testing Phrase 1 
        </h1>
       
      </div>
    </>
  )
}

export default App
