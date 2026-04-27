import { useState, useRef, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

type Status = "idle" | "listening" | "processing" | "unsupported";

interface Props {
  onTranscript: (text: string) => void;
  label?: string;
}

export function VoiceButton({ onTranscript, label = "Voz" }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [preview, setPreview] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) { setStatus("unsupported"); return; }

    const rec = new SpeechRec();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setPreview(text);
      setStatus("processing");
      setTimeout(() => {
        onTranscript(text);
        setStatus("idle");
        setPreview("");
      }, 600);
    };

    rec.onerror = () => setStatus("idle");
    rec.onend   = () => setStatus((s) => (s === "listening" ? "idle" : s));

    recRef.current = rec;
  }, []);

  if (status === "unsupported") return null;

  const toggle = () => {
    if (status === "listening") {
      recRef.current?.stop();
      setStatus("idle");
    } else {
      try {
        recRef.current?.start();
        setStatus("listening");
        setPreview("");
      } catch {}
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title="Adicionar por voz"
        className={[
          "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all active:scale-95",
          status === "listening"
            ? "bg-primary text-white border-primary shadow-md shadow-primary/30 animate-pulse"
            : status === "processing"
            ? "bg-primary/15 text-primary border-primary/40"
            : "bg-card text-muted-foreground border hover:text-foreground hover:border-primary/40",
        ].join(" ")}
      >
        {status === "listening" ? (
          <><MicOff className="w-4 h-4" /><span className="hidden sm:inline">Parar</span></>
        ) : status === "processing" ? (
          <><Mic className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">...</span></>
        ) : (
          <><Mic className="w-4 h-4" /><span className="hidden sm:inline">{label}</span></>
        )}
      </button>

      {/* Anel de pulsação */}
      {status === "listening" && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
      )}

      {/* Transcrição em tempo real */}
      {preview && (
        <div className="absolute top-full mt-1.5 right-0 z-50 bg-sidebar text-sidebar-foreground text-xs px-3 py-2 rounded-lg shadow-lg max-w-[220px] border border-sidebar-border leading-relaxed">
          "{preview}"
        </div>
      )}
    </div>
  );
}
