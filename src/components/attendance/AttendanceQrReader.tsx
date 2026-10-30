import React, { useEffect, useRef, useState } from 'react';
import type QrScanner from 'qr-scanner';
import { Camera, Image, Square } from 'lucide-react';

function releaseScanner(reader: QrScanner | null) {
  if (!reader) return;
  void reader.pause(true); reader.destroy();
}

export const AttendanceQrReader: React.FC<{ onRead: (value: string) => void; onReset: () => void }> = ({ onRead, onReset }) => {
  const video = useRef<HTMLVideoElement>(null);
  const scanner = useRef<QrScanner | null>(null);
  const generation = useRef(0);
  const onReadRef = useRef(onRead); onReadRef.current = onRead;
  const onResetRef = useRef(onReset); onResetRef.current = onReset;
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [value, setValue] = useState('');

  const stop = () => {
    generation.current++; releaseScanner(scanner.current); scanner.current = null;
    setCameraOpen(false); setBusy(false);
  };
  useEffect(() => () => { generation.current++; releaseScanner(scanner.current); scanner.current = null; }, []);

  const startCamera = async () => {
    if (scanner.current || cameraOpen || busy) return;
    onResetRef.current();
    const request = ++generation.current;
    setError(''); setBusy(true); setCameraOpen(true);
    let active: QrScanner | null = null;
    try {
      const { default: Reader } = await import('qr-scanner');
      if (generation.current !== request || !video.current) return;
      active = new Reader(video.current, result => {
        if (generation.current !== request) return;
        stop(); onReadRef.current(result.data);
      }, { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 5 });
      scanner.current = active;
      await active.start();
      if (generation.current !== request) { releaseScanner(active); return; }
      setBusy(false);
    } catch {
      releaseScanner(active);
      if (generation.current !== request) return;
      stop(); setError('Camera unavailable or permission denied. Choose a QR image or enter the Member ID below.');
    }
  };

  const readImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    stop(); onResetRef.current(); setError('');
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a PNG, JPEG or WebP image smaller than 10 MB.'); return;
    }
    const request = ++generation.current; setBusy(true);
    try {
      const { default: Reader } = await import('qr-scanner');
      if (generation.current !== request) return;
      const result = await Reader.scanImage(file, { returnDetailedScanResult: true });
      if (generation.current !== request) return;
      onReadRef.current(result.data);
    } catch {
      if (generation.current === request) setError('No readable QR code was found. Try a clearer image or enter the Member ID.');
    } finally { if (generation.current === request) setBusy(false); }
  };

  return <section aria-label="Scan member attendance pass" className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3 text-left">
    <h2 className="text-sm font-bold">Scan a member pass</h2>
    <p className="text-xs text-slate-300">Scan the QR code, choose a saved image, or enter the exact Member ID. Confirm the member before checking in.</p>
    <div className="flex flex-wrap gap-2">
      {cameraOpen ? <button type="button" onClick={stop} className="rounded-xl border border-slate-500 px-3 py-2 text-xs font-bold inline-flex items-center gap-2"><Square className="w-4 h-4" />Stop camera</button>
        : <button type="button" onClick={() => void startCamera()} disabled={busy} className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold inline-flex items-center gap-2 disabled:opacity-50"><Camera className="w-4 h-4" />Scan with camera</button>}
      <label className={`rounded-xl border border-slate-500 px-3 py-2 text-xs font-bold inline-flex items-center gap-2 ${busy ? 'opacity-50' : 'cursor-pointer'}`}>
        <Image className="w-4 h-4" />Choose QR image
        <input type="file" aria-label="Choose QR image" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={event => void readImage(event)} className="sr-only" />
      </label>
    </div>
    <video ref={video} autoPlay muted playsInline hidden={!cameraOpen} aria-label="Attendance QR camera preview" className="max-h-64 w-full rounded-xl bg-black object-contain" />
    {busy && <p role="status" className="text-xs text-slate-300">{cameraOpen ? 'Starting camera…' : 'Reading QR image…'}</p>}
    {error && <p role="alert" className="text-xs text-amber-200">{error}</p>}
    <form onSubmit={event => { event.preventDefault(); stop(); onResetRef.current(); setError(''); onReadRef.current(value); }} className="flex flex-wrap gap-2">
      <label className="flex-1 min-w-0 text-xs font-semibold">Member pass or Member ID
        <input aria-label="Member pass or Member ID" value={value} maxLength={512} onChange={event => setValue(event.target.value)} autoComplete="off"
          className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" />
      </label>
      <button type="submit" disabled={!value.trim() || busy} className="self-end rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold disabled:opacity-50">Find pass</button>
    </form>
  </section>;
};
