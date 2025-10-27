import { useState, useEffect } from "react";
import PromptForm from "./components/PromptForm";
import ModelViewer from "./components/ModelViewer";
import { getJobStatus } from "./api/api";

function App() {
  const [jobId, setJobId] = useState(null);
  const [modelUrl, setModelUrl] = useState(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      const data = await getJobStatus(jobId);
      setStatus(data.status);
      if (data.status === "done") {
        setModelUrl(data.output_url);
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>🧪 Chem3D Generator</h1>
      <PromptForm onJobCreated={(id) => setJobId(id)} />

      {status && <p>Status: {status}</p>}

      <ModelViewer modelUrl={modelUrl} />
    </div>
  );
}

export default App;
