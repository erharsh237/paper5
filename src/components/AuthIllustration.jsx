export default function AuthIllustration() {
  return (
    <div className="auth-illustration-wrap" aria-hidden="true">
      <svg
        viewBox="0 0 360 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="auth-illustration-svg"
      >
        <defs>
          <linearGradient id="p5BodyGrad" x1="100" y1="60" x2="260" y2="250" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E6E7EC" />
          </linearGradient>
          <linearGradient id="p5CobaltGrad" x1="140" y1="52" x2="225" y2="225" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="p5CoreGrad" x1="115" y1="125" x2="185" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="p5EmeraldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="p5VioletGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <filter id="p5SoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0F172A" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Ground Shadow */}
        <ellipse cx="180" cy="276" rx="118" ry="16" fill="#0F172A" fillOpacity="0.08" />

        {/* Subtle Floating Accent Shapes */}
        <circle cx="62" cy="96" r="10" fill="#DBEAFE" stroke="#1E293B" strokeWidth="2" />
        <rect x="288" y="88" width="16" height="16" rx="4" transform="rotate(15 288 88)" fill="#D1FAE5" stroke="#1E293B" strokeWidth="2" />
        <circle cx="304" cy="140" r="6" fill="#FDE68A" stroke="#1E293B" strokeWidth="2" />

        {/* Top Exhaust / Sync Antenna */}
        <g>
          <path d="M226 88 L244 54 L256 60 L238 96 Z" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.5" strokeLinejoin="round" />
          <rect x="243" y="45" width="16" height="10" rx="3" transform="rotate(28 243 45)" fill="#F59E0B" stroke="#1E293B" strokeWidth="2.5" />
          {/* Playful Cloud Puff */}
          <path
            d="M262 42 C262 36 268 32 274 34 C278 28 288 28 292 34 C298 34 302 40 300 46 C298 51 292 52 287 51 C282 54 274 54 270 50 C265 51 262 47 262 42 Z"
            fill="#FFFFFF"
            stroke="#1E293B"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>

        {/* Back Conveyor Track Extension */}
        <path
          d="M235 168 L314 196 C322 199 325 208 321 216 C318 223 309 226 301 223 L228 197 Z"
          fill="#F8FAFC"
          stroke="#1E293B"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Back Rollers */}
        <circle cx="268" cy="202" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
        <circle cx="268" cy="202" r="2.5" fill="#1E293B" />
        <circle cx="292" cy="210" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
        <circle cx="292" cy="210" r="2.5" fill="#1E293B" />

        {/* Main Spherical Workspace Hub */}
        <g filter="url(#p5SoftShadow)">
          {/* Outer White Shell */}
          <circle cx="176" cy="160" r="82" fill="url(#p5BodyGrad)" stroke="#1E293B" strokeWidth="2.8" />

          {/* Cobalt Blue Center Band */}
          <path
            d="M170 78 C212 78 242 114 242 160 C242 206 212 242 170 242 L192 240 C230 232 258 199 258 160 C258 121 230 88 192 80 Z"
            fill="url(#p5CobaltGrad)"
            stroke="#1E293B"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Top Sensor / Optic Lens */}
          <circle cx="164" cy="78" r="17" fill="#2563EB" stroke="#1E293B" strokeWidth="2.5" />
          <circle cx="161" cy="77" r="10" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2.2" />
          <circle cx="160" cy="77" r="5" fill="#F59E0B" stroke="#1E293B" strokeWidth="1.8" />
          <circle cx="158" cy="75" r="1.8" fill="#FFFFFF" />

          {/* Inner Portal Opening */}
          <ellipse cx="148" cy="164" rx="46" ry="54" fill="#F97316" stroke="#1E293B" strokeWidth="2.5" />
          <ellipse cx="144" cy="164" rx="38" ry="46" fill="url(#p5CoreGrad)" stroke="#1E293B" strokeWidth="2" />

          {/* Side Bento Grid Display Module */}
          <g transform="translate(216, 136) rotate(-8)">
            <rect x="0" y="0" width="46" height="46" rx="10" fill="#1E293B" stroke="#0F172A" strokeWidth="2.2" />
            <rect x="5" y="5" width="10" height="10" rx="2.5" fill="#3B82F6" />
            <rect x="18" y="5" width="10" height="10" rx="2.5" fill="#10B981" />
            <rect x="31" y="5" width="10" height="10" rx="2.5" fill="#F59E0B" />
            <rect x="5" y="18" width="10" height="10" rx="2.5" fill="#A78BFA" />
            <rect x="18" y="18" width="10" height="10" rx="2.5" fill="#F43F5E" />
            <rect x="31" y="18" width="10" height="10" rx="2.5" fill="#38BDF8" />
            <rect x="5" y="31" width="23" height="10" rx="2.5" fill="#FFFFFF" fillOpacity="0.9" />
            <rect x="31" y="31" width="10" height="10" rx="2.5" fill="#34D399" />
          </g>

          {/* Subtle Rivet Details */}
          <circle cx="148" cy="100" r="3" fill="#CBD5E1" stroke="#1E293B" strokeWidth="1.4" />
          <circle cx="106" cy="144" r="3" fill="#CBD5E1" stroke="#1E293B" strokeWidth="1.4" />
          <circle cx="182" cy="222" r="3" fill="#CBD5E1" stroke="#1E293B" strokeWidth="1.4" />
        </g>

        {/* Front Conveyor Track */}
        <g>
          <path
            d="M42 198 L166 164 C174 162 182 167 184 175 L186 184 C188 192 183 200 175 202 L52 238 C43 240 35 235 33 227 L31 218 C29 210 34 201 42 198 Z"
            fill="#FFFFFF"
            stroke="#1E293B"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          {/* Conveyor Top Surface */}
          <path
            d="M44 202 L162 170 L174 179 L56 213 Z"
            fill="#E2E8F0"
            stroke="#1E293B"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Rollers along Front Track */}
          <circle cx="58" cy="225" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
          <circle cx="58" cy="225" r="2.5" fill="#1E293B" />

          <circle cx="88" cy="216" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
          <circle cx="88" cy="216" r="2.5" fill="#1E293B" />

          <circle cx="118" cy="207" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
          <circle cx="118" cy="207" r="2.5" fill="#1E293B" />

          <circle cx="148" cy="198" r="8" fill="#EF4444" stroke="#1E293B" strokeWidth="2.2" />
          <circle cx="148" cy="198" r="2.5" fill="#1E293B" />
        </g>

        {/* Task / Sprint Geometric Blocks on Conveyor */}
        {/* Block 1: Violet Cylinder */}
        <g transform="translate(66, 152)">
          <ellipse cx="16" cy="36" rx="15" ry="6" fill="#5B21B6" stroke="#1E293B" strokeWidth="2.2" />
          <rect x="1" y="10" width="30" height="26" fill="url(#p5VioletGrad)" />
          <line x1="1" y1="10" x2="1" y2="36" stroke="#1E293B" strokeWidth="2.2" />
          <line x1="31" y1="10" x2="31" y2="36" stroke="#1E293B" strokeWidth="2.2" />
          <ellipse cx="16" cy="10" rx="15" ry="6" fill="#C4B5FD" stroke="#1E293B" strokeWidth="2.2" />
        </g>

        {/* Block 2: Emerald Cone / Milestone */}
        <g transform="translate(114, 134)">
          <ellipse cx="16" cy="38" rx="14" ry="5" fill="#047857" stroke="#1E293B" strokeWidth="2.2" />
          <path d="M2 38 L16 4 L30 38 Z" fill="url(#p5EmeraldGrad)" stroke="#1E293B" strokeWidth="2.2" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}
