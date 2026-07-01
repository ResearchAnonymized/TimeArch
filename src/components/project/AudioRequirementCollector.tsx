import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Upload,
  Square,
  Play,
  Pause,
  Loader2,
  Users,
  MessageSquare,
  FileAudio,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Volume2,
  Waves,
  CheckCircle2,
  Quote,
  UserCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { HelpTip } from "./HelpTip";
import { toast } from "sonner";
import { getRequiredAccessToken } from "@/lib/authenticated-functions";

// ── Types ──────────────────────────────────────
interface Speaker {
  id: string;
  estimated_role: string;
  contribution_summary: string;
  key_points: string[];
  speaking_proportion: string;
}

interface DiscussionSegment {
  speaker_id: string;
  topic: string;
  content_summary: string;
  key_quotes: string[];
  requirements_mentioned: string[];
}

interface Disagreement {
  id: string;
  topic: string;
  positions: { speaker: string; position: string }[];
  resolution_status: string;
}

interface ActionItem {
  id: string;
  description: string;
  assigned_to: string;
  priority: string;
}

interface DiscussionAnalysis {
  total_speakers: number;
  meeting_type: string;
  key_topics: string[];
  duration_estimate: string;
  overall_sentiment: string;
}

export interface AudioExtractionResult {
  discussion_analysis?: DiscussionAnalysis;
  speakers?: Speaker[];
  discussion_segments?: DiscussionSegment[];
  disagreements?: Disagreement[];
  action_items?: ActionItem[];
  // Standard requirement fields (same as ExtractedData)
  system_goal?: string;
  business_context?: string;
  stakeholders?: any[];
  functional_requirements?: any[];
  non_functional_requirements?: any[];
  constraints?: any[];
  assumptions?: any[];
  integrations?: any[];
  business_rules?: any[];
  actors?: any[];
  ambiguities?: any[];
  contradictions?: any[];
  missing_information?: any[];
  processing_summary?: any;
  parse_error?: boolean;
  raw_output?: string;
}

interface Props {
  projectId: string;
  existingRequirements: { id: string; title: string }[];
  onResult: (data: AudioExtractionResult) => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
}

// ── Waveform Visualizer ──────────────────────────
function WaveformVisualizer({
  stream,
  isRecording,
}: {
  stream: MediaStream | null;
  isRecording: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyzerRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyzer = ctx.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);
    analyzerRef.current = analyzer;

    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d")!;
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      animRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = "transparent";
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        const hue = 220 + (dataArray[i] / 255) * 20;
        canvasCtx.fillStyle = `hsla(${hue}, 70%, 55%, 0.8)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      ctx.close();
    };
  }, [stream, isRecording]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={60}
      className="w-full h-[60px] rounded-md bg-secondary/30"
    />
  );
}

// ── Recording Timer ──────────────────────────────
function RecordingTimer({ isRecording, startTime }: { isRecording: boolean; startTime: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => setElapsed(Date.now() - startTime), 100);
    return () => clearInterval(interval);
  }, [isRecording, startTime]);

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  return (
    <span className="font-mono text-sm tabular-nums text-destructive">
      {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
    </span>
  );
}

// ── Speaker Card ─────────────────────────────────
function SpeakerCard({ speaker, segments }: { speaker: Speaker; segments: DiscussionSegment[] }) {
  const [open, setOpen] = useState(false);
  const speakerSegments = segments.filter((s) => s.speaker_id === speaker.id);
  const roleColors: Record<string, string> = {
    "Product Owner": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    Developer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    Architect: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    "Business Analyst": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    "QA Engineer": "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    "End User": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  };
  const colorClass =
    Object.entries(roleColors).find(([k]) =>
      speaker.estimated_role.toLowerCase().includes(k.toLowerCase()),
    )?.[1] || "bg-secondary text-muted-foreground";

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-3 p-3 w-full text-left hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <UserCircle2 className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-semibold text-sm">{speaker.id}</span>
            <Badge className={`text-[9px] ${colorClass}`}>{speaker.estimated_role}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {speaker.speaking_proportion}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {speaker.contribution_summary}
          </p>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="p-3 space-y-3">
              {speaker.key_points?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-foreground mb-1">Key Points</p>
                  {speaker.key_points.map((p, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">
                      • {p}
                    </p>
                  ))}
                </div>
              )}
              {speakerSegments.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-foreground mb-1">
                    Discussion Topics
                  </p>
                  {speakerSegments.map((seg, i) => (
                    <div key={i} className="rounded border p-2 mb-1.5">
                      <p className="text-[11px] font-semibold">{seg.topic}</p>
                      <p className="text-[10px] text-muted-foreground">{seg.content_summary}</p>
                      {seg.key_quotes?.length > 0 && (
                        <div className="mt-1">
                          {seg.key_quotes.map((q, j) => (
                            <p
                              key={j}
                              className="text-[10px] text-muted-foreground/80 italic flex items-start gap-1 mt-0.5"
                            >
                              <Quote className="h-2.5 w-2.5 mt-0.5 flex-shrink-0 text-primary/50" />
                              "{q}"
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Discussion Analysis Summary ──────────────────
function DiscussionSummary({ analysis }: { analysis: DiscussionAnalysis }) {
  const sentimentColors: Record<string, string> = {
    collaborative: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    contentious: "bg-destructive/10 text-destructive",
    exploratory: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    decisive: "bg-primary/10 text-primary",
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-card p-3 text-center">
        <Users className="h-5 w-5 mx-auto text-primary mb-1" />
        <p className="text-lg font-display font-bold">{analysis.total_speakers}</p>
        <p className="text-[10px] text-muted-foreground">Speakers</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <MessageSquare className="h-5 w-5 mx-auto text-primary mb-1" />
        <p className="text-xs font-display font-semibold capitalize">
          {analysis.meeting_type?.replace(/_/g, " ")}
        </p>
        <p className="text-[10px] text-muted-foreground">Meeting Type</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <Clock className="h-5 w-5 mx-auto text-primary mb-1" />
        <p className="text-xs font-display font-semibold">{analysis.duration_estimate}</p>
        <p className="text-[10px] text-muted-foreground">Est. Duration</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <Waves className="h-5 w-5 mx-auto text-primary mb-1" />
        <Badge
          className={`text-[9px] ${sentimentColors[analysis.overall_sentiment] || "bg-secondary text-muted-foreground"}`}
        >
          {analysis.overall_sentiment}
        </Badge>
        <p className="text-[10px] text-muted-foreground mt-0.5">Sentiment</p>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────
export default function AudioRequirementCollector({
  projectId,
  existingRequirements,
  onResult,
  processing,
  setProcessing,
}: Props) {
  const [mode, setMode] = useState<"record" | "upload" | "transcript">("record");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      setStream(mediaStream);

      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        mediaStream.getTracks().forEach((t) => t.stop());
        setStream(null);
      };

      mediaRecorder.start(1000); // Collect data every 1s
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err) {
      toast.error("Microphone access denied. Please allow microphone access to record.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 20MB.");
      return;
    }

    const validTypes = [
      "audio/mpeg",
      "audio/wav",
      "audio/mp3",
      "audio/webm",
      "audio/ogg",
      "audio/m4a",
      "audio/mp4",
      "audio/x-m4a",
    ];
    if (!validTypes.some((t) => file.type.startsWith(t.split("/")[0]))) {
      toast.error("Unsupported audio format. Please use MP3, WAV, WebM, OGG, or M4A.");
      return;
    }

    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    toast.success(`Loaded: ${file.name}`);
  }, []);

  const processAudio = useCallback(async () => {
    setProcessing(true);
    try {
      let body: any = {
        project_id: projectId,
        user_id: "current", // Will be replaced by auth context
        existing_requirements: existingRequirements,
      };

      if (mode === "transcript") {
        if (!manualTranscript.trim()) {
          toast.error("Please enter a transcript first.");
          setProcessing(false);
          return;
        }
        body.transcript = manualTranscript;
        body.input_mode = "audio_transcript";
      } else if (audioBlob) {
        // Convert blob to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string;
            // Extract base64 part after data:audio/...;base64,
            const base64Data = result.split(",")[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });
        body.audio_base64 = base64;
        body.input_mode = mode === "record" ? "live_recording" : "audio_upload";
      } else {
        toast.error("No audio to process. Please record or upload audio first.");
        setProcessing(false);
        return;
      }

      // Get actual user ID from auth
      const { supabase } = await import("@/integrations/supabase/client");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) body.user_id = user.id;
      const token = await getRequiredAccessToken();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-audio-requirements`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "Audio processing failed");
        return;
      }

      onResult(data.data);
      toast.success("Audio analyzed! Review the extracted requirements.");
    } catch (err: any) {
      toast.error(err.message || "Failed to process audio");
    } finally {
      setProcessing(false);
    }
  }, [mode, audioBlob, manualTranscript, projectId, existingRequirements, onResult, setProcessing]);

  return (
    <div className="space-y-5">
      {/* Header info */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-primary/5 border border-primary/10 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-foreground font-semibold mb-0.5">Audio-Based Requirement Collection</p>
          <p>
            Record a live discussion, upload an audio file, or paste a meeting transcript. AI will
            identify speakers, extract requirements, and track who said what — with full
            traceability.
          </p>
          <p className="mt-1 text-muted-foreground/70">
            <Sparkles className="h-3 w-3 inline mr-1" />
            Powered by AI (Gemini Pro). Future: Assembly AI integration for enhanced diarization.
          </p>
        </div>
      </div>

      {/* Mode selector */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
        <TabsList className="grid w-full grid-cols-3 h-9">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="record" className="text-xs gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Record
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              Record a live discussion using your microphone
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="upload" className="text-xs gap-1.5">
                <FileAudio className="h-3.5 w-3.5" /> Upload
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              Upload a pre-recorded audio file (MP3, WAV, WebM, M4A)
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="transcript" className="text-xs gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Transcript
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              Paste a meeting transcript for AI analysis
            </TooltipContent>
          </Tooltip>
        </TabsList>

        {/* Record Tab */}
        <TabsContent value="record" className="mt-4 space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="text-center space-y-4">
              {/* Recording controls */}
              <div className="flex items-center justify-center gap-4">
                {!isRecording ? (
                  <Button
                    size="lg"
                    className="gap-2 h-12 px-8 rounded-full"
                    onClick={startRecording}
                    disabled={processing}
                  >
                    <Mic className="h-5 w-5" /> Start Recording
                  </Button>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
                      <RecordingTimer isRecording={isRecording} startTime={recordingStartTime} />
                    </div>
                    <Button
                      size="lg"
                      variant="destructive"
                      className="gap-2 h-12 px-8 rounded-full"
                      onClick={stopRecording}
                    >
                      <Square className="h-4 w-4" /> Stop
                    </Button>
                  </div>
                )}
              </div>

              {/* Waveform */}
              {isRecording && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <WaveformVisualizer stream={stream} isRecording={isRecording} />
                </motion.div>
              )}

              {/* Playback */}
              {audioUrl && !isRecording && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                    <Volume2 className="h-3.5 w-3.5" />
                    <span>Recording captured. Preview before processing:</span>
                  </div>
                  <audio controls src={audioUrl} className="w-full max-w-md mx-auto" />
                </motion.div>
              )}

              <p className="text-[11px] text-muted-foreground">
                {isRecording
                  ? "Recording... Speak clearly. AI will identify different speakers automatically."
                  : "Click to start recording a requirements discussion. Works best with 2-5 speakers."}
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload" className="mt-4 space-y-4">
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <FileAudio className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-display font-semibold mb-1">Upload Audio File</p>
            <p className="text-xs text-muted-foreground mb-4">
              Supported: MP3, WAV, WebM, OGG, M4A (max 20MB)
            </p>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
              id="audio-upload"
            />
            <label htmlFor="audio-upload">
              <Button variant="outline" className="gap-2 cursor-pointer" asChild>
                <span>
                  <Upload className="h-4 w-4" /> Choose File
                </span>
              </Button>
            </label>

            {audioUrl && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 space-y-2"
              >
                <div className="flex items-center gap-2 justify-center text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>File loaded successfully</span>
                </div>
                <audio controls src={audioUrl} className="w-full max-w-md mx-auto" />
              </motion.div>
            )}
          </div>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-foreground">Paste Meeting Transcript</p>
              <HelpTip text="Paste a transcript from a meeting recording tool (Otter.ai, Teams, Zoom, etc.). Include speaker labels if available — e.g., 'Speaker 1: We need...' The AI will identify speakers and extract requirements." />
            </div>
            <Textarea
              placeholder={
                "Speaker 1: I think we need a document management system that supports versioning.\nSpeaker 2: Agreed, and we also need role-based access control.\nSpeaker 1: Security is critical — we're handling sensitive medical records.\n..."
              }
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              className="min-h-[200px] text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              {manualTranscript.length} characters • Tip: Include speaker labels for better
              diarization
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Process Button */}
      <div className="flex justify-end">
        <Button
          onClick={processAudio}
          disabled={
            processing ||
            (mode !== "transcript" && !audioBlob) ||
            (mode === "transcript" && !manualTranscript.trim())
          }
          className="gap-2"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing Discussion...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Extract Requirements from Audio
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Audio Analysis Results Panel ─────────────────
export function AudioAnalysisPanel({ data }: { data: AudioExtractionResult }) {
  if (!data.discussion_analysis && !data.speakers?.length) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* Discussion Analysis Summary */}
      {data.discussion_analysis && (
        <div>
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Waves className="h-4 w-4 text-primary" />
            Discussion Analysis
          </h4>
          <DiscussionSummary analysis={data.discussion_analysis} />
          {data.discussion_analysis.key_topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {data.discussion_analysis.key_topics.map((topic, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">
                  {topic}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Speakers */}
      {data.speakers && data.speakers.length > 0 && (
        <div>
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Identified Speakers ({data.speakers.length})
          </h4>
          <div className="space-y-2">
            {data.speakers.map((speaker, i) => (
              <SpeakerCard key={i} speaker={speaker} segments={data.discussion_segments || []} />
            ))}
          </div>
        </div>
      )}

      {/* Disagreements */}
      {data.disagreements && data.disagreements.length > 0 && (
        <div>
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Disagreements ({data.disagreements.length})
          </h4>
          <div className="space-y-2">
            {data.disagreements.map((d, i) => (
              <div key={i} className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-mono text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                    {d.id}
                  </span>
                  <span className="font-display font-semibold text-xs">{d.topic}</span>
                  <Badge
                    variant={d.resolution_status === "resolved" ? "default" : "destructive"}
                    className="text-[9px] ml-auto"
                  >
                    {d.resolution_status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  {d.positions?.map((p, j) => (
                    <p key={j} className="text-[11px] text-muted-foreground">
                      <span className="font-semibold">{p.speaker}:</span> {p.position}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {data.action_items && data.action_items.length > 0 && (
        <div>
          <h4 className="font-display font-bold text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Action Items ({data.action_items.length})
          </h4>
          <div className="space-y-1.5">
            {data.action_items.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded border">
                <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {item.id}
                </span>
                <span className="flex-1">{item.description}</span>
                <Badge variant="outline" className="text-[9px]">
                  {item.assigned_to}
                </Badge>
                <Badge
                  variant={item.priority === "high" ? "destructive" : "secondary"}
                  className="text-[9px]"
                >
                  {item.priority}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
