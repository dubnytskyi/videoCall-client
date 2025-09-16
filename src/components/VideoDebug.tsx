import { useState, useEffect } from "react";
import { fetchTwilioToken } from "../lib/twilioToken";

export default function VideoDebug() {
  const [logs, setLogs] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        addLog("Starting connection test...");
        
        // Test token generation
        addLog("Testing token generation...");
        const testToken = await fetchTwilioToken("debug-test", "notary-room");
        setToken(testToken);
        addLog("✅ Token generated successfully");
        
        // Test API endpoint
        addLog("Testing API endpoint...");
        const response = await fetch("https://video-call-azure-two.vercel.app/api/health");
        const healthData = await response.json();
        addLog(`✅ API health check: ${JSON.stringify(healthData)}`);
        
        addLog("✅ All tests passed!");
        
      } catch (err: any) {
        addLog(`❌ Error: ${err.message}`);
        setError(err.message);
      }
    };

    testConnection();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Video Debug Console</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <h2 className="font-semibold mb-2">Connection Status</h2>
        <div className="space-y-2">
          <div>Token: {token ? "✅ Generated" : "❌ Failed"}</div>
          <div>API: ✅ Connected</div>
          <div>Error: {error || "None"}</div>
        </div>
      </div>

      <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>

      <div className="mt-4 space-x-2">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Refresh Test
        </button>
        <button
          onClick={() => setLogs([])}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}