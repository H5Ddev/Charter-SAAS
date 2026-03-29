/**
 * AeroPulse brand logo — ascending plane above an ECG pulse line.
 *
 * The QRS spike of the pulse line reaches up toward the plane's fuselage,
 * visually linking "aero" (flight) and "pulse" (vital sign / live tracking).
 *
 * Variants:
 *   "white"  — all white (sidebar dark bg, login left panel)
 *   "dark"   — dark navy (white/light backgrounds)
 *   "color"  — gradient blue icon + dark text (portal, standalone)
 */

interface IconProps {
  size?: number
  color?: string
}

function PlaneWithPulse({ size = 40, color = 'white' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── Ascending plane (upper portion, 25° nose-up) ── */}
      <g transform="translate(46, 38) rotate(-25)">
        {/* Fuselage */}
        <path
          d="M-26 -5 L20 -5 Q28 -5 31 0 Q28 5 20 5 L-26 5 Z"
          fill={color}
        />
        {/* Main wing starboard */}
        <path d="M6 -5 L-16 -26 L0 -5 Z" fill={color} />
        {/* Main wing port */}
        <path d="M6 5 L-16 26 L0 5 Z" fill={color} />
        {/* Vertical tail fin */}
        <path d="M-20 -5 L-28 -20 L-17 -5 Z" fill={color} />
        {/* Horizontal stabiliser upper */}
        <path d="M-20 -5 L-32 -1 L-18 -5 Z" fill={color} />
        {/* Horizontal stabiliser lower */}
        <path d="M-20 5 L-32 1 L-18 5 Z" fill={color} />
      </g>

      {/* ── ECG / sinus pulse line (lower portion) ── */}
      {/*
        Path: flat left → P-wave bump → Q dip → R spike up (toward plane) →
              S spike down → T-wave bump → flat right
        Baseline at y=72, R-peak at y=20 (reaches toward plane fuselage)
      */}
      <path
        d="M2 72 L22 72 L28 63 L34 72 L40 80 L47 18 L54 82 L60 72 L68 72 L73 62 L78 72 L98 72"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

// ─── Sidebar logo (icon + wordmark, collapses to icon only) ──────────────────

interface SidebarLogoProps {
  collapsed?: boolean
}

export function SidebarLogo({ collapsed = false }: SidebarLogoProps) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="shrink-0">
        <PlaneWithPulse size={collapsed ? 30 : 32} color="white" />
      </div>
      {!collapsed && (
        <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
          Aero<span className="text-blue-300">Pulse</span>
        </span>
      )}
    </div>
  )
}

// ─── Login page left panel — large display logo ───────────────────────────────

export function LoginPanelLogo() {
  return (
    <div className="flex items-center gap-4">
      <PlaneWithPulse size={48} color="white" />
      <span className="text-white font-semibold text-2xl tracking-tight">
        Aero<span className="text-blue-300">Pulse</span>
      </span>
    </div>
  )
}

// ─── Small inline logo — white (mobile header, dark backgrounds) ──────────────

export function InlineLogoWhite({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <PlaneWithPulse size={size} color="white" />
      <span className="text-white font-semibold text-lg tracking-tight">
        Aero<span className="text-blue-300">Pulse</span>
      </span>
    </div>
  )
}

// ─── Small inline logo — dark (light backgrounds like login form, portal) ─────

export function InlineLogoDark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <PlaneWithPulse size={size} color="#1e3a8f" />
      <span className="font-semibold text-lg tracking-tight text-gray-900">
        Aero<span className="text-blue-700">Pulse</span>
      </span>
    </div>
  )
}

// ─── Portal footer wordmark ───────────────────────────────────────────────────

export function PortalWordmark() {
  return (
    <span className="font-semibold tracking-tight">
      Aero<span className="text-blue-600">Pulse</span>
    </span>
  )
}
