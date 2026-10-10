import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/api";
import type { ScannerEvents, ScanOutcome } from "@/api/types";
import { Logo } from "@/components/Logo";
import { fmtShortDate, fmtStamp, fmtTimeSec } from "@/lib/format";
import { ApiError } from "@/services/http";
import { AuthProvider, useAuth } from "../admin/auth";
import { LoginPage } from "../admin/LoginPage";
import { classifyCameraError, openCamera, startDecoding, type Camera } from "./camera";
import {
  ANSWER_TIMEOUT_MS,
  isCompleteTicketId,
  isDuplicateRead,
  normalizeTicketId,
  reduce,
  tokenFromScan,
  verdictKind,
  type ScanRequest,
  type Screen,
  type VerdictKind,
} from "./scanner-state";

const EVENT_KEY = "admit.scanner.event";
const SOUND_KEY = "admit.scanner.sound";
const read = (k: string) => {
  try {
    return sessionStorage.getItem(k) ?? localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode */
  }
};

export default function ScannerApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage to="/scan" />} />
        <Route index element={<Gate />} />
        <Route path="*" element={<Navigate to="/scan" replace />} />
      </Routes>
    </AuthProvider>
  );
}

function Gate() {
  const { status, can } = useAuth();
  if (status === "loading")
    return (
      <Full tone="light">
        <p role="status" className="m-auto text-sm text-ink-2">
          Loading…
        </p>
      </Full>
    );
  if (status === "unauthenticated") return <Navigate to="/scan/login" replace />;
  if (!can("scan:checkin")) {
    return (
      <Full tone="light">
        <div role="alert" className="m-auto flex max-w-sm flex-col gap-3 p-6 text-center">
          <h1 className="display text-4xl">No scanning access</h1>
          <p className="text-sm text-ink-2">
            Your role does not include scanning tickets. Ask an owner to give you the door staff
            role and assign you to an event.
          </p>
        </div>
      </Full>
    );
  }
  return <Scanner />;
}

function Full({
  tone,
  children,
  bg,
}: {
  tone: "light" | "dark" | "verdict";
  children: ReactNode;
  bg?: string;
}) {
  const cls =
    tone === "light"
      ? "bg-paper text-ink"
      : tone === "dark"
        ? "bg-[#0e0d0b] text-paper"
        : `${bg ?? ""}`;
  return (
    <div className={`mx-auto flex min-h-[100dvh] w-full max-w-md flex-col ${cls}`}>{children}</div>
  );
}

// ---- verdicts ---------------------------------------------------------------------------------------------------------
const VERDICT: Record<
  VerdictKind,
  {
    bg: string;
    fg: string;
    glyph: string;
    glyphBg: string;
    glyphFg: string;
    title: string;
    sub: string;
    btn: string;
    btnFg: string;
    secondary?: string;
  }
> = {
  approved: {
    bg: "bg-ok-solid",
    fg: "text-white",
    glyph: "✓",
    glyphBg: "bg-white",
    glyphFg: "text-ok-solid",
    title: "Entry approved",
    sub: "",
    btn: "bg-white",
    btnFg: "text-ink",
  },
  used: {
    bg: "bg-used-solid",
    fg: "text-ink",
    glyph: "!",
    glyphBg: "bg-ink",
    glyphFg: "text-used-solid",
    title: "Already used",
    sub: "Do not admit. This ticket was checked in before.",
    btn: "bg-ink",
    btnFg: "text-white",
    secondary: "Call supervisor",
  },
  unknown: {
    bg: "bg-bad-solid",
    fg: "text-white",
    glyph: "✕",
    glyphBg: "bg-white",
    glyphFg: "text-bad-solid",
    title: "Not a valid ticket",
    sub: "This code is not an Admit ticket. Ask for the ticket from their email.",
    btn: "bg-white",
    btnFg: "text-ink",
    secondary: "Enter ID manually",
  },
  revoked: {
    bg: "bg-bad-solid",
    fg: "text-white",
    glyph: "✕",
    glyphBg: "bg-white",
    glyphFg: "text-bad-solid",
    title: "Ticket cancelled",
    sub: "The organizer cancelled this ticket. Do not admit.",
    btn: "bg-white",
    btnFg: "text-ink",
    secondary: "Call supervisor",
  },
  other_event: {
    bg: "bg-bad-solid",
    fg: "text-white",
    glyph: "✕",
    glyphBg: "bg-white",
    glyphFg: "text-bad-solid",
    title: "Not for this event",
    sub: "This ticket is valid but for a different event. Do not admit here.",
    btn: "bg-white",
    btnFg: "text-ink",
  },
  closed: {
    bg: "bg-bad-solid",
    fg: "text-white",
    glyph: "✕",
    glyphBg: "bg-white",
    glyphFg: "text-bad-solid",
    title: "Event not open",
    sub: "Scanning is closed for this event. Ask a supervisor.",
    btn: "bg-white",
    btnFg: "text-ink",
    secondary: "Call supervisor",
  },
};

function rowsFor(
  kind: VerdictKind,
  o: ScanOutcome,
  eventTitle: string,
): [string, string, boolean?][] {
  const t = o.ticket;
  switch (kind) {
    case "approved":
      return [
        ["Holder", t?.holder ?? ""],
        ["Ticket", t?.type ?? ""],
        ["ID", t?.id ?? "", true],
        ["Event", eventTitle],
      ];
    case "used":
      return [
        [
          "First check-in",
          `${o.firstCheckInAt ? fmtTimeSec(o.firstCheckInAt) : ""}${o.gate ? ` · ${o.gate}` : ""}`,
          true,
        ],
        ["By", o.firstCheckInBy ?? "—"],
        ["Holder", t?.holder ?? ""],
        ["ID", t?.id ?? "", true],
      ];
    case "revoked":
      return [
        ["Status", "Revoked"],
        ["Reason shown", "Cancelled by organizer"],
      ];
    case "other_event":
      return [
        ["Scanning for", eventTitle],
        ["Ticket event", "Not shown · no access"],
      ];
    case "closed":
      return [
        ["Scanning for", eventTitle],
        ["Status", "Event is not open"],
      ];
    default:
      return [
        ["Read", "Not recognised"],
        ["Tip", "Screenshots of other QR codes are common"],
      ];
  }
}

function tone(kind: VerdictKind, on: boolean) {
  if (!on || typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, at: number, len: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + len);
    };
    if (kind === "approved") beep(880, 0, 0.12);
    else {
      beep(220, 0, 0.15);
      beep(220, 0.22, 0.15);
    }
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio is optional */
  }
}

// ---- the scanner ------------------------------------------------------------------------------------------------------
function Scanner() {
  const { me, logout } = useAuth();
  const [screen, dispatch] = useReducer(reduce, { name: "home" } as Screen);
  const [eventId, setEventId] = useState<string | null>(() => read(EVENT_KEY));
  const [picking, setPicking] = useState(false);
  const [sound, setSound] = useState(() => read(SOUND_KEY) === "1");
  const [failure, setFailure] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ["scanner", "events"],
    queryFn: () => adminApi.checkin.events(),
    refetchInterval: screen.name === "home" ? 10_000 : false,
  });
  const list = events.data?.events ?? [];
  const current = list.find((e) => e.id === eventId) ?? (list.length === 1 ? list[0] : undefined);

  // ask the server, with a deadline: no answer in 5 s is "no connection" and records nothing
  const requestRef = useRef<ScanRequest | null>(null);
  useEffect(() => {
    if (screen.name !== "checking" || !current) return;
    const ctl = new AbortController();
    requestRef.current = screen.request;
    const timer = setTimeout(() => ctl.abort(), ANSWER_TIMEOUT_MS);
    setFailure(null);
    adminApi.checkin
      .scan({ ...screen.request, eventId: current.id, gate: current.gate || undefined }, ctl.signal)
      .then(
        (outcome) => {
          clearTimeout(timer);
          const kind = verdictKind(outcome);
          tone(kind, sound);
          navigator.vibrate?.(kind === "approved" ? 60 : [200, 80, 200]);
          dispatch({ type: "answered", outcome });
          void events.refetch();
        },
        (err) => {
          clearTimeout(timer);
          if (err instanceof ApiError && err.status < 500 && err.status !== 401)
            setFailure(err.message);
          dispatch({ type: "no_answer" });
        },
      );
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.name === "checking" ? screen.request : null]);

  const nextBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (screen.name === "verdict") nextBtn.current?.focus();
  }, [screen.name]);

  const submitCode = useCallback(
    (request: ScanRequest) => dispatch({ type: "code_read", request }),
    [],
  );

  if (!events.data && events.isPending)
    return (
      <Full tone="light">
        <p role="status" className="m-auto text-sm">
          Loading…
        </p>
      </Full>
    );
  if (events.isError)
    return (
      <Full tone="light">
        <OfflineCard
          title="Could not load your events"
          body="Check your connection and try again."
          cta="Try again"
          onCta={() => void events.refetch()}
          secondary="Sign out"
          onSecondary={() => logout()}
        />
      </Full>
    );
  if (!current) {
    return (
      <Full tone="light">
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Logo size={20} />
          {list.length === 0 ? (
            <>
              <h1 className="display text-4xl">No events to scan</h1>
              <p className="text-[15px] leading-relaxed text-ink-2">
                You are not assigned to an event that is on right now. Ask an organizer to assign
                you under Event staff.
              </p>
            </>
          ) : (
            <EventPicker
              events={list}
              onPick={(id) => {
                setEventId(id);
                write(EVENT_KEY, id);
              }}
            />
          )}
          <button
            className="mt-auto h-14 rounded-lg border border-ink text-base font-semibold"
            onClick={() => logout()}
          >
            Sign out
          </button>
        </div>
      </Full>
    );
  }

  const staffLine = `${me?.user.name ?? events.data?.staff.name ?? ""}${current.gate ? ` · ${current.gate}` : ""}`;

  switch (screen.name) {
    case "home":
      return (
        <Full tone="light">
          <Home
            events={events.data!}
            current={current}
            staffLine={staffLine}
            picking={picking}
            setPicking={setPicking}
            onPick={(id) => {
              setEventId(id);
              write(EVENT_KEY, id);
              setPicking(false);
            }}
            sound={sound}
            onSound={(v) => {
              setSound(v);
              write(SOUND_KEY, v ? "1" : "0");
            }}
            onStart={() => dispatch({ type: "start" })}
            onManual={() => dispatch({ type: "manual" })}
            onSignOut={() => logout()}
          />
        </Full>
      );
    case "scanning":
      return (
        <Camera
          title={current.title}
          count={current.checkedIn}
          onCode={submitCode}
          onDone={() => dispatch({ type: "home" })}
          onManual={() => dispatch({ type: "manual" })}
          onFail={(f) => dispatch({ type: f === "blocked" ? "camera_blocked" : "camera_missing" })}
        />
      );
    case "checking":
      return (
        <Full tone="dark">
          <div
            role="status"
            aria-live="assertive"
            className="m-auto flex flex-col items-center gap-6 p-6 text-center"
          >
            <div
              aria-hidden="true"
              className="spin size-[72px] rounded-full border-[6px] border-white/20 border-t-white"
            />
            <span className="display text-[40px]">Checking ticket…</span>
            <span className="max-w-[280px] text-base leading-normal text-rule-strong">
              Do not admit yet. Scanning is paused until the server answers.
            </span>
            <span className="text-[13px] text-faint">
              If this takes more than 5 seconds you will see a connection error.
            </span>
          </div>
        </Full>
      );
    case "verdict": {
      const kind = verdictKind(screen.outcome);
      const v = VERDICT[kind];
      const sub =
        kind === "approved"
          ? `Checked in at ${screen.outcome.at ? fmtTimeSec(screen.outcome.at) : ""}${screen.outcome.gate ? ` · ${screen.outcome.gate}` : ""}`
          : v.sub;
      return (
        <Full tone="verdict" bg={`${v.bg} ${v.fg}`}>
          <div role="alert" className="flex flex-1 flex-col">
            <div className="flex flex-col gap-3.5 px-6 pt-8">
              <div
                aria-hidden="true"
                className={`flex size-24 items-center justify-center rounded-full text-[56px] font-extrabold leading-none ${v.glyphBg} ${v.glyphFg}`}
              >
                {v.glyph}
              </div>
              <h1
                className="font-display text-[68px] font-black uppercase leading-[0.86]"
                style={{ fontStretch: "64%" }}
              >
                {v.title}
              </h1>
              <p className="text-lg font-medium leading-snug">{sub}</p>
            </div>
            <div className="mx-4 mt-5 flex flex-col rounded-2xl bg-white text-ink">
              {rowsFor(kind, screen.outcome, current.title).map(([k, val, mono]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-b border-rule px-3.5 py-3 text-[15px] last:border-b-0"
                >
                  <span className="text-ink-2">{k}</span>
                  <span className={`text-right font-semibold ${mono ? "font-mono" : ""}`}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
            <span className="flex-1" />
            <div className="flex flex-col gap-2 px-4 pb-7 pt-4">
              <button
                ref={nextBtn}
                onClick={() => dispatch({ type: "start" })}
                className={`h-[72px] rounded-2xl text-xl font-bold ${v.btn} ${v.btnFg}`}
              >
                Scan next
              </button>
              {v.secondary ? (
                <button
                  onClick={() =>
                    v.secondary === "Enter ID manually"
                      ? dispatch({ type: "manual" })
                      : dispatch({ type: "home" })
                  }
                  className="h-[52px] rounded-2xl border-2 border-current bg-transparent text-base font-semibold"
                >
                  {v.secondary}
                </button>
              ) : null}
            </div>
          </div>
        </Full>
      );
    }
    case "offline":
      return (
        <Full tone="light">
          <OfflineCard
            title={failure ? "The server refused the scan" : "Could not reach the server"}
            body={
              failure ??
              "The code was read but not checked. Nothing was recorded. Ask the guest to wait."
            }
            steps={
              failure
                ? []
                : [
                    "Move closer to Wi-Fi or switch to mobile data.",
                    "Tap Retry: the same code is re-sent.",
                  ]
            }
            cta="Retry check"
            onCta={() => dispatch({ type: "retry" })}
            secondary="Back to scanner"
            onSecondary={() => dispatch({ type: "home" })}
            badge="✕ Offline"
          />
        </Full>
      );
    case "manual":
      return (
        <Manual
          onSubmit={(id) => submitCode({ ticketId: id })}
          onBack={() => dispatch({ type: "start" })}
        />
      );
    case "camera_blocked":
      return (
        <Full tone="light">
          <OfflineCard
            badge="✕ Camera off"
            title="Camera access is blocked"
            body="The browser denied camera permission, so codes cannot be read."
            steps={[
              "Tap the lock icon in the address bar.",
              "Set Camera to Allow.",
              "Reload this page.",
            ]}
            cta="Reload"
            onCta={() => window.location.reload()}
            secondary="Enter ticket ID manually"
            onSecondary={() => dispatch({ type: "manual" })}
          />
        </Full>
      );
    case "camera_missing":
      return (
        <Full tone="light">
          <OfflineCard
            badge="! No camera"
            title="Camera unavailable"
            body="Another app may be using the camera, or this device has none."
            steps={[
              "Close other apps using the camera.",
              "Try again, or flip the camera.",
              "Use manual entry in the meantime.",
            ]}
            cta="Try again"
            onCta={() => dispatch({ type: "start" })}
            secondary="Enter ticket ID manually"
            onSecondary={() => dispatch({ type: "manual" })}
          />
        </Full>
      );
  }
}

function EventPicker({
  events,
  onPick,
}: {
  events: ScannerEvents["events"];
  onPick: (id: string) => void;
}) {
  return (
    <>
      <h1 className="display text-4xl">Which event?</h1>
      <div className="flex flex-col gap-2.5">
        {events.map((e) => (
          <button
            key={e.id}
            onClick={() => onPick(e.id)}
            className="flex flex-col gap-1 rounded-xl border-2 border-ink bg-surface p-3.5 text-left"
          >
            <span className="display text-[26px]">{e.title}</span>
            <span className="text-[13px] text-ink-2">
              {fmtShortDate(e.startsAt)} · {e.venue}
              {e.gate ? ` · ${e.gate}` : ""}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

function Home({
  events,
  current,
  staffLine,
  picking,
  setPicking,
  onPick,
  sound,
  onSound,
  onStart,
  onManual,
  onSignOut,
}: {
  events: ScannerEvents;
  current: ScannerEvents["events"][number];
  staffLine: string;
  picking: boolean;
  setPicking: (b: boolean) => void;
  onPick: (id: string) => void;
  sound: boolean;
  onSound: (v: boolean) => void;
  onStart: () => void;
  onManual: () => void;
  onSignOut: () => void;
}) {
  const total = current.checkedIn + current.remaining;
  const pct = total ? Math.round((current.checkedIn / total) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <Logo size={18} />
        <button onClick={onSignOut} className="text-[13px] text-ink-2 underline">
          {staffLine || events.staff.name} · Sign out
        </button>
      </div>
      {picking ? (
        <EventPicker events={events.events} onPick={onPick} />
      ) : (
        <button
          onClick={() => events.events.length > 1 && setPicking(true)}
          className="flex flex-col gap-1 rounded-xl border-2 border-ink bg-surface p-3.5 text-left"
        >
          <span className="label tracking-widest text-ok-fg">● Scanning for</span>
          <span className="display text-[28px]">{current.title}</span>
          <span className="text-[13px] text-ink-2">
            {fmtStamp(current.startsAt)} · {current.venue}
            {events.events.length > 1 ? (
              <>
                {" "}
                · <u>Change</u>
              </>
            ) : null}
          </span>
        </button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5 rounded-xl border border-rule bg-surface p-3.5">
          <span className="text-xs text-ink-2">Checked in</span>
          <span
            className="font-display text-5xl font-black leading-none"
            style={{ fontStretch: "70%" }}
          >
            {current.checkedIn}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-xl border border-rule bg-surface p-3.5">
          <span className="text-xs text-ink-2">Still to arrive</span>
          <span
            className="font-display text-5xl font-black leading-none text-ink-2"
            style={{ fontStretch: "70%" }}
          >
            {current.remaining}
          </span>
        </div>
      </div>
      <div className="h-1.5 rounded-sm bg-rule" role="img" aria-label={`${pct}% arrived`}>
        <div className="h-1.5 rounded-sm bg-ok-solid" style={{ width: `${pct}%` }} />
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ink-2">
        <input
          type="checkbox"
          className="accent-ink"
          checked={sound}
          onChange={(e) => onSound(e.target.checked)}
        />
        Play a tone on each result (leave off in a quiet venue)
      </label>
      <span className="flex-1" />
      <button
        onClick={onStart}
        className="flex h-[120px] flex-col items-center justify-center gap-0.5 rounded-2xl bg-ink text-paper"
      >
        <span
          className="font-display text-[40px] font-black uppercase"
          style={{ fontStretch: "70%" }}
        >
          Start scanning
        </span>
        <span className="text-[13px] text-[#b5aea3]">Uses the back camera</span>
      </button>
      <button
        onClick={onManual}
        className="h-14 rounded-xl border border-ink bg-surface text-base font-semibold"
      >
        Enter ticket ID manually
      </button>
    </div>
  );
}

function Camera({
  title,
  count,
  onCode,
  onDone,
  onManual,
  onFail,
}: {
  title: string;
  count: number;
  onCode: (r: ScanRequest) => void;
  onDone: () => void;
  onManual: () => void;
  onFail: (f: "blocked" | "missing") => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const cam = useRef<Camera | null>(null);
  const last = useRef<{ code: string; at: number } | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);

  useEffect(() => {
    let stopDecode = () => undefined as void;
    let cancelled = false;
    const el = video.current!;
    openCamera(el, facing).then(
      (c) => {
        if (cancelled) return c.stop();
        cam.current = c;
        setCanTorch(c.canTorch);
        stopDecode = startDecoding(el, (code) => {
          const now = Date.now();
          if (isDuplicateRead(last.current, code, now)) return;
          last.current = { code, at: now };
          const token = tokenFromScan(code);
          // not one of our links: still ask the server, which answers "not a valid ticket" and logs it
          onCode({ token: token ?? code.trim().slice(0, 200) });
        });
      },
      (err) => !cancelled && onFail(classifyCameraError(err)),
    );
    return () => {
      cancelled = true;
      stopDecode();
      cam.current?.stop();
      cam.current = null;
    };
  }, [facing, onCode, onFail]);

  const btn =
    "h-16 rounded-2xl bg-white/15 text-[13px] font-semibold text-paper disabled:opacity-40";
  return (
    <Full tone="dark">
      <div className="relative flex flex-1 flex-col">
        <video
          ref={video}
          muted
          playsInline
          aria-label="Camera preview"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="relative flex items-center justify-between px-4 py-3">
          <button
            onClick={onDone}
            className="h-11 rounded-full bg-black/60 px-3.5 text-sm font-semibold"
          >
            ✕ Done
          </button>
          <span className="rounded-full bg-black/60 px-2.5 py-1.5 text-xs">
            {title} · {count} in
          </span>
        </div>
        <div className="relative flex flex-1 flex-col items-center justify-center gap-5">
          <div className="relative size-[260px]" aria-hidden="true">
            {[
              "left-0 top-0 border-l-[5px] border-t-[5px] rounded-tl-[10px]",
              "right-0 top-0 border-r-[5px] border-t-[5px] rounded-tr-[10px]",
              "bottom-0 left-0 border-b-[5px] border-l-[5px] rounded-bl-[10px]",
              "bottom-0 right-0 border-b-[5px] border-r-[5px] rounded-br-[10px]",
            ].map((c) => (
              <div key={c} className={`absolute size-12 border-white ${c}`} />
            ))}
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-brand" />
          </div>
          <span
            role="status"
            className="rounded-full bg-black/60 px-3.5 py-2 text-lg font-semibold"
          >
            Point at the ticket QR code
          </span>
        </div>
        <div className="relative grid grid-cols-3 gap-2 px-4 pb-7 pt-4">
          <button
            className={btn}
            disabled={!canTorch}
            onClick={() => {
              const v = !torch;
              setTorch(v);
              void cam.current?.torch(v);
            }}
          >
            {torch ? "Torch off" : "Torch"}
          </button>
          <button className={btn} onClick={onManual}>
            Type ID
          </button>
          <button
            className={btn}
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
          >
            Flip camera
          </button>
        </div>
      </div>
    </Full>
  );
}

function Manual({ onSubmit, onBack }: { onSubmit: (id: string) => void; onBack: () => void }) {
  const [v, setV] = useState("");
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  const ok = isCompleteTicketId(v);
  return (
    <Full tone="light">
      <form
        className="flex flex-1 flex-col gap-3.5 px-5 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSubmit(normalizeTicketId(v));
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="h-11 self-start bg-transparent p-0 text-[15px] font-semibold"
        >
          ← Back to camera
        </button>
        <h1 className="display text-4xl">Enter ticket ID</h1>
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Printed under the QR code
          <input
            ref={field}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={v}
            onChange={(e) => setV(e.target.value.toUpperCase())}
            placeholder="TKT-XXXX-XXXX"
            className="h-16 rounded-xl border-2 border-ink bg-surface px-3.5 font-mono text-2xl font-semibold tracking-wider"
          />
        </label>
        <span className="text-[13px] leading-snug text-ink-2">
          8 letters and digits. No O or I is used, so 0 and 1 are always numbers.
        </span>
        <span className="flex-1" />
        <button
          type="submit"
          disabled={!ok}
          className="h-16 rounded-xl bg-ink text-lg font-semibold text-paper disabled:bg-rule disabled:text-faint"
        >
          Check ticket
        </button>
        <span className="text-center text-xs text-muted">
          Manual checks are logged with your name.
        </span>
      </form>
    </Full>
  );
}

function OfflineCard({
  badge,
  title,
  body,
  steps = [],
  cta,
  onCta,
  secondary,
  onSecondary,
}: {
  badge?: string;
  title: string;
  body: string;
  steps?: string[];
  cta: string;
  onCta: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 px-6 py-7">
      {badge ? (
        <span className="inline-flex self-start rounded-full bg-bad-bg px-3 py-1.5 text-sm font-semibold text-bad-fg">
          {badge}
        </span>
      ) : null}
      <h1 className="display text-4xl">{title}</h1>
      <p className="text-base leading-normal text-ink-3">{body}</p>
      {steps.length ? (
        <ol className="m-0 pl-5 text-[15px] leading-relaxed text-ink-3">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      ) : null}
      <span className="flex-1" />
      <button onClick={onCta} className="h-16 rounded-xl bg-ink text-lg font-semibold text-paper">
        {cta}
      </button>
      {secondary ? (
        <button
          onClick={onSecondary}
          className="h-14 rounded-xl border border-ink bg-transparent text-base font-semibold"
        >
          {secondary}
        </button>
      ) : null}
    </div>
  );
}
