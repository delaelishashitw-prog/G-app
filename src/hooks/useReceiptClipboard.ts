import { useEffect, useRef, useState } from 'react';
import { useToast } from '../contexts/ToastContext';

export function useReceiptClipboard(recordId: string) {
  const { success, error } = useToast();
  const [copied, setCopied] = useState(false), [copying, setCopying] = useState(false);
  const lock = useRef(false), alive = useRef(true), owner = useRef(recordId), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  owner.current = recordId;
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => { setCopied(false); }, [recordId]);
  const copyText = async (text: string, title: string) => {
    if (lock.current) return;
    const actor = recordId;
    lock.current = true; setCopying(true); setCopied(false);
    if (timer.current) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      if (!alive.current || owner.current !== actor) return;
      setCopied(true); success(title, 'The details were copied to your clipboard.');
      timer.current = setTimeout(() => { if (alive.current && owner.current === actor) setCopied(false); }, 2500);
    } catch {
      if (alive.current && owner.current === actor) error('Copy failed', 'Your clipboard could not be updated. Try again or use Print / Save as PDF.');
    } finally { lock.current = false; if (alive.current) setCopying(false); }
  };
  return { copied, copying, copyText };
}
