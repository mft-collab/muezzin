import { useState, useEffect } from 'react';
import { getTurkeyNow } from '../lib/dateUtils';

/**
 * useTime — Global synchronized clock hook.
 * Syncs with the system clock to provide a 1s tick exactly at the second mark.
 */
export function useTime() {
  const [now, setNow] = useState(getTurkeyNow());

  useEffect(() => {
    // Calculate ms until the next second
    const msToNextSecond = 1000 - new Date().getMilliseconds();
    
    let interval: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      setNow(getTurkeyNow());
      interval = setInterval(() => {
        setNow(getTurkeyNow());
      }, 1000);
    }, msToNextSecond);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return now;
}

/**
 * useMinuteTick — Synchronized minute watcher.
 */
export function useMinuteTick() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    let interval: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      setTick(t => t + 1);
      interval = setInterval(() => setTick(t => t + 1), 60000);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return tick;
}
