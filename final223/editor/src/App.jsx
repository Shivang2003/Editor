import { useEffect, useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Editor from './Editor'
import EditorSample from './EditorSample'

function App() {
  const [requiredMentions, setRequiredMentions] = useState(null);

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

  return (
    <div className="bg-black">
      <Editor requiredMentions={requiredMentions} />
      {/* <EditorSample requiredMentions={requiredMentions} /> */}
    </div>
  );
}

export default App;
