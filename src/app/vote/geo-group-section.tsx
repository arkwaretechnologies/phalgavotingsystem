"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { Candidate, GeoGroup } from "@/lib/db/types";

type Props = { group: GeoGroup; candidates: Candidate[] };

const DND_MIME = "application/x-phalga-geo-candidate";

type DragPayload = {
  candidateId: string;
  from: "pool" | "slot";
  slotIndex?: number;
  geoId: number;
};

function parsePayload(s: string | undefined): DragPayload | null {
  if (!s) return null;
  try {
    const p = JSON.parse(s) as DragPayload;
    if (p.candidateId && p.from) return p;
  } catch {
    /* empty */
  }
  return null;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

type FlyingPayload = {
  candidateId: string;
  from: DOMRect;
  to: DOMRect;
  targetSlot: number;
  photoUrl: string | null;
  name: string;
  key: number;
};

type PoolDragState = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  offX: number;
  offY: number;
};

function FlyToSlotLayer({
  payload,
  onComplete,
}: {
  payload: FlyingPayload;
  onComplete: (candidateId: string, targetSlot: number) => void;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    const el = elRef.current;
    if (!el) return;
    doneRef.current = false;
    const { from, to, candidateId, targetSlot } = payload;
    const sw = to.width / from.width;
    const sh = to.height / from.height;

    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onCompleteRef.current(candidateId, targetSlot);
    };

    el.style.transition = "none";
    el.style.width = `${from.width}px`;
    el.style.height = `${from.height}px`;
    el.style.transform = `translate3d(${from.left}px, ${from.top}px, 0) scale(1, 1)`;
    el.style.opacity = "1";
    el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.12)";

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- reflow for FLIP
    el.offsetWidth;

    const raf = requestAnimationFrame(() => {
      if (!elRef.current) return;
      elRef.current.style.transitionProperty = "transform, opacity, box-shadow";
      elRef.current.style.transitionDuration = "0.55s";
      elRef.current.style.transitionTimingFunction = "cubic-bezier(0.22, 1, 0.3, 1)";
      elRef.current.style.transform = `translate3d(${to.left}px, ${to.top}px, 0) scale(${sw}, ${sh})`;
      elRef.current.style.boxShadow = "0 20px 40px -10px rgba(0,0,0,0.2)";
      elRef.current.style.opacity = "0.9";
    });

    const end = (e: TransitionEvent) => {
      if (e.propertyName !== "transform" || !elRef.current) return;
      finish();
    };
    el.addEventListener("transitionend", end);
    const timeout = window.setTimeout(finish, 800);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("transitionend", end);
      clearTimeout(timeout);
    };
  }, [payload]);

  return createPortal(
    <div
      ref={elRef}
      className="pointer-events-none fixed left-0 top-0 z-[100] origin-top-left overflow-hidden rounded-xl border-2 border-white bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-900 dark:shadow-black/30"
      style={{ willChange: "transform" }}
    >
      {payload.photoUrl ? (
        <img
          src={payload.photoUrl}
          alt=""
          className="size-full object-cover object-top"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-slate-100 text-2xl font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {payload.name
            .split(/\s+/)
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}
    </div>,
    document.body,
  );
}

function PoolDragFloat({ drag, candidate }: { drag: PoolDragState; candidate: Candidate }) {
  const { x, y, w, h, offX, offY } = drag;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[90] origin-top-left overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-slate-50/95 shadow-2xl dark:border-white/15 dark:bg-slate-900/95"
      style={{
        left: x - offX,
        top: y - offY,
        width: w,
        height: h,
        willChange: "transform, left, top",
      }}
    >
      <div className="flex h-full flex-col">
        <div className="pointer-events-none min-h-0 flex-1 overflow-hidden bg-linear-to-b from-slate-100 to-slate-200/50 dark:from-slate-800 dark:to-slate-900/80">
          {candidate.photo_url ? (
            <img
              src={candidate.photo_url}
              alt=""
              className="size-full object-cover object-top"
            />
          ) : (
            <div className="flex size-full min-h-0 items-center justify-center text-2xl font-medium text-slate-400">
              {candidate.full_name
                .split(/\s+/)
                .map((s) => s[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
        </div>
        <p className="shrink-0 border-t border-slate-200/80 bg-white/95 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-slate-900 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100">
          {candidate.full_name}
        </p>
      </div>
    </div>,
    document.body,
  );
}

const POOL_FLIP_MS = 520;
const POOL_FLIP_EASING = "cubic-bezier(0.25, 0.46, 0.3, 1)";

function measurePoolRects(ul: HTMLUListElement | null) {
  const m = new Map<string, DOMRect>();
  if (!ul) return m;
  ul.querySelectorAll<HTMLElement>("[data-pool-candidate]").forEach((el) => {
    const id = el.dataset.poolCandidate;
    if (id) m.set(id, el.getBoundingClientRect());
  });
  return m;
}

function clearPoolFlipStyles(ul: HTMLUListElement | null) {
  if (!ul) return;
  ul.querySelectorAll<HTMLElement>("[data-pool-candidate]").forEach((el) => {
    el.style.transform = "";
    el.style.transition = "";
    el.style.willChange = "";
    el.style.zIndex = "";
  });
}

export function GeoGroupSection({ group, candidates }: Props) {
  const maxSlots = Math.min(10, Math.max(1, group.max_votes ?? 3));
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: maxSlots }, () => null),
  );
  const [flying, setFlying] = useState<FlyingPayload | null>(null);
  const [poolDrag, setPoolDrag] = useState<PoolDragState | null>(null);
  const isSlotDraggingRef = useRef(false);
  const cardImageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const slotBoxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const unselectStripRef = useRef<HTMLDivElement | null>(null);
  const poolListRef = useRef<HTMLUListElement | null>(null);
  const poolLayoutSnapshotRef = useRef(new Map<string, DOMRect>());
  const poolFlipEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  const byId = useMemo(
    () => Object.fromEntries(candidates.map((c) => [c.id, c])) as Record<string, Candidate>,
    [candidates],
  );

  /** Not placed in a slot yet. Stays in the grid (invisible) during fly/drag so layout only reflows after placement. */
  const poolCandidates = useMemo(
    () => candidates.filter((c) => !slots.includes(c.id)),
    [candidates, slots],
  );

  const poolVisibleCount = useMemo(
    () =>
      poolCandidates.filter(
        (c) =>
          c.id !== flying?.candidateId && c.id !== poolDrag?.id,
      ).length,
    [poolCandidates, flying, poolDrag],
  );

  const poolIdsKey = useMemo(
    () => poolCandidates.map((c) => c.id).join("\0"),
    [poolCandidates],
  );

  /** FLIP: smooth motion when the pool grid reflows (after a choice is placed or removed). */
  useLayoutEffect(() => {
    const ul = poolListRef.current;
    if (!ul) return;

    if (reducedMotion) {
      if (poolFlipEndTimerRef.current) {
        clearTimeout(poolFlipEndTimerRef.current);
        poolFlipEndTimerRef.current = null;
      }
      clearPoolFlipStyles(ul);
      poolLayoutSnapshotRef.current = measurePoolRects(ul);
      return;
    }

    if (poolFlipEndTimerRef.current) {
      clearTimeout(poolFlipEndTimerRef.current);
      poolFlipEndTimerRef.current = null;
    }
    clearPoolFlipStyles(ul);

    const prev = poolLayoutSnapshotRef.current;
    const newRects = measurePoolRects(ul);

    if (prev.size === 0) {
      poolLayoutSnapshotRef.current = newRects;
      return;
    }

    const items: { el: HTMLElement; dx: number; dy: number }[] = [];
    newRects.forEach((newR, id) => {
      const oldR = prev.get(id);
      if (!oldR) return;
      const dx = oldR.left - newR.left;
      const dy = oldR.top - newR.top;
      if (Math.hypot(dx, dy) < 1.2) return;
      const el = Array.from(
        ul.querySelectorAll<HTMLElement>("[data-pool-candidate]"),
      ).find((node) => node.dataset.poolCandidate === id);
      if (!el) return;
      items.push({ el, dx, dy });
    });

    if (items.length === 0) {
      poolLayoutSnapshotRef.current = newRects;
      return;
    }

    for (const { el, dx, dy } of items) {
      el.style.transition = "none";
      el.style.willChange = "transform";
      el.style.zIndex = "1";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- reflow
    if (items[0]) items[0].el.offsetWidth;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        for (const { el } of items) {
          el.style.transition = `transform ${POOL_FLIP_MS}ms ${POOL_FLIP_EASING}`;
          el.style.transform = "translate(0, 0)";
        }
        poolFlipEndTimerRef.current = setTimeout(() => {
          clearPoolFlipStyles(ul);
          poolLayoutSnapshotRef.current = measurePoolRects(ul);
          poolFlipEndTimerRef.current = null;
        }, POOL_FLIP_MS + 40);
      });
    });

    return () => {
      if (poolFlipEndTimerRef.current) {
        clearTimeout(poolFlipEndTimerRef.current);
        poolFlipEndTimerRef.current = null;
      }
    };
  }, [poolIdsKey, reducedMotion]);

  const payload = useCallback(
    (p: DragPayload) => JSON.stringify(p),
    [],
  );

  const completeFly = useCallback((candidateId: string, targetSlot: number) => {
    setSlots((prev) => {
      const next = [...prev];
      if (next[targetSlot] === null) {
        next[targetSlot] = candidateId;
      }
      return next;
    });
    setFlying(null);
  }, []);

  const clearSlot = useCallback((index: number) => {
    setSlots((prev) => {
      const n = [...prev];
      n[index] = null;
      return n;
    });
  }, []);

  const findSlotIndexAt = useCallback(
    (clientX: number, clientY: number) => {
      for (let i = 0; i < maxSlots; i++) {
        const el = slotBoxRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          clientX >= r.left &&
          clientX < r.right &&
          clientY >= r.top &&
          clientY < r.bottom
        ) {
          return i;
        }
      }
      return null;
    },
    [maxSlots],
  );

  const isOverUnselectStrip = useCallback(
    (clientX: number, clientY: number) => {
      const el = unselectStripRef.current;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return (
        clientX >= r.left &&
        clientX < r.right &&
        clientY >= r.top &&
        clientY < r.bottom
      );
    },
    [],
  );

  /** Tap: add to next free slot (fly) or deselect is only via slot × / clear strip, not in pool. */
  const onTap = useCallback(
    (candidateId: string) => {
      if (flying || poolDrag) return;
      if (isSlotDraggingRef.current) {
        isSlotDraggingRef.current = false;
        return;
      }
      const empty = slots.findIndex((s) => s === null);
      if (empty < 0) return;
      const fromEl = cardImageRefs.current.get(candidateId);
      const toEl = slotBoxRefs.current[empty];
      const c = byId[candidateId];
      if (reducedMotion || !fromEl || !toEl) {
        setSlots((prev) => {
          const n = [...prev];
          n[empty] = candidateId;
          return n;
        });
        return;
      }
      setFlying({
        candidateId,
        from: fromEl.getBoundingClientRect(),
        to: toEl.getBoundingClientRect(),
        targetSlot: empty,
        photoUrl: c?.photo_url ?? null,
        name: c?.full_name ?? "",
        key: Date.now(),
      });
    },
    [slots, flying, poolDrag, reducedMotion, byId],
  );

  const onPoolPointerDown = useCallback(
    (e: React.PointerEvent, c: Candidate) => {
      if (flying || poolDrag) return;
      if (e.button !== 0) return;
      const target = e.currentTarget as HTMLElement;
      const id = c.id;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      let started = false;
      if (typeof target.setPointerCapture === "function") {
        try {
          target.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (
          !started &&
          (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8)
        ) {
          started = true;
          const r = target.getBoundingClientRect();
          setPoolDrag({
            id,
            x: ev.clientX,
            y: ev.clientY,
            w: r.width,
            h: r.height,
            offX: ev.clientX - r.left,
            offY: ev.clientY - r.top,
          });
        } else if (started) {
          setPoolDrag((p) => (p && p.id === id ? { ...p, x: ev.clientX, y: ev.clientY } : p));
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          target.releasePointerCapture?.(pointerId);
        } catch {
          /* no-op */
        }
        if (started) {
          const x = ev.clientX;
          const y = ev.clientY;
          if (isOverUnselectStrip(x, y)) {
            /* drop on strip: cancel (same as outside slot) */
          } else {
            const slotI = findSlotIndexAt(x, y);
            if (slotI != null) {
              setSlots((prev) => {
                const n = prev.map((s) => (s === id ? null : s));
                n[slotI] = id;
                return n;
              });
            }
          }
          setPoolDrag(null);
        } else {
          onTap(id);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [
      flying,
      poolDrag,
      onTap,
      isOverUnselectStrip,
      findSlotIndexAt,
    ],
  );

  const onDragStartSlot = (e: React.DragEvent, c: Candidate, slotIndex: number) => {
    isSlotDraggingRef.current = true;
    e.dataTransfer.setData(
      DND_MIME,
      payload({ candidateId: c.id, from: "slot", slotIndex, geoId: group.id }),
    );
    e.dataTransfer.setData("text/plain", c.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropSlot = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p = parsePayload(e.dataTransfer.getData(DND_MIME));
    if (!p || p.geoId !== group.id) return;

    if (p.from === "slot" && p.slotIndex !== undefined && p.slotIndex === targetIndex) {
      isSlotDraggingRef.current = false;
      return;
    }

    if (p.from === "slot" && p.slotIndex !== undefined) {
      setSlots((prev) => {
        const next = [...prev];
        [next[p.slotIndex!], next[targetIndex]] = [next[targetIndex], next[p.slotIndex!]];
        return next;
      });
    }
    isSlotDraggingRef.current = false;
  };

  const onDropUnselect = (e: React.DragEvent) => {
    e.preventDefault();
    const p = parsePayload(e.dataTransfer.getData(DND_MIME));
    if (!p || p.geoId !== group.id || p.from !== "slot" || p.slotIndex === undefined) return;
    setSlots((prev) => {
      const next = [...prev];
      next[p.slotIndex!] = null;
      return next;
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDragEnd = () => {
    setTimeout(() => {
      isSlotDraggingRef.current = false;
    }, 0);
  };

  const code = group.code || "—";
  const filledCount = slots.filter(Boolean).length;
  const poolDragCandidate = poolDrag ? byId[poolDrag.id] : null;

  if (candidates.length === 0) {
    return (
      <section
        id={`geo-${group.id}`}
        className="scroll-mt-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/40"
      >
        <GeoHeader
          code={code}
          name={group.name}
          maxSlots={maxSlots}
          nCandidates={0}
          poolAvailable={0}
          filledCount={0}
        />
        <div className="p-5">
          <div className="flex min-h-[100px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="px-4 text-sm text-slate-500 dark:text-slate-500">
              No candidates in this region for the active conference.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id={`geo-${group.id}`}
      className="scroll-mt-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/40"
    >
      <GeoHeader
        code={code}
        name={group.name}
        maxSlots={maxSlots}
        nCandidates={candidates.length}
        poolAvailable={poolVisibleCount}
        filledCount={filledCount}
      />

      <div className="space-y-5 p-5">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">Drag</span> or{" "}
          <span className="font-medium text-slate-600 dark:text-slate-300">tap</span> a card into a
          slot. Use × or the strip below to remove.
        </p>

        {poolCandidates.length === 0 && !flying && !poolDrag ? (
          <p className="text-center text-sm text-slate-500 dark:text-slate-500">
            All choices are in your slots below, or add more by clearing a slot.
          </p>
        ) : null}

        <ul
          ref={poolListRef}
          className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 sm:gap-4"
        >
          {poolCandidates.map((c) => {
            const isPlacing =
              c.id === flying?.candidateId || c.id === poolDrag?.id;
            return (
            <li
              key={c.id}
              className="m-0 list-none p-0"
              data-pool-candidate={c.id}
            >
              <div
                role={isPlacing ? "presentation" : "button"}
                tabIndex={isPlacing ? -1 : 0}
                onKeyDown={(e) => {
                  if (isPlacing) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onTap(c.id);
                  }
                }}
                onPointerDown={(e) => (isPlacing ? undefined : onPoolPointerDown(e, c))}
                className={[
                  "group relative w-full select-none touch-manipulation text-left outline-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-500/50",
                  isPlacing ? "pointer-events-none" : "",
                ].join(" ")}
                style={{ touchAction: isPlacing ? "auto" : "none" }}
                aria-hidden={isPlacing}
                aria-label={
                  isPlacing
                    ? undefined
                    : `${c.full_name}. Tap to add to next free slot, or drag to a slot.`
                }
              >
                <div
                  className={[
                    "overflow-hidden rounded-2xl border-2 border-slate-200/90 bg-slate-50/80 shadow-sm transition hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20",
                    isPlacing ? "opacity-0" : "opacity-100",
                    isPlacing ? "" : "active:scale-[0.99] sm:cursor-grab",
                  ].join(" ")}
                >
                  <div
                    className="pointer-events-none aspect-[4/3] w-full overflow-hidden bg-linear-to-b from-slate-100 to-slate-200/60 dark:from-slate-800 dark:to-slate-900/80"
                    ref={(el) => {
                      if (el) cardImageRefs.current.set(c.id, el);
                      else cardImageRefs.current.delete(c.id);
                    }}
                  >
                    {c.photo_url ? (
                      <img
                        src={c.photo_url}
                        alt=""
                        className="size-full object-cover object-top"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl font-medium text-slate-400">
                        {c.full_name
                          .split(/\s+/)
                          .map((s) => s[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="border-t border-slate-200/80 bg-white/90 px-2 py-2.5 text-center text-xs font-semibold leading-tight text-slate-900 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100 sm:text-sm">
                    {c.full_name}
                  </p>
                </div>
              </div>
            </li>
            );
          })}
        </ul>

        <div>
          <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            Your choices ({filledCount} / {maxSlots})
          </p>
          <ol className="m-0 flex list-none flex-wrap gap-2 p-0 sm:gap-3" aria-label="Vote slots">
            {slots.map((id, i) => (
              <li key={i} className="flex-1 basis-[30%] sm:max-w-[140px]">
                <div
                  data-geo-slot={i}
                  ref={(el) => {
                    slotBoxRefs.current[i] = el;
                  }}
                  role="listitem"
                  onDragOver={onDragOver}
                  onDrop={onDropSlot(i)}
                  className={[
                    "relative min-h-[112px] rounded-2xl border-2 border-dashed transition",
                    id
                      ? "border-slate-300/90 bg-slate-50/90 dark:border-white/15 dark:bg-white/[0.04]"
                      : "border-slate-200/90 bg-slate-50/40 dark:border-white/10 dark:bg-white/[0.02]",
                  ].join(" ")}
                >
                  {id && byId[id] ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearSlot(i);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute right-1.5 top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-sm leading-none text-slate-500 shadow-sm backdrop-blur-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 active:scale-95 dark:border-white/15 dark:bg-slate-800/95 dark:text-slate-300 dark:hover:border-red-500/50 dark:hover:bg-red-950/50 dark:hover:text-red-300"
                        aria-label={`Remove ${byId[id].full_name} from this choice slot`}
                      >
                        <span aria-hidden className="pb-px text-[15px] font-light">
                          ×
                        </span>
                      </button>
                      <div
                        draggable
                        onDragStart={(e) => onDragStartSlot(e, byId[id]!, i)}
                        onDragEnd={onDragEnd}
                        onDragOver={onDragOver}
                        className="h-full w-full text-left"
                        role="img"
                        aria-label={`${byId[id].full_name} in choice slot ${i + 1}. Drag to another slot, or use remove.`}
                      >
                        <div className="flex flex-col items-stretch overflow-hidden rounded-xl p-1">
                          <div className="pointer-events-none aspect-[4/3] w-full overflow-hidden rounded-lg bg-slate-200/80 dark:bg-slate-800">
                            {byId[id].photo_url ? (
                              <img
                                src={byId[id].photo_url!}
                                alt=""
                                className="size-full object-cover object-top"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-lg text-slate-500">
                                {byId[id].full_name[0] ?? "?"}
                              </div>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 px-0.5 text-center text-[10px] font-medium leading-tight text-slate-800 dark:text-slate-100 sm:text-xs">
                            {byId[id].full_name}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[112px] items-center justify-center p-1 text-center">
                      <span className="text-2xl font-light text-slate-300 dark:text-slate-600">
                        {i + 1}
                      </span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div
          ref={unselectStripRef}
          onDragOver={onDragOver}
          onDrop={onDropUnselect}
          className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 text-xs text-slate-500 dark:border-white/10 dark:bg-slate-950/20 dark:text-slate-500"
        >
          <span>Drop a filled choice here to remove from your selection</span>
        </div>

        {flying ? (
          <FlyToSlotLayer
            key={flying.key}
            payload={flying}
            onComplete={completeFly}
          />
        ) : null}
        {poolDrag && poolDragCandidate ? (
          <PoolDragFloat drag={poolDrag} candidate={poolDragCandidate} />
        ) : null}
      </div>
    </section>
  );
}

function GeoHeader({
  code,
  name,
  maxSlots,
  nCandidates,
  poolAvailable,
  filledCount,
}: {
  code: string;
  name: string;
  maxSlots: number;
  nCandidates: number;
  poolAvailable?: number;
  filledCount?: number;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 dark:border-white/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex min-w-[2.5rem] items-center justify-center rounded-lg bg-slate-900 px-2 py-1 text-xs font-bold tracking-wide text-white dark:bg-slate-100 dark:text-slate-900"
            title="Region code"
          >
            {code}
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            {name}
          </h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {maxSlots} {maxSlots === 1 ? "slot" : "slots"} · {nCandidates} total ·{" "}
          {poolAvailable != null ? `${poolAvailable} available` : ""}
          {poolAvailable != null && filledCount != null ? " · " : null}
          {filledCount != null ? `${filledCount} selected` : null}
        </p>
      </div>
    </div>
  );
}
