import React from 'react';

/**
 * Official VATHAN MINERALS Circular Emblem Logo Component
 * Replicated with high precision from the official company embroidery seal.
 * Features:
 * - Outer emerald green ring with "VATHAN MINERALS" & "RLY . KODUR"
 * - Inner purple ring with bold magenta "VM"
 * - Faceted barytes mineral ore cluster
 */
export default function VMLogo({ size = 48, className = '', showText = false, textVariant = 'dark' }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 300 300"
        width={size}
        height={size}
        className="flex-shrink-0 drop-shadow-sm select-none"
      >
        <defs>
          <linearGradient id="vmlGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#15803d"/>
            <stop offset="100%" stopColor="#166534"/>
          </linearGradient>

          <linearGradient id="vmlMagentaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e11d48"/>
            <stop offset="45%" stopColor="#be185d"/>
            <stop offset="100%" stopColor="#9d174d"/>
          </linearGradient>

          <linearGradient id="vmlRock1" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stopColor="#64748b"/>
            <stop offset="100%" stopColor="#334155"/>
          </linearGradient>
          <linearGradient id="vmlRock2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569"/>
            <stop offset="100%" stopColor="#1e293b"/>
          </linearGradient>
          <linearGradient id="vmlRockHi" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cbd5e1"/>
            <stop offset="100%" stopColor="#94a3b8"/>
          </linearGradient>

          {/* Arcs for curved text positioning */}
          <path id="vmlTopArc" d="M 38,150 A 112,112 0 1,1 262,150" fill="none" />
          <path id="vmlBottomArc" d="M 46,150 A 108,108 0 0,0 254,150" fill="none" />
        </defs>

        {/* Outer Ring Base */}
        <circle cx="150" cy="150" r="144" fill="#ffffff" stroke="#166534" strokeWidth="7" />
        <circle cx="150" cy="150" r="140" fill="#f8faf6" stroke="#22c55e" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Upper Text: VATHAN MINERALS */}
        <text
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontSize="18.5"
          fill="#166534"
          letterSpacing="2.6"
        >
          <textPath href="#vmlTopArc" startOffset="50%" textAnchor="middle">
            VATHAN MINERALS
          </textPath>
        </text>

        {/* Left Star/Floret */}
        <g transform="translate(42, 150) scale(1.15)">
          <circle cx="0" cy="0" r="2.2" fill="#166534"/>
          <path d="M 0,-6 Q 1,-2 5,-3 Q 2,0 5,3 Q 1,2 0,6 Q -1,2 -5,3 Q -2,0 -5,-3 Q -1,-2 0,-6 Z" fill="#166534"/>
        </g>

        {/* Right Star/Floret */}
        <g transform="translate(258, 150) scale(1.15)">
          <circle cx="0" cy="0" r="2.2" fill="#166534"/>
          <path d="M 0,-6 Q 1,-2 5,-3 Q 2,0 5,3 Q 1,2 0,6 Q -1,2 -5,3 Q -2,0 -5,-3 Q -1,-2 0,-6 Z" fill="#166534"/>
        </g>

        {/* Lower Text: RLY . KODUR */}
        <text
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontSize="18"
          fill="#166534"
          letterSpacing="3.8"
        >
          <textPath href="#vmlBottomArc" startOffset="50%" textAnchor="middle">
            RLY · KODUR
          </textPath>
        </text>

        {/* Inner Concentric Circle */}
        <circle cx="150" cy="150" r="90" fill="#ffffff" stroke="#581c87" strokeWidth="4.5" />
        <circle cx="150" cy="150" r="87" fill="none" stroke="#a855f7" strokeWidth="1" strokeOpacity="0.3" />

        {/* Center Initials: VM */}
        <text
          x="150"
          y="108"
          fontFamily="Impact, 'Arial Black', -apple-system, sans-serif"
          fontWeight="900"
          fontSize="34"
          fill="url(#vmlMagentaGrad)"
          textAnchor="middle"
          letterSpacing="1"
        >
          VM
        </text>

        {/* Barytes Mineral Ore Stones Cluster */}
        <g id="vmlRocks">
          {/* Shadow Base */}
          <ellipse cx="150" cy="186" rx="55" ry="12" fill="#0f172a" opacity="0.18" />

          {/* Bottom Left Rock */}
          <path d="M 104,168 L 122,156 L 134,166 L 126,182 L 105,180 Z"
                fill="url(#vmlRock1)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 104,168 L 122,156 L 120,172 L 105,180 Z"
                fill="url(#vmlRockHi)" opacity="0.75" />

          {/* Bottom Right Rock */}
          <path d="M 166,166 L 178,154 L 198,166 L 194,182 L 170,183 Z"
                fill="url(#vmlRock2)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 178,154 L 198,166 L 186,176 Z"
                fill="url(#vmlRockHi)" opacity="0.6" />

          {/* Center Base Rock */}
          <path d="M 124,172 L 142,160 L 158,160 L 174,172 L 166,188 L 132,188 Z"
                fill="url(#vmlRock2)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 142,160 L 158,160 L 152,175 L 134,175 Z"
                fill="url(#vmlRockHi)" opacity="0.7" />

          {/* Mid Left Rock */}
          <path d="M 120,146 L 136,134 L 148,146 L 140,162 L 122,158 Z"
                fill="url(#vmlRock1)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 120,146 L 136,134 L 135,150 L 122,158 Z"
                fill="url(#vmlRockHi)" opacity="0.8" />

          {/* Mid Right Rock */}
          <path d="M 152,146 L 166,134 L 180,146 L 176,160 L 150,162 Z"
                fill="url(#vmlRock2)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 152,146 L 166,134 L 168,152 Z"
                fill="url(#vmlRockHi)" opacity="0.65" />

          {/* Top Apex Rock */}
          <path d="M 138,128 L 150,116 L 162,128 L 158,144 L 142,144 Z"
                fill="url(#vmlRock1)" stroke="#1e293b" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M 138,128 L 150,116 L 151,135 L 142,144 Z"
                fill="#e2e8f0" opacity="0.85" />
          <path d="M 150,116 L 162,128 L 151,135 Z"
                fill="url(#vmlRockHi)" opacity="0.6" />

          {/* Crystalline facets sparkles */}
          <circle cx="150" cy="118" r="1.5" fill="#ffffff" />
          <circle cx="136" cy="136" r="1.2" fill="#ffffff" />
          <circle cx="165" cy="136" r="1.2" fill="#ffffff" />
        </g>
      </svg>

      {showText && (
        <div className="leading-tight">
          <div className={`font-black tracking-wide text-base ${textVariant === 'light' ? 'text-white' : 'text-slate-900'}`}>
            VATHAN MINERALS
          </div>
          <div className={`text-[11px] font-semibold tracking-wider uppercase ${textVariant === 'light' ? 'text-emerald-400' : 'text-emerald-700'}`}>
            Rly. Kodur · Barytes Hub
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Executive Leadership Banner / Proprietor Component
 * Displays the proprietor:
 * - MADDELA VENKATA SUBBAIAH (Managing Director - MD)
 */
export function LeadershipBadge({ compact = false, dark = false }) {
  if (compact) {
    return (
      <div className={`p-2.5 rounded-xl border text-xs ${
        dark ? 'bg-slate-900/90 border-emerald-900/40 text-slate-300' : 'bg-emerald-50/70 border-emerald-200 text-slate-700'
      }`}>
        <p className={`font-bold text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5 ${
          dark ? 'text-emerald-400' : 'text-emerald-800'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          Proprietor & Leadership
        </p>
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-bold text-slate-100 text-[11px] truncate">M. Venkata Subbaiah</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold">MD</span>
          </div>
          <p className="text-[10px] text-slate-400">Managing Director · VATHAN MINERALS</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 transition-all shadow-sm ${
      dark ? 'bg-gradient-to-br from-slate-900 to-slate-950 border-emerald-800/40 text-white' : 'bg-gradient-to-br from-white to-emerald-50/40 border-emerald-200 text-slate-800'
    }`}>
      <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Proprietorship & Governance
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Rly. Kodur, Andhra Pradesh
        </span>
      </div>

      <div>
        <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-emerald-500/20 shadow-sm">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black text-sm border border-emerald-400/30">
            MD
          </div>
          <div className="min-w-0">
            <p className="font-black text-sm text-slate-900 dark:text-white tracking-wide">
              MADDELA VENKATA SUBBAIAH
            </p>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Managing Director (MD) & Proprietor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
