export interface FacilitiesCardProps {
  airport?: string;
  need?: string;
  result?: string;
}

/**
 * Facilities lookup card (PLAN-v2 NEW). SFO + DEN static table via lib/facilities.ts.
 * Shows airport amenities (pharmacy, water, rest zone, family restroom, medical room).
 */
export default function FacilitiesCard({ airport, need, result }: FacilitiesCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-card p-4 shadow-card">
      <span aria-hidden className="text-xl">🏢</span>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text">
          {airport ? `Facilities · ${airport}` : "Facilities"}
        </span>
        {need && result ? (
          <span className="text-xs text-text-muted">
            {need}: {result}
          </span>
        ) : (
          <span className="text-xs text-text-muted">No facility lookup yet.</span>
        )}
      </div>
    </div>
  );
}
