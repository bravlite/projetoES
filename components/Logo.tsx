// Marca do Concluído: círculo petróleo (mar), linha d'água sutil e o check
// terracota — a promessa central: você só paga quando estiver concluído.

export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      {/* círculo base */}
      <circle cx="24" cy="24" r="22" fill="#1f5f66" />
      {/* linha d'água — simétrica, dois vales centrados */}
      <path
        d="M10 34c4.5-3 9.5-3 14 0s9.5 3 14 0"
        stroke="#7cc4c7"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* check terracota, centrado no círculo */}
      <path
        d="M14.5 23.5 21 30l12.5-14"
        stroke="#e8866a"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-8 w-8" />
      <span className="font-display text-xl font-bold tracking-tight text-brand-800">
        concluído<span className="text-clay-500">.</span>
      </span>
    </span>
  )
}
