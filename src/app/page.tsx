import Link from "next/link";
import { Checker } from "@/components/checker/Checker";
import { RecoveryPanel } from "@/components/respond/RecoveryPanel";
import { SafeWordCard } from "@/components/respond/SafeWordCard";

export default function Home() {
  return (
    <>
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-4 py-5 sm:px-8">
        <Link href="/" className="font-display text-2xl tracking-tight">
          Unmask<span className="text-scam">.</span>
        </Link>
        <nav aria-label="Main navigation" className="flex gap-4 text-sm font-medium text-ink-soft sm:gap-5">
          <a href="#how" className="hidden min-h-11 items-center hover:text-ink sm:inline-flex">How it works</a>
          <a href="#help" className="inline-flex min-h-11 items-center hover:text-ink">Already paid?</a>
          <a href="#safe-word" className="inline-flex min-h-11 items-center hover:text-ink">Safe word</a>
        </nav>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        <section aria-labelledby="hero-heading" className="grid gap-6 pb-10 pt-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:pt-14">
          <h1 id="hero-heading" className="font-display text-[length:var(--text-display)] leading-[0.92] tracking-tight">
            Is it really them,
            <br />
            <em className="text-scam">or a scam?</em>
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-ink-soft lg:pb-3">
            Paste a text, email, link or screenshot. Unmask points out the exact red flags, tells you how to check safely, and
            what to do if you already clicked or paid.
          </p>
        </section>

        <Checker />

        <section id="how" aria-labelledby="how-heading" className="mt-[var(--space-section)] grid gap-10 border-t border-rule pt-12 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="how-heading" className="font-display text-[length:var(--text-title)] leading-tight">
            Two investigators,
            <br />
            one verdict
          </h2>
          <ol className="grid gap-8 sm:grid-cols-3">
            {[
              ["Rule checks", "Fixed rules catch fake-looking web addresses, faked senders, gift-card and crypto demands, and hidden orders aimed at AI filters."],
              ["AI analyst", "An open-source AI model reads the message like a fraud analyst, names who it pretends to be, and quotes the exact suspicious words."],
              ["Safety floor", "If the rules find hard evidence, the AI can't overrule them. A scam that tricks the AI still won't come back as safe."],
            ].map(([title, body], i) => (
              <li key={title}>
                <span aria-hidden="true" className="font-display text-4xl text-scam">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <div id="help" className="mt-[var(--space-section)] scroll-mt-6">
          <RecoveryPanel />
        </div>

        <div id="safe-word" className="mt-[var(--space-section)] scroll-mt-6">
          <SafeWordCard />
        </div>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-ink-faint sm:flex-row sm:justify-between sm:px-8">
          <p>Unmask stores nothing. Messages are analysed and forgotten. Not legal or financial advice.</p>
          <p>Built for ForgeHacks 2026 · AI + Cybersecurity</p>
        </div>
      </footer>
    </>
  );
}
