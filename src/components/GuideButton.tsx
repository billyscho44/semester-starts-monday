"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guideFor } from "@/lib/exercise-guide";

export default function GuideButton({ name, label, className }: { name: string; label?: string; className?: string }) {
  const g = guideFor(name);
  const ref = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  if (!g) return <span className={className}>{label ?? name}</span>;
  const q = encodeURIComponent(`${g.title} how to`);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${className ?? ""} underline decoration-dotted underline-offset-4`}
        aria-haspopup="dialog"
      >
        {label ?? name}
      </button>
      {open && createPortal(
      <dialog
        ref={(el) => {
          ref.current = el;
          if (el && !el.open) el.showModal();
        }}
        aria-label={g.title}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
        className="m-auto w-[min(92vw,26rem)] max-h-[88vh] overflow-y-auto rounded-2xl border border-line bg-card p-0 text-ink backdrop:bg-black/50"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{g.title}</h2>
            <button
              type="button" autoFocus onClick={() => ref.current?.close()}
              className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-xl text-muted" aria-label="Close"
            >
              ✕
            </button>
          </div>
          {g.photo && (
            <div className="mt-3">
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((n) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={n} src={`/exercises/${g.photo}/${n}.jpg`} alt={`${g.title}, ${n === 0 ? "start" : "end"} position`}
                    loading="lazy" className="aspect-[3/4] w-full rounded-xl border border-line object-cover"
                  />
                ))}
              </div>
              {g.photoNote && <p className="mt-1.5 text-xs text-muted">{g.photoNote}</p>}
            </div>
          )}
          <dl className="mt-4 space-y-3 text-sm leading-snug">
            <div><dt className="font-semibold">Set up</dt><dd className="mt-0.5 text-muted">{g.setup}</dd></div>
            <div><dt className="font-semibold">Move</dt><dd className="mt-0.5 text-muted">{g.move}</dd></div>
            <div><dt className="font-semibold">Watch for</dt><dd className="mt-0.5 text-muted">{g.watch}</dd></div>
          </dl>
          <a
            href={`https://www.youtube.com/results?search_query=${q}`} target="_blank" rel="noopener noreferrer"
            className="mt-4 flex min-h-11 items-center text-sm text-accent underline underline-offset-4"
          >
            Search for a video on YouTube
          </a>
          {g.photo && <p className="mt-1 text-xs text-muted">Photos: free-exercise-db, public domain.</p>}
        </div>
      </dialog>,
      document.body,
      )}
    </>
  );
}
