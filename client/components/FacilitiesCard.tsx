export interface FacilitiesCardProps {
  airport?: string;
  need?: string;
  result?: string;
}

export default function FacilitiesCard({ airport, need, result }: FacilitiesCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-card">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-text-muted">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text">
          {airport ? `${airport} facilities` : "Facilities"}
        </span>
        {need && result ? (
          <span className="text-xs text-text-muted">
            {need}: {result}
          </span>
        ) : (
          <span className="text-xs text-text-muted">Ask the advocate about airport facilities.</span>
        )}
      </div>
    </div>
  );
}
