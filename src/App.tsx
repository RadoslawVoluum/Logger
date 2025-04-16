import React, { useState, useEffect, useRef } from 'react';
import { Clock, Wifi, WifiOff, Save, RotateCcw, Mail } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  status: boolean;
  responseTime: number;
  ttl: number | null;
}

function App() {
  const [interval, setInterval] = useState<number>(5);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalDowntime, setTotalDowntime] = useState<number>(0);
  const [emailAddress, setEmailAddress] = useState<string>('');
  const [isEmailEnabled, setIsEmailEnabled] = useState(false);
  const timerRef = useRef<number>();
  const emailTimerRef = useRef<number>();

  const calculateTotalDowntime = (currentLogs: LogEntry[]) => {
    const offlineCount = currentLogs.filter(log => !log.status).length;
    const downtimeMs = offlineCount * interval * 1000; // Convert seconds to milliseconds
    setTotalDowntime(downtimeMs);
  };

  const checkConnection = async () => {
    const start = performance.now();
    const timestamp = new Date().toISOString();
    
    try {
      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-cache'
      });
      const end = performance.now();
      const responseTime = Math.round(end - start);
      
      const newLog: LogEntry = {
        timestamp,
        status: true,
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

  const sendLogsEmail = async () => {
    if (!emailAddress || logs.length === 0) return;

    const content = logs.map(log => 
      `${log.timestamp} | Status: ${log.status ? 'Online' : 'Offline'} | Response Time: ${log.responseTime}ms | TTL: ${log.ttl || 'N/A'}`
    ).join('\n');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          email: emailAddress,
          logs: content,
          totalDowntime: formatDuration(totalDowntime),
          downtimeSummary: generateDowntimeSummary()
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }
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
    }
    if (emailTimerRef.current) {
      clearInterval(emailTimerRef.current);
    }
  };

  const saveToFile = () => {
    const summary = `Total Downtime: ${formatDuration(totalDowntime)}\n${generateDowntimeSummary()}\n\nDetailed Logs:\n`;
    const content = summary + logs.map(log => 
      `${log.timestamp} | Status: ${log.status ? 'Online' : 'Offline'} | Response Time: ${log.responseTime}ms | TTL: ${log.ttl || 'N/A'}`
    ).join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `connection-log-${new Date().toISOString().split('T')[0]}.txt`;
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
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Wifi className="h-6 w-6" />
            Internet Connection Monitor
          </h1>
          
          <div className="flex items-center gap-4 mb-6">
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
              className="w-20 px-3 py-2 border rounded"
              disabled={isMonitoring}
            />
            <span className="text-gray-600">seconds interval</span>
            
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
              Save Logs
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

          <div className="bg-gray-50 p-4 rounded-md mb-6">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Notifications
            </h2>
            <div className="flex items-center gap-4">
              <input
                type="email"
                placeholder="Enter email address"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="flex-1 px-3 py-2 border rounded"
                disabled={isMonitoring}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isEmailEnabled}
                  onChange={(e) => setIsEmailEnabled(e.target.checked)}
                  disabled={isMonitoring}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                Enable hourly email reports
              </label>
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