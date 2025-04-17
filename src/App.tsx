import React, { useState, useEffect, useRef } from 'react';
import { Clock, Wifi, WifiOff, Save, RotateCcw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  status: boolean;
  responseTime: number;
  ttl: number | null;
}

function App() {
  const [interval, setInterval] = useState<number>(5);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(5);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalDowntime, setTotalDowntime] = useState<number>(0);
  const [pingUrl, setPingUrl] = useState<string>('https://www.google.com/favicon.ico');
  const timerRef = useRef<number>();
  const autoSaveTimerRef = useRef<number>();

  const calculateTotalDowntime = (currentLogs: LogEntry[]) => {
    const offlineCount = currentLogs.filter(log => !log.status).length;
    const downtimeMs = offlineCount * interval * 1000;
    setTotalDowntime(downtimeMs);
  };

 const checkConnection = async () => {
  const start = performance.now();
  const timestamp = new Date().toISOString();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), interval * 1000);

    const response = await fetch('https://www.google.com/favicon.ico', {
      mode: 'no-cors',
      cache: 'no-cache',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    const end = performance.now();
    const responseTime = Math.round(end - start);

    // Mark as offline if response took longer than interval
    const status = responseTime <= interval * 1000;
    
    const newLog: LogEntry = {
      timestamp,
      status,
      responseTime,
      ttl: 64
    };

    setLogs(prev => {
      const updatedLogs = [...prev, newLog];
      calculateTotalDowntime(updatedLogs);
      return updatedLogs;
    });

  } catch (error) {
    const end = performance.now();
    const responseTime = Math.round(end - start);
    
    const newLog: LogEntry = {
      timestamp,
      status: false,
      responseTime,
      ttl: null
    };

    setLogs(prev => {
      const updatedLogs = [...prev, newLog];
      calculateTotalDowntime(updatedLogs);
      return updatedLogs;
    });
  }
};

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const remainingHours = hours % 24;
    const remainingMinutes = minutes % 60;
    const remainingSeconds = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (remainingHours > 0) parts.push(`${remainingHours}h`);
    if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds}s`);

    return parts.join(' ') || '0s';
  };

  const generateDowntimeSummary = () => {
    let summary = '';
    let currentSequence: LogEntry[] = [];
    let sequences: { start: string; count: number }[] = [];

    logs.forEach((log, index) => {
      if (!log.status) {
        if (currentSequence.length === 0 || index === 0) {
          sequences.push({ start: log.timestamp, count: 1 });
          currentSequence = [log];
        } else {
          sequences[sequences.length - 1].count++;
          currentSequence.push(log);
        }
      } else {
        currentSequence = [];
      }
    });

    if (sequences.length > 0) {
      summary = '\nDowntime Periods:\n';
      sequences.forEach((seq, index) => {
        const duration = seq.count * interval;
        const startTime = new Date(seq.start).toLocaleString();
        const endTime = new Date(new Date(seq.start).getTime() + (duration * 1000)).toLocaleString();
        summary += `${index + 1}. From ${startTime} to ${endTime} (${formatDuration(duration * 1000)})\n`;
      });
    }

    return summary;
  };

 const saveToFile = (logsToSave: LogEntry[]) => {
  const summary = `Total Downtime: ${formatDuration(totalDowntime)}\n${generateDowntimeSummary()}\n\nDetailed Logs:\n`;
  const content = summary + logsToSave.map(log => 
    `${log.timestamp} | Status: ${log.status ? 'Online' : 'Offline'} | Response Time: ${log.responseTime}ms | TTL: ${log.ttl || 'N/A'}`
  ).join('\n');
  
  // Rest of your existing save logic...
};

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-log-${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Clear logs after saving
    clearLogs();
  };

  const clearLogs = () => {
    setLogs([]);
    setTotalDowntime(0);
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    checkConnection();
    timerRef.current = window.setInterval(checkConnection, interval * 1000);
    
    if (autoSaveInterval > 0) {
      autoSaveTimerRef.current = window.setInterval(saveToFile, autoSaveInterval * 60 * 1000);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
  };

  useEffect(() => {
  let autoSaveInterval: NodeJS.Timeout;

  const startAutoSave = () => {
    autoSaveInterval = setInterval(() => {
      if (logs.length === 0) return;

      // Capture current logs before clearing
      const logsToSave = [...logs];
      
      // Save captured logs
      saveToFile(logsToSave);
      
      // Clear logs only after successful save
      setLogs([]);
    }, saveInterval * 60 * 1000);
  };

  startAutoSave();
  return () => clearInterval(autoSaveInterval);
}, [saveInterval, logs]); // Reset interval when interval time or logs change
  
  useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (logs.length > 0) {
      saveToFile();
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}, [logs, totalDowntime]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Wifi className="h-6 w-6" />
            Internet Connection Monitor
          </h1>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={pingUrl}
                onChange={(e) => setPingUrl(e.target.value)}
                placeholder="Enter URL to ping"
                className="flex-1 px-3 py-2 border rounded"
                disabled={isMonitoring}
              />
            </div>
            
            <div className="flex items-center gap-4">
              <input
                type="number"
                min="1"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-20 px-3 py-2 border rounded"
                disabled={isMonitoring}
              />
              <span className="text-gray-600">seconds interval</span>
            </div>

            <div className="flex items-center gap-4">
              <select
                value={autoSaveInterval}
                onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                className="px-3 py-2 border rounded"
                disabled={isMonitoring}
              >
                <option value={5}>Auto-save every 5 minutes</option>
                <option value={10}>Auto-save every 10 minutes</option>
                <option value={15}>Auto-save every 15 minutes</option>
                <option value={30}>Auto-save every 30 minutes</option>
                <option value={45}>Auto-save every 45 minutes</option>
                <option value={60}>Auto-save every 60 minutes</option>
                <option value={90}>Auto-save every 90 minutes</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={isMonitoring ? stopMonitoring : startMonitoring}
                className={`px-4 py-2 rounded-md ${
                  isMonitoring 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
              </button>
              
              <button
                onClick={saveToFile}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2"
                disabled={logs.length === 0}
              >
                <Save className="h-4 w-4" />
                Save Logs Now
              </button>
              
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center gap-2"
                disabled={logs.length === 0}
              >
                <RotateCcw className="h-4 w-4" />
                Clear Logs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-md">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Total Downtime
              </h2>
              <p className="text-xl font-mono">{formatDuration(totalDowntime)}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-md">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <WifiOff className="h-5 w-5" />
                Current Status
              </h2>
              <p className={`text-xl ${logs[logs.length - 1]?.status ? 'text-green-600' : 'text-red-600'}`}>
                {logs[logs.length - 1]?.status ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          <div className="overflow-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Timestamp</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Response Time</th>
                  <th className="px-4 py-2 text-left">TTL</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-4 py-2 font-mono text-sm">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className={`px-4 py-2 ${log.status ? 'text-green-600' : 'text-red-600'}`}>
                      {log.status ? 'Online' : 'Offline'}
                    </td>
                    <td className="px-4 py-2">{log.responseTime}ms</td>
                    <td className="px-4 py-2">{log.ttl || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
