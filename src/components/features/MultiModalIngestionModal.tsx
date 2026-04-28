import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrainCircuit, ImagePlus, Loader2, X, UploadCloud } from 'lucide-react';
import { processSocialMediaSignal } from '../../utils/agenticIngestion';
import { useData } from '../../context/DataContext';

type Props = Readonly<{
  open: boolean;
  onClose: () => void;
}>;

const BASE_STEPS = [
  'Initializing Agents...',
  'Agent 1: Extracting Text NER...',
  'Agent 2: Running Vision Model...',
  'Agent 3: Synthesizing Event...',
  'Injecting Event Into Active Pipeline...',
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result;
      if (typeof raw !== 'string') {
        reject(new Error('Unsupported image format'));
        return;
      }
      const result = raw;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function MultiModalIngestionModal({ open, onClose }: Props) {
  const { addSyntheticEvent, addToast } = useData();
  const [postText, setPostText] = useState(
    'Unverified local post: Water level rising near central transit underpass in Mumbai; vehicles stranded and shop shutters down.'
  );
  const [imageName, setImageName] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const canRun = useMemo(() => postText.trim().length > 12 && !isRunning, [postText, isRunning]);

  const appendStep = (line: string, delayMs: number) =>
    new Promise<void>((resolve) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, line]);
        resolve();
      }, delayMs);
    });

  const handleImagePick = async (file?: File) => {
    if (!file) return;
    try {
      const b64 = await fileToBase64(file);
      setImageBase64(b64);
      setImageName(file.name);
      setLogs((prev) => [...prev, `Image loaded: ${file.name}`]);
    } catch {
      setError('Could not process image file.');
    }
  };

  const runVerification = async () => {
    if (!canRun) return;
    setError('');
    setIsRunning(true);
    setLogs([]);
    try {
      for (let i = 0; i < BASE_STEPS.length; i++) {
        await appendStep(BASE_STEPS[i], i === 0 ? 120 : 280);
      }
      const result = await processSocialMediaSignal(postText, imageBase64);
      const injected = addSyntheticEvent(result);
      setLogs((prev) => [
        ...prev,
        `Result: ${injected.title}`,
        `City: ${injected.city} | Severity: ${injected.severity} | Category: ${injected.category}`,
        'Early warning successfully injected.',
      ]);
      addToast('Early Warning Generated & Injected to Pipeline.', 'success');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError('Verification failed. Ollama may be unavailable or timed out.');
      setLogs((prev) => [...prev, `ERROR: Unable to complete autonomous verification. ${message}`]);
      addToast('Aegis verification failed. Check local Ollama service.', 'warning');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[3200] bg-black/70 backdrop-blur-sm p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="mx-auto h-full max-h-[760px] w-full max-w-6xl rounded-2xl border border-slate-700/70 bg-gray-900/80 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
                  <BrainCircuit className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wide text-slate-100">Aegis Multi-Modal Ingestion</h2>
                  <p className="text-[11px] text-slate-400">Pre-news autonomous verification pipeline</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
              <div className="p-5 border-r border-slate-700/50 overflow-y-auto custom-scrollbar">
                <div className="text-[11px] uppercase tracking-widest text-cyan-400 font-bold mb-3">Input Console</div>
                <label htmlFor="aegis-social-post" className="text-xs text-slate-400 font-medium">Social Post</label>
                <textarea
                  id="aegis-social-post"
                  value={postText}
                  onChange={(e) => setPostText(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded-xl bg-slate-950/70 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-cyan-500/50"
                />

                <div className="mt-4">
                  <label htmlFor="aegis-image-input" className="text-xs text-slate-400 font-medium">Image Evidence</label>
                  <label className="mt-1 flex items-center justify-center gap-2 h-28 rounded-xl border border-dashed border-slate-600 bg-slate-950/40 cursor-pointer hover:border-cyan-500/60 transition-colors">
                    <UploadCloud className="w-5 h-5 text-slate-400" />
                    <span className="text-xs text-slate-400">{imageName || 'Upload / drop image'}</span>
                    <input
                      id="aegis-image-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImagePick(e.target.files?.[0])}
                    />
                  </label>
                </div>

                <button
                  disabled={!canRun}
                  onClick={runVerification}
                  className="mt-5 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  Run Autonomous Verification
                </button>
                {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}
              </div>

              <div className="p-5 min-h-0 flex flex-col">
                <div className="text-[11px] uppercase tracking-widest text-cyan-400 font-bold mb-3">Agentic Terminal</div>
                <div className="flex-1 min-h-[260px] rounded-xl border border-slate-700 bg-slate-950/70 p-3 overflow-auto font-mono text-[12px] text-slate-300 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {logs.map((line, i) => (
                      <motion.div
                        key={`${line}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, delay: i * 0.02 }}
                        className="mb-1"
                      >
                        <span className="text-cyan-500 mr-2">{'>'}</span>{line}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {!isRunning && logs.length === 0 && (
                    <div className="text-slate-500">
                      Idle. Submit social post + optional image to run multi-agent verification.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
