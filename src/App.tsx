import React, { useState, useEffect, useRef } from 'react';
import { Save, RotateCcw } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  status: boolean;
  responseTime: number;
  ttl: number | null;
}

function App() {
  const [interval, setInterval] = useState<number>(15); // seconds between pings
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(5); // minutes between auto-saves
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [totalDowntime, setTotalDowntime] = useState<number>(0);
  const [pingUrl, setPingUrl] = useState<string>('https://www.google.com/favicon.ico');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate total downtime in ms
  const calculateTotalDowntime = (currentLogs: LogEntry[]) => {
    const offlineCount = currentLogs.filter(log => !log.status).length;
    const downtimeMs = offlineCount * interval * 1000;
    setTotalDowntime(downtimeMs);
  };

  // Ping logic
  const checkConnection = async () => {
    const start = performance.now();
    const timestamp = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), interval * 1000);

      const response = await fetch(pingUrl, {
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
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

  // Format ms as human readable
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

  // Generate downtime summary
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
        const startTime = new Date
