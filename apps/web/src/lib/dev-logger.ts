export interface DevLog {
  id: number;
  ts: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  detail?: string;
}

type Listener = (logs: DevLog[]) => void;

let _id = 0;
let _logs: DevLog[] = [];
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((fn) => fn([..._logs]));
}

export const devLogger = {
  push(level: DevLog['level'], message: string, detail?: string) {
    _logs = [{ id: ++_id, ts: new Date().toLocaleTimeString('ko-KR'), level, message, detail }, ..._logs].slice(0, 50);
    notify();
  },
  subscribe(fn: Listener) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
  clear() {
    _logs = [];
    notify();
  },
  getLogs: () => [..._logs],
};
