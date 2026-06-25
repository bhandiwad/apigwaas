// Sify brand: lime green #8DC63F, Poppins 700
const GREEN = "#8DC63F";
const FONT  = "'Poppins', 'Nunito', sans-serif";

interface SifyLogoProps {
  /** Show wordmark + "API Gateway" label (sidebar expanded) */
  withLabel?: boolean;
  /** Collapsed sidebar — just the "S" glyph */
  collapsed?: boolean;
  className?: string;
}

export function SifyLogo({ withLabel = false, collapsed = false, className = "" }: SifyLogoProps) {
  if (collapsed) {
    return (
      <span className={className} style={{ fontFamily: FONT, fontWeight: 700, fontSize: "17px", color: GREEN, letterSpacing: "-0.5px" }}>
        S
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      {/* sify wordmark */}
      <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: "17px", color: GREEN, letterSpacing: "-0.5px", lineHeight: 1 }}>
        sify
        <sup style={{ fontSize: "9px", color: GREEN, marginLeft: "1px" }}>®</sup>
      </span>
      {withLabel && (
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: "13px", color: "#1a2e4a", letterSpacing: "-0.2px", lineHeight: 1 }}>
          API Gateway
        </span>
      )}
    </span>
  );
}
