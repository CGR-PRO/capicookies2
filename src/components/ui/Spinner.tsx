export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} role={label ? 'status' : undefined} aria-label={label}>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <Spinner size={28} label={label} />
      <span className="muted">{label}</span>
    </div>
  );
}
