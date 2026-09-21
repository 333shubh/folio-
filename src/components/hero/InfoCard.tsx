"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { INFO_CARD } from "@/config/info-card";

/** Words per minute used to estimate a duration before speech starts. */
const WPM = 165;

function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Token = { text: string; start: number; end: number };
type Chunk = { text: string; start: number };

/** Words with their offsets in the source string, whitespace excluded. */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

/** Sentences with their offsets, so speech offsets map back to the source. */
function toChunks(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const re = /[^.!?]+[.!?]*\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body) chunks.push({ text: body, start: m.index + lead });
  }
  return chunks.length ? chunks : [{ text, start: 0 }];
}

/**
 * The hero info panel, styled as a small audio-player card.
 *
 * PLAY reads the blurb aloud with the Web Speech API and highlights each
 * word as it is spoken; the eye button collapses the card to its header.
 */
export default function InfoCard() {
  const [collapsed, setCollapsed] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeWord, setActiveWord] = useState(-1);

  const tickRef = useRef<number | null>(null);
  /** Index of the sentence being spoken. */
  const chunkRef = useRef(0);
  /** Character offset reached inside that sentence. */
  const offsetRef = useRef(0);
  /** Guards the onend handler while we cancel deliberately. */
  const stoppingRef = useRef(false);

  /**
   * Feature detection without a state-setting effect.
   *
   * The server snapshot is false, so the button renders disabled in the
   * HTML and enables itself on hydration - no mismatch, and no flash of a
   * control that would not have worked anyway.
   */
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false
  );

  /**
   * Spoken text and rendered text are the same string, so a speech offset
   * maps straight onto a rendered word. Inserting punctuation for the voice
   * would desynchronise the highlight from what is on screen.
   */
  const text = `${INFO_CARD.name} ${INFO_CARD.body}`;
  const tokens = useMemo(() => tokenize(text), [text]);
  const chunks = useMemo(() => toChunks(text), [text]);
  const estimated = (tokens.length / WPM) * 60;

  /** Lets the deferred retry above re-enter the current callback. */
  const speakFromRef = useRef<(() => void) | null>(null);

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const startTick = useCallback(() => {
    stopTick();
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => e + 0.25);
    }, 250);
  }, [stopTick]);

  const reset = useCallback(() => {
    stoppingRef.current = true;
    stopTick();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    chunkRef.current = 0;
    offsetRef.current = 0;
    setSpeaking(false);
    setPaused(false);
    setElapsed(0);
    setActiveWord(-1);
    stoppingRef.current = false;
  }, [stopTick]);

  /** Word whose span contains this offset in the full string. */
  const wordAt = useCallback(
    (globalOffset: number) => {
      for (let i = 0; i < tokens.length; i++) {
        if (globalOffset < tokens[i].end) return i;
      }
      return tokens.length - 1;
    },
    [tokens]
  );

  /**
   * Speak from the stored sentence and offset onward.
   *
   * Sentence-at-a-time rather than one long utterance, for two reasons:
   * Chrome cuts off utterances after roughly 15 seconds, and pause() is a
   * no-op for local voices on Windows - `speechSynthesis.paused` stays false
   * and the audio keeps going. Cancelling and re-speaking the remainder is
   * the only approach that behaves the same everywhere.
   */
  const speakFrom = useCallback(() => {
    const synth = window.speechSynthesis;

    /**
     * Only cancel if something is actually queued, and never speak in the
     * same tick as a cancel.
     *
     * Chrome treats the two as a race: the cancel tears down the utterance
     * that was just queued, `onerror` fires with "canceled"/"interrupted",
     * and the player resets itself the instant you press play.
     */
    if (synth.speaking || synth.pending) {
      stoppingRef.current = true;
      synth.cancel();
      stoppingRef.current = false;
      window.setTimeout(() => speakFromRef.current?.(), 60);
      return;
    }

    const voices = synth.getVoices();
    const preferred =
      voices.find(
        (v) => /en-(GB|US)/i.test(v.lang) && /natural|google/i.test(v.name)
      ) ?? voices.find((v) => /^en/i.test(v.lang));

    const speakChunk = (index: number, startAt: number) => {
      if (index >= chunks.length) {
        reset();
        return;
      }

      chunkRef.current = index;
      const chunk = chunks[index];
      const body = chunk.text.slice(startAt);

      const u = new SpeechSynthesisUtterance(body);
      u.rate = 1;
      u.pitch = 1;
      if (preferred) u.voice = preferred;

      // Track progress so a pause can resume mid-sentence, and so the
      // highlight follows the voice.
      u.onboundary = (e) => {
        offsetRef.current = startAt + e.charIndex;
        setActiveWord(wordAt(chunk.start + offsetRef.current));
      };

      u.onend = () => {
        if (stoppingRef.current) return;
        offsetRef.current = 0;
        speakChunk(index + 1, 0);
      };
      u.onerror = (e) => {
        // A deliberate cancel surfaces here too; it is not a failure.
        if (stoppingRef.current) return;
        if (e.error === "canceled" || e.error === "interrupted") return;
        reset();
      };

      synth.speak(u);
    };

    speakChunk(chunkRef.current, offsetRef.current);
  }, [chunks, reset, wordAt]);

  useEffect(() => {
    speakFromRef.current = speakFrom;
  }, [speakFrom]);

  // Never leave speech running after the component goes away or the tab is
  // closed - the synth is global and keeps talking otherwise.
  useEffect(() => {
    const onUnload = () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      onUnload();
      stopTick();
    };
  }, [stopTick]);

  const togglePlay = useCallback(() => {
    if (!("speechSynthesis" in window)) return;

    if (!speaking) {
      chunkRef.current = 0;
      offsetRef.current = 0;
      setElapsed(0);
      setActiveWord(0);
      setSpeaking(true);
      setPaused(false);
      speakFrom();
      startTick();
      return;
    }

    if (paused) {
      setPaused(false);
      speakFrom();
      startTick();
    } else {
      // Cancel rather than pause - see speakFrom.
      stoppingRef.current = true;
      window.speechSynthesis.cancel();
      stoppingRef.current = false;
      setPaused(true);
      stopTick();
    }
  }, [speaking, paused, speakFrom, startTick, stopTick]);

  // Collapsing should not leave a disembodied voice talking.
  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      if (!c) reset();
      return !c;
    });
  }, [reset]);

  const label =
    speaking && !paused ? "PAUSE" : speaking ? "RESUME" : INFO_CARD.playLabel;

  return (
    <aside
      className={collapsed ? "info-card info-card--collapsed" : "info-card"}
    >
      <header className="info-card__bar">
        <span className="info-card__file">{INFO_CARD.fileLabel}</span>

        <span className="info-card__bar-right">
          <span className="info-card__meta">
            {speaking ? formatTime(elapsed) : formatTime(estimated)}
          </span>
          <button
            type="button"
            className="info-card__eye"
            aria-expanded={!collapsed}
            aria-controls="info-card-body"
            aria-label={collapsed ? "Expand info" : "Collapse info"}
            onClick={toggleCollapsed}
          >
            {/* Eye, with a slash through it when collapsed. */}
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path
                d="M1.5 12S5 5.5 12 5.5 22.5 12 22.5 12 19 18.5 12 18.5 1.5 12 1.5 12Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3.1" fill="currentColor" />
              {collapsed && (
                <path
                  d="M4 20 20 4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </span>
      </header>

      <div className="info-card__body" id="info-card-body" hidden={collapsed}>
        <p className="info-card__text">
          {tokens.map((tok, i) => {
            const isName = i === 0;
            const isActive = i === activeWord;
            const cls = [
              "info-card__word",
              isName ? "info-card__word--name" : "",
              isActive ? "info-card__word--active" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <span key={`${tok.start}-${tok.text}`} className={cls}>
                {tok.text}{" "}
              </span>
            );
          })}
        </p>

        <div className="info-card__row">
          <button
            type="button"
            className="info-card__play"
            onClick={togglePlay}
            disabled={!supported}
            aria-pressed={speaking && !paused}
            title={
              supported
                ? "Read this aloud"
                : "Speech synthesis is not available in this browser"
            }
          >
            {label}
          </button>

          <ul className="info-card__tags">
            {INFO_CARD.tags.map((tag, i) => (
              <li
                key={tag}
                className={
                  i === 0
                    ? "info-card__tag info-card__tag--accent"
                    : "info-card__tag"
                }
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
