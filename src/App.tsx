import { useState, useEffect, useRef } from 'react'

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [file, setFileUpload] = useState(null);
  const [pdfText, setPDFText] = useState([]);
  const [VectorOutput, setVectorOutput] = useState<number[][]>([]);
  const workerRef = useRef<Worker | null>(null);


  useEffect(() => {
    if (!workerRef.current){
      workerRef.current = new Worker(new URL('./workers/rag.worker.ts', 
      import.meta.url), { type: 'module' });
    }

    workerRef.current.onmessage = (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'PARSE-PDF':
          {
            setPDFText(prevPDFText => [...prevPDFText, payload])
            setLogs(prevLogs => [...prevLogs, `[${type}], rendered the pdf successfully`])
            break;
          }
        case 'VECTOR-OUTPUT':
          {setVectorOutput(prevOutput => [...prevOutput, payload])}
          {setLogs(prevLogs => [...prevLogs, `[${type}], converted to embeddings`])}
        default:
        {
           setLogs(prevLogs => [...prevLogs, `[${type}], ${JSON.stringify(payload)}`])
           break;
        }
      
      }
    };
    
    return () => workerRef.current?.terminate();

  }, []);
  
  const testconn = () => {
    workerRef.current?.postMessage({ type: 'TEST_CONN'});
  };

  const listLogs = () => (
    logs.map((log, index) => (
      <li key={index}>{log}
      </li>

    )));
  
  const showPdf = () => (
    pdfText.map((text, index) => (
      <li key={index}> {text} </li>
    )
  ));  
  
  const showVector = () => (
    VectorOutput.map((vector, index) => (
      <li key={index}> {vector} </li>
    )
  ));  
  

  const handleFileUpload = async (event) => {
    if (!event.target.files[0]) return;
    setFileUpload(event.target.files[0]);
    const fileBuffer = await event.target.files[0].arrayBuffer();

    workerRef.current?.postMessage({
      type:'PARSE-PDF',
      payload: fileBuffer,
    });

  }
  
  
  return (
    <>
      <div className="min-h-60 bg-gray-900 text-white flex flex-col items-center justify-center" >
        <h1 className="text-4xl font-bold text-blue-500">
          Testing Phase 3
        </h1>
        <br />

        <label className= "... cursor-pointer">
          Upload PDF
          <input
            type = 'file'
            accept = '.PDF'
            className = 'hidden'
            onChange={handleFileUpload}
            />
        </label>
        <button onClick={testconn}>
          (BUTTON IS HERE)
        </button>
        <ul>
          {listLogs()}
        </ul>
      </div>

      <div className='flex flex-col text-center items-center justify-center min-h-6 whitespace-pre-wrap'>
        <h1 className='text-center text-6xl'>
          PDF Viewer
        </h1>
        <ul>
          {showPdf()}
        </ul>
        <ul>
          {showVector()}
        </ul>
      </div>
    </>
  )
}

export default App
