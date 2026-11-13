import { cx } from "./ui";

/** Emblème : un noyau doré et ses dossiers en orbite. */
export function Embleme({ taille = 36, className }: { taille?: number; className?: string }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <radialGradient id="embleme-noyau" cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#fff1cf" />
          <stop offset="55%" stopColor="#dcb873" />
          <stop offset="100%" stopColor="#8a6a2f" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="17.5" stroke="#dcb873" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 3.2" />
      <circle cx="20" cy="20" r="12" stroke="#2fb8a8" strokeOpacity="0.55" strokeWidth="1" />
      <circle cx="20" cy="20" r="6.5" fill="url(#embleme-noyau)" />
      <circle cx="32" cy="20" r="2.4" fill="#e77a9d" />
      <circle cx="11.5" cy="11.5" r="2" fill="#9b8ff0" />
      <circle cx="12.6" cy="30.4" r="1.7" fill="#45c896" />
    </svg>
  );
}

export function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <Embleme />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[1.02rem] font-semibold tracking-tight text-or-clair">AWA Sinistres</span>
          <span className="block text-[0.72rem] tracking-wide text-encre-3">Plateforme de gestion</span>
        </span>
      )}
    </span>
  );
}
