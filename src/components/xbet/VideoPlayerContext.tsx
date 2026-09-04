import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PlayerLoader } from "@/components/xbet/PlayerLoader";

import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Maximize2,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
} from "lucide-react";

export type PlayerClip = { title: string; url: string };

type Ctx = { open: (clips: PlayerClip[], index: number) => void };

const VideoPlayerCtx = createContext<Ctx>({ open: () => {} });

export function useVideoPlayer() {
  return useContext(VideoPlayerCtx);
}

function videoSource(url: string): { kind: "yt" | "dm" | "raw"; id: string } {
  const yt = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/.exec(url);
  if (yt?.[1]) return { kind: "yt", id: yt[1] };
  const dm = /dailymotion\.com\/(?:video|embed\/video)\/(\w+)/.exec(url);
  if (dm?.[1]) return { kind: "dm", id: dm[1] };
  return { kind: "raw", id: url };
}

export function playerUrl(url: string): string {
  const s = videoSource(url);
  if (s.kind === "yt")
    return (
      `https://www.youtube-nocookie.com/embed/${s.id}` +
      `?autoplay=1&controls=0&disablekb=1&fs=0&rel=0&modestbranding=1&iv_load_policy=3` +
      `&playsinline=1&enablejsapi=1`
    );
  if (s.kind === "dm")
    return `https://www.dailymotion.com/embed/video/${s.id}?autoplay=1&controls=0&ui-logo=0&queue-enable=0`;
  return url;
}

export function thumbUrl(url: string): string | null {
  const s = videoSource(url);
  if (s.kind === "yt") return `https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`;
  if (s.kind === "dm") return `https://www.dailymotion.com/thumbnail/video/${s.id}`;
  return null;
}

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * App-level video player. Lives above the router outlet so playback survives
 * navigation. Uses our own controls: YouTube's native chrome is disabled and
 * the frame stays hidden behind a loading animation until playback begins.
 */
export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const [clips, setClips] = useState<PlayerClip[] | null>(null);
  const [index, setIndex] = useState(0);
  const [mini, setMini] = useState(false);
  const [entered, setEntered] = useState(false);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const open = useCallback((next: PlayerClip[], i: number) => {
    setClips(next);
    setIndex(i);
    setMini(false);
    setEntered(false);
  }, []);

  useEffect(() => {
    if (!clips) return;
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, [clips]);

  const clip = clips?.[index] ?? null;

  // reset per clip
  useEffect(() => {
    setReady(false);
    setPlaying(false);
    setRevealed(false);
    setTime(0);
    setDuration(0);
  }, [clip?.url]);

  const post = useCallback((func: string, args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }, []);

  // YouTube iframe API messaging (listen for state / progress)
  useEffect(() => {
    if (!clip) return;
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== "string" || !e.data.includes("infoDelivery")) {
        if (typeof e.data !== "string") return;
      }
      let data: any;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      const info = data?.info;
      if (data?.event === "onReady" || info) setReady(true);
      if (!info) return;
      if (typeof info.playerState === "number") {
        setPlaying(info.playerState === 1);
        if (info.playerState === 1) setRevealed(true);
      }
      if (typeof info.currentTime === "number") setTime(info.currentTime);
      if (typeof info.duration === "number" && info.duration > 0) setDuration(info.duration);
      if (typeof info.muted === "boolean") setMuted(info.muted);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [clip]);

  const onFrameLoad = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: 1, channel: "widget" }),
      "*",
    );
    // safety: never leave the loader up forever
    setTimeout(() => {
      setReady(true);
      setRevealed(true);
    }, 2500);
  }, []);

  const value = useMemo(() => ({ open }), [open]);
  const showVideo = ready && revealed;

  return (
    <VideoPlayerCtx.Provider value={value}>
      {children}
      {clip ? (
        <div
          className={`pointer-events-none fixed z-[80] ${
            mini ? "bottom-3 right-3" : "inset-0 flex items-center justify-center p-3 sm:p-6"
          }`}
        >
          <div
            className={`pointer-events-auto flex flex-col overflow-hidden rounded-2xl bg-xb-panel shadow-[0_24px_80px_-16px_rgba(0,0,0,0.55)] ring-1 ring-xb-line transition-all duration-500 ease-[cubic-bezier(0.22,1.2,0.36,1)] ${
              mini ? "w-[300px] sm:w-[360px]" : "w-full max-w-5xl"
            } ${entered ? "scale-100 opacity-100 translate-y-0" : "scale-50 opacity-0 translate-y-12"}`}
            style={{ maxHeight: "calc(100dvh - 1.5rem)" }}
          >
            <div className="flex items-center gap-1.5 border-b border-xb-line px-2 py-1">
              <Play className="h-3 w-3 shrink-0 text-xb-blue" />
              <span className="flex-1 truncate text-[10px] font-medium leading-none text-xb-text-muted">
                {clip.title}
              </span>
              <button
                type="button"
                onClick={() => setMini((m) => !m)}
                aria-label={mini ? "Expand player" : "Minimize player"}
                className="flex h-5 w-5 items-center justify-center rounded text-xb-text-muted transition hover:bg-xb-odds hover:text-xb-text"
              >
                {mini ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => setClips(null)}
                aria-label="Close video"
                className="flex h-5 w-5 items-center justify-center rounded text-xb-text-muted transition hover:bg-xb-odds hover:text-xb-text"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="relative aspect-video w-full bg-black">
              <iframe
                key={clip.url}
                ref={frameRef}
                onLoad={onFrameLoad}
                src={playerUrl(clip.url)}
                title={clip.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-presentation"
                className={`h-full w-full transition-opacity duration-500 ${
                  showVideo ? "opacity-100" : "opacity-0"
                }`}
              />
              {/* blocks YouTube's own click targets/branding overlays */}
              <button
                type="button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => post(playing ? "pauseVideo" : "playVideo")}
                className="absolute inset-0 h-full w-full cursor-default bg-transparent"
              />
              {!showVideo ? <PlayerLoader /> : null}

            </div>

            {/* our own control bar */}
            <div className="flex items-center gap-2 px-2 py-1">
              <button
                type="button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={() => post(playing ? "pauseVideo" : "playVideo")}
                className="bp-glass-btn hover:bp-glass-btn-hover flex h-6 w-6 shrink-0 items-center justify-center text-xb-text active:scale-95"
              >
                {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </button>
              <button
                type="button"
                aria-label={muted ? "Unmute" : "Mute"}
                onClick={() => {
                  post(muted ? "unMute" : "mute");
                  setMuted((m) => !m);
                }}
                className="bp-glass-btn hover:bp-glass-btn-hover flex h-6 w-6 shrink-0 items-center justify-center text-xb-text active:scale-95"
              >
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </button>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={1}
                value={Math.min(time, duration || 0)}
                aria-label="Seek"
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTime(v);
                  post("seekTo", [v, true]);
                }}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-xb-odds accent-xb-blue"
              />
              <span className="shrink-0 text-[10px] tabular-nums leading-none text-xb-text-muted">
                {fmt(time)} / {fmt(duration)}
              </span>
              {clips && clips.length > 1 ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-[10px] leading-none text-xb-text-muted">
                    {index + 1}/{clips.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Previous clip"
                    onClick={() => setIndex((i) => (i - 1 + clips.length) % clips.length)}
                    className="flex h-5 w-5 items-center justify-center rounded text-xb-text-muted transition hover:bg-xb-blue hover:text-xb-on-dark"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next clip"
                    onClick={() => setIndex((i) => (i + 1) % clips.length)}
                    className="flex h-5 w-5 items-center justify-center rounded text-xb-text-muted transition hover:bg-xb-blue hover:text-xb-on-dark"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </VideoPlayerCtx.Provider>
  );
}
