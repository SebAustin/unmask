import type { RedFlag } from "@/lib/domain/verdict";

const MASK_TOKEN = /(\[(?:card|SSN|IBAN|account|routing number|code|password)[^\]]*\])/g;

interface ExhibitProps {
  readonly text: string;
  readonly redFlags: readonly RedFlag[];
}

/** The message shown back as an annotated exhibit; each Red Flag is marked in place and numbered. */
export function Exhibit({ text, redFlags }: ExhibitProps) {
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  // Defensive: render flags in order and never overlap, whatever the caller passes.
  const ordered = [...redFlags].sort((a, b) => a.start - b.start).filter((f, i, all) => i === 0 || f.start >= all[i - 1].end);
  ordered.forEach((flag, index) => {
    if (flag.start > cursor) pieces.push(<Plain key={`p${cursor}`} text={text.slice(cursor, flag.start)} />);
    pieces.push(
      <mark key={`m${flag.start}`}>
        {text.slice(flag.start, flag.end)}
        <a href={`#flag-${index + 1}`} aria-label={`Red flag ${index + 1}: jump to explanation`}>
          {index + 1}
        </a>
      </mark>,
    );
    cursor = flag.end;
  });
  if (cursor < text.length) pieces.push(<Plain key={`p${cursor}`} text={text.slice(cursor)} />);

  return (
    <figure className="relative">
      <figcaption className="mb-2 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        Exhibit A — your message, with red flags marked
      </figcaption>
      <blockquote
        tabIndex={0}
        aria-label="Exhibit A: your message, with red flags marked"
        className="exhibit max-h-[26rem] overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-sm border border-rule-strong bg-paper-raised p-5 font-mono text-[0.95rem] leading-7 shadow-[var(--shadow)]">
        {pieces}
      </blockquote>
    </figure>
  );
}

function Plain({ text }: { text: string }) {
  return (
    <>
      {/* split() with a capture group puts the mask tokens at odd indexes */}
      {text.split(MASK_TOKEN).map((part, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            title="Hidden for your privacy before analysis"
            className="mx-0.5 rounded bg-paper-sunk px-1.5 py-0.5 text-[0.8em] text-ink-soft ring-1 ring-rule"
          >
            {part}
            <span className="sr-only"> (hidden for privacy)</span>
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
