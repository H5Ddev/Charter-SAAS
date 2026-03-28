/**
 * AeroComm brand logo — plane ascending through a ring.
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

function PlaneInRing({ size = 40, color = 'white' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Circle ring — slightly lower center so ascending plane feels centered */}
      <circle cx="50" cy="54" r="33" stroke={color} strokeWidth="4.5" fill="none" />

      {/* Ascending commercial jet silhouette (~25° nose-up) */}
      <g transform="rotate(-25, 50, 54)">
        {/* Fuselage */}
        <path
          d="M16 46 L75 46 Q84 46 87 52 Q84 58 75 58 L16 58 Z"
          fill={color}
        />
        {/* Main wing (upper / starboard) */}
        <path
          d="M54 46 L29 18 L46 46 Z"
          fill={color}
        />
        {/* Main wing (lower / port) */}
        <path
          d="M54 58 L29 86 L46 58 Z"
          fill={color}
        />
        {/* Vertical tail fin */}
        <path
          d="M22 46 L13 24 L23 42 Z"
          fill={color}
        />
        {/* Horizontal stabiliser — upper */}
        <path
          d="M22 46 L9 38 L19 46 Z"
          fill={color}
        />
        {/* Horizontal stabiliser — lower */}
        <path
          d="M22 58 L9 66 L19 58 Z"
          fill={color}
        />
      </g>
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
        <PlaneInRing size={collapsed ? 30 : 32} color="white" />
      </div>
      {!collapsed && (
        <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">
          Aero<span className="text-blue-300">Comm</span>
        </span>
      )}
    </div>
  )
}

// ─── Login page left panel — large display logo ───────────────────────────────

export function LoginPanelLogo() {
  return (
    <div className="flex items-center gap-4">
      <PlaneInRing size={48} color="white" />
      <span className="text-white font-semibold text-2xl tracking-tight">
        Aero<span className="text-blue-300">Comm</span>
      </span>
    </div>
  )
}

// ─── Small inline logo — white (mobile header, dark backgrounds) ──────────────

export function InlineLogoWhite({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <PlaneInRing size={size} color="white" />
      <span className="text-white font-semibold text-lg tracking-tight">
        Aero<span className="text-blue-300">Comm</span>
      </span>
    </div>
  )
}

// ─── Small inline logo — dark (light backgrounds like login form, portal) ─────

export function InlineLogoDark({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <PlaneInRing size={size} color="#1e3a8f" />
      <span className="font-semibold text-lg tracking-tight text-gray-900">
        Aero<span className="text-blue-700">Comm</span>
      </span>
    </div>
  )
}

// ─── Portal footer wordmark ───────────────────────────────────────────────────

export function PortalWordmark() {
  return (
    <span className="font-semibold tracking-tight">
      Aero<span className="text-blue-600">Comm</span>
    </span>
  )
}
