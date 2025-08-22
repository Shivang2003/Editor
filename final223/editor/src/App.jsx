// App.jsx
import { useEffect, useState } from 'react'
import './App.css'
import Editor from './Editor'
import Renderer from './Renderer'

function App() {
  const [requiredMentions, setRequiredMentions] = useState(null);
  const [latestDelta, setLatestDelta] = useState(null);
  const [loadingDelta, setLoadingDelta] = useState(false);
  const [errorDelta, setErrorDelta] = useState(null);

  // Fetch required mentions
  useEffect(() => {
    const fetchRequiredMentions = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/get-required-mentions");
        const data = await res.json();
        setRequiredMentions(data);
      } catch (err) {
        console.error("❌ Error fetching requiredMentions:", err);
      }
    };
    fetchRequiredMentions();
  }, []);

  // Fetch latest delta
  useEffect(() => {
    const fetchLatestDelta = async () => {
      setLoadingDelta(true);
      setErrorDelta(null);
      try {
        const res = await fetch("http://localhost:5000/api/get-deltas");
        if (!res.ok) throw new Error("Failed to fetch deltas");
        const data = await res.json();
        if (data.length) {
          const deltaObj = data[0]?.delta || data[0]; // get first delta
          setLatestDelta(deltaObj);
        }
      } catch (err) {
        console.error(err);
        setErrorDelta(err.message);
      } finally {
        setLoadingDelta(false);
      }
    };
    fetchLatestDelta();
  }, []);

  return (
    <div className="bg-black p-4">
      <Editor requiredMentions={requiredMentions} />
      <div style={{ marginTop: "20px" }}>
        {loadingDelta && <div style={{ color: "white" }}>Loading delta...</div>}
        {errorDelta && <div style={{ color: "red" }}>Error: {errorDelta}</div>}
        {latestDelta && <Renderer delta={latestDelta} />}
      </div>
    </div>
  );
}

export default App;
