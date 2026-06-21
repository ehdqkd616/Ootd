import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { devLogger, DevLog } from '@/lib/dev-logger';
import { cn } from '@/lib/utils';

export function DevLogPanel() {
  const [logs, setLogs] = useState<DevLog[]>(() => devLogger.getLogs());
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const unsub = devLogger.subscribe(setLogs);
    return () => { unsub(); };
  }, []);

  if (!import.meta.env.DEV) return null;

  const errorCount = logs.filter((l) => l.level === 'error').length;

  return (
    <div className="fixed bottom-0 right-0 z-50 w-[420px] max-w-[calc(100vw-1rem)] font-mono text-xs shadow-2xl">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-white transition-colors',
          errorCount > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-800 hover:bg-zinc-700',
        )}
      >
        <span className="font-semibold">
          Dev Logs
          {logs.length > 0 && (
            <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5">
              {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : `${logs.length}`}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); devLogger.clear(); }}
            className="rounded p-0.5 hover:bg-white/20"
            title="Clear"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </div>
      </button>

      {/* Log list */}
      {open && (
        <div className="max-h-72 overflow-y-auto bg-zinc-900">
          {logs.length === 0 ? (
            <p className="px-3 py-4 text-center text-zinc-500">로그가 없습니다.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={cn(
                  'border-b border-zinc-800 px-3 py-1.5 cursor-pointer hover:bg-zinc-800',
                  log.level === 'error' && 'text-red-400',
                  log.level === 'warn' && 'text-yellow-400',
                  log.level === 'info' && 'text-zinc-300',
                )}
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="shrink-0 text-zinc-500">{log.ts}</span>
                  <span className="break-all">{log.message}</span>
                </div>
                {expanded === log.id && log.detail && (
                  <pre className="mt-1 whitespace-pre-wrap break-all text-zinc-400">{log.detail}</pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
