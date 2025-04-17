import React, { useState, useEffect, useRef } from 'react';
import { Clock, Wifi, WifiOff, Save, RotateCcw, Mail } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  status: boolean;
  responseTime: number;
  ttl: number | null;
}

function App() {
  const [interval, setInterval] = useState<number>(5); // seconds
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalDowntime, setTotalDowntime] = useState<number>(0);
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [isEmailEnabled, setIsEmailEnabled] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);
  const emailTimerRef = useRef<number | null>(null);

  const calculateTotalDowntime = (currentLogs: LogEntry[]) => {
    const offlineCount = currentLogs.filter(log => !log.status).length;
    const downtimeMs = offlineCount * interval * 1000; // seconds to ms
    setTotalDowntime(downtimeMs);
  };

  const checkConnection = async () => {
    const start = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-cache',
      });

      const end = performance.now();
      const responseTime = Math.round(end - start);

      const newLog: LogEntry = {
        timestamp,
        status: true,
        responseTime,
        ttl: 64,
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
    let summary = '';
    let currentSequence: LogEntry[] = [];
    let sequences: { start: string; count: number }[] = [];

    logs.forEach((log, index) => {
      if (!log.status) {
        if (currentSequence.length === 0) {
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
        const endTime = new Date(new Date(seq.start).getTime() + duration * 1000).toLocaleString();
        summary += `${index + 1}. From ${startTime} to ${endTime} (${formatDuration(duration * 1000)})\n`;
      });
    }

    return summary;
  };

  const sendLogsEmail = async () => {
    if (!emailAddress || logs.length === 0) return;

    const content = logs
      .map(
        log =>
          `${log.timestamp} | Status: ${log.status ? 'Online' : 'Offline'} | Response Time: ${log.responseTime}ms | TTL: ${
            log.ttl ?? 'N/A'
          }`
      )
      .join('\n');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: emailAddress,
          logs: content,
          totalDowntime: formatDuration(totalDowntime),
          downtimeSummary: generateDowntimeSummary(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    checkConnection();
    timerRef.current = window.setInterval(checkConnection, interval * 1000);

    if (isEmailEnabled && emailAddress) {
      emailTimerRef.current = window.setInterval(sendLogsEmail, 60 * 60 * 1000);
    }
  };

  const stopMonitoring = () => {
    setIsMonitoring(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (emailTimerRef.current) {
      clearInterval(emailTimerRef.current);
      emailTimerRef.current = null;
    }
  };

  const saveToFile = () => {
    const summary = `Total Downtime: ${formatDuration(totalDowntime)}\n${generateDowntimeSummary()}\n\nDetailed Logs:\n`;
    const content =
      summary +
      logs
        .map(
          log =>
            `${log.timestamp} | Status: ${log.status ? 'Online' : 'Offline'} | Response Time: ${log.responseTime}ms | TTL: ${
              log.ttl ?? 'N/A'
            }`
        )
        .join('\n');

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
  };

  const clearLogs = () => {
    setLogs([]);
    setTotalDowntime(0);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (emailTimerRef.current) {
        clearInterval(emailTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Internet Connection Monitor</h1>

      <div className="flex items-center mb-4">
        <input
          type="text"
          value={pingUrl}
          onChange={e => setPingUrl(e.target.value)}
          placeholder="Enter URL to ping"
          className="flex-1 px-3 py-2 border rounded"
          disabled={isMonitoring}
        />
        <input
          type="number"
          value={interval}
          onChange={e => setInterval(Number(e.target.value))}
          className="w-20 px-3 py-2 border rounded ml-2"
          disabled={isMonitoring}
          min={1}
        />
        <span className="ml-2">seconds interval</span>
      </div>

      <div className="mb-4">
        <button
          onClick={isMonitoring ? stopMonitoring : startMonitoring}
          className={`px-4 py-2 rounded ${isMonitoring ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
        >
          {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
        </button>
        <button onClick={saveToFile} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded">
          <Save size={16} /> Save Logs
        </button>
        <button onClick={clearLogs} className="ml-2 px-4 py-2 bg-gray-500 text-white rounded">
          <RotateCcw size={16} /> Clear Logs
        </button>
      </div>

      <div className="mb-4">
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            checked={isEmailEnabled}
            onChange={e => setIsEmailEnabled(e.target.checked)}
            disabled={isMonitoring}
            className="form-checkbox h-5 w-5 text-blue-600"
          />
          <span className="ml-2">Enable hourly email reports</span>
        </label>
        {isEmailEnabled && (
          <input
            type="email"
            value={emailAddress}
            onChange={e => setEmailAddress(e.target.value)}
            placeholder="Enter email address"
            className="mt-2 px-3 py-2 border rounded w-full"
            disabled={isMonitoring}
          />
        )}
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Total Downtime</h2>
        <p>{formatDuration(totalDowntime)}</p>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Current Status</h2>
        <p>{logs.length > 0 ? (logs[logs.length - 1].status ? 'Online' : 'Offline') : 'No data'}</p>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr>
            <th className="border border-gray-300 px-2 py-1">Timestamp</th>
            <th className="border border-gray-300 px-2 py-1">Status</th>
            <th className="border border-gray-300 px-2 py-1">Response Time</th>
            <th className="border border-gray-300 px-2 py-1">TTL</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => (
            <tr key={index}>
              <td className="border border-gray-300 px-2 py-1">{new Date(log.timestamp).toLocaleStrin
