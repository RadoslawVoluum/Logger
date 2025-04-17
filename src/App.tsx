import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  status: boolean;
  responseTime: number;
  ttl: number | null;
}

function App() {
  const [pingDelay, setPingDelay] = useState<number>(15); // seconds between pings
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(5); // minutes between auto-saves
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalDowntime, setTotalDowntime] = useState<number>(0);
  const [pingUrl, setPingUrl] = useState<string>('https://www.google.com/favicon.ico');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTotalDowntime = (currentLogs: LogEntry[]) => {
    const offlineCount = currentLogs.filter(log => !log.status).length;
    const downtimeMs = offlineCount * pingDelay * 1000;
    setTotalDowntime(downtimeMs);
  };

  const checkConnection = async () => {
    const start = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), pingDelay * 1000);

      const response = await fetch(pingUrl, {
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const end = performance.now();
      const responseTime = Math.round(end - start);

      const status = responseTime <= pingDelay * 1000;

      const newLog: LogEntry = {
        timestamp,
        status,
        responseTime,
        ttl: 64,
      };

      setLogs(prev => {
        const updatedLogs = [...prev, newLog];
        calculateTotalDowntime(updatedLogs);
        return updatedLogs;
      });
    } catch {
      const end = performance.now();
      const responseTime = Math.round(end - start);

      const newLog: LogEntry = {
        timestamp,
        status: false,
        responseTime,
        ttl: null,
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
    let summary = '\nDowntime Periods:\n';
    let sequences: { start: string; count: number }[] = [];
    let isInDowntime = false;

    logs.forEach((log, index) => {
      if (!log.status) {
        if (!isInDowntime) {
          sequences.push({ start: log.timestamp, count: 1 });
          isInDowntime = true;
        } else {
          sequences[sequences.length - 1].count++;
        }
      } else {
        isInDowntime = false;
      }
    });

    sequences.forEach((seq, index) => {
      const duration = seq.count * pingDelay;
      const startTime = new Date(seq.start).toLocaleString();
      summary += `${index + 1}. Start: ${startTime}, Duration: ${duration}s\n`;
    });

    return summary || 'No downtimes recorded.';
  };

  useEffect(() => {
    if (isMonitoring) {
      checkConnection(); // immediate ping
      timerRef.current = setInterval(checkConnection, pingDelay * 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isMonitoring, pingDelay]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Ping Monitor</h1>
      <div className="mb-2">
        <label className="block">Ping URL:</label>
        <input
          className="border px-2 py-1 w-full"
          value={pingUrl}
          onChange={(e) => setPingUrl(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => setIsMonitoring(!isMonitoring)}
        >
          {isMonitoring ? 'Stop' : 'Start'} Monitoring
        </button>
      </div>
      <div className="mb-2">
        <p>Total Downtime: {formatDuration(totalDowntime)}</p>
        <pre className="bg-gray-100 p-2 mt-2">{generateDowntimeSummary()}</pre>
      </div>
    </div>
  );
}

export default App;
