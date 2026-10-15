import React, { useState, useRef } from 'react';
import { 
  Rotate3d, Sparkles, Factory, Truck, Maximize2, Minimize2, 
  Layers, Info, ShieldCheck, CheckCircle2 
} from 'lucide-react';

/**
 * 3D Interactive Plant & Fleet Showcase Component
 * Implements real-time 3D perspective parallax tilt, dynamic lighting sheen,
 * multi-layer depth badges, and full-screen / full-width website expansion.
 */
export default function PlantShowcase3D({ variant = 'hero', compact = false }) {
  const [activePhoto, setActivePhoto] = useState(0); // 0: Team & Plant, 1: Quarry & Lorry
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const cardRef = useRef(null);

  const photos = [
    {
      src: '/assets/team_plant_3d.jpg',
      title: 'VATHAN MINERALS - MINING',
      subtitle: 'Prop : MADDELA VENKATA SUBBAIAH · Rly Kodur, Andhra Pradesh',
      badge: 'Prop : MADDELA VENKATA SUBBAIAH',
      location: 'Rly Kodur, Andhra Pradesh',
      stats: '15+ Core Specialists · Mining Operations',
      highlights: ['Barytes Mining & Extraction', 'High Density Barytes Ore', 'Full Technical Workforce']
    },
    {
      src: '/assets/quarry_truck_3d.jpg',
      title: 'VATHAN MINERALS - MINING',
      subtitle: 'Prop : MADDELA VENKATA SUBBAIAH · Rly Kodur, Andhra Pradesh',
      badge: 'Mining & Logistics Fleet',
      location: 'Rly Kodur, Andhra Pradesh',
      stats: 'Tata Hitachi & Ashok Leyland Mining Fleet',
      highlights: ['Tata Hitachi Heavy Excavator', 'Ashok Leyland Multi-Axle Tippers', 'Weighbridge Dispatch']
    }
  ];

  const current = photos[activePhoto];

  // Mouse move handler for 3D parallax tilt
  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const maxDeg = isFullscreen ? 16 : (compact ? 12 : 14);
    const rotateX = ((centerY - y) / centerY) * maxDeg;
    const rotateY = ((x - centerX) / centerX) * maxDeg;

    setRotate({ x: rotateX, y: rotateY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setAutoRotate(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  const isFull = variant === 'full' || isFullscreen;

  const content = (
    <div className={`w-full ${isFull ? 'max-w-none' : (compact ? 'max-w-md' : 'max-w-4xl')} mx-auto select-none transition-all`}>
      {/* 3D Controls Bar */}
      <div className="flex flex-wrap items-center justify-between mb-3 px-1 gap-2">
        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-2xl border border-white/10 text-xs shadow-lg">
          <button
            type="button"
            onClick={() => setActivePhoto(0)}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-2 transition ${
              activePhoto === 0
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Factory size={15} />
            <span>Mining & Workforce (3D)</span>
          </button>
          <button
            type="button"
            onClick={() => setActivePhoto(1)}
            className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-2 transition ${
              activePhoto === 1
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck size={15} />
            <span>Quarry & Fleet (3D)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setAutoRotate(!autoRotate);
              setRotate({ x: 0, y: 0 });
            }}
            title="Toggle 3D Float Animation"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
              autoRotate
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <Rotate3d size={14} className={autoRotate ? 'animate-spin' : ''} />
            <span>{autoRotate ? '3D Active' : 'Enable 3D'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen 3D View'}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center gap-1.5 transition"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{isFullscreen ? 'Exit Full' : 'Full Screen 3D'}</span>
          </button>
        </div>
      </div>

      {/* 3D Stage / Perspective Viewport */}
      <div
        className="relative"
        style={{ perspective: isFull ? '1600px' : '1200px' }}
      >
        <div
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`relative rounded-3xl overflow-hidden cursor-pointer shadow-2xl border border-white/20 bg-slate-950 transition-shadow ${
            autoRotate && !isHovered ? 'animate-3d-float' : ''
          }`}
          style={{
            transform: isHovered
              ? `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg) scale3d(1.02, 1.02, 1.02)`
              : 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
            transformStyle: 'preserve-3d',
            transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s ease-out',
            boxShadow: isHovered
              ? `${-rotate.y * 3}px ${rotate.x * 3 + 28}px 55px rgba(0, 0, 0, 0.75)`
              : '0 25px 50px rgba(0, 0, 0, 0.55)'
          }}
        >
          {/* Main Photo with 3D Depth */}
          <div className={`relative ${isFull ? 'aspect-[16/9] lg:aspect-[21/9]' : (compact ? 'aspect-[16/10]' : 'aspect-[16/9]')} overflow-hidden bg-slate-900`}>
            <img
              src={current.src}
              alt={current.title}
              className="w-full h-full object-cover object-center transition-transform duration-700 ease-out"
              style={{
                transform: isHovered ? 'scale(1.08) translateZ(15px)' : 'scale(1)',
                transformStyle: 'preserve-3d'
              }}
            />

            {/* Subtle bottom shadow just to ensure text readability without dull black overlay */}
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

            {/* Dynamic 3D Specular Sheen (follows mouse tilt) */}
            {isHovered && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-200 mix-blend-overlay"
                style={{
                  background: `radial-gradient(circle at ${50 + rotate.y * 3}% ${50 - rotate.x * 3}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 65%)`
                }}
              />
            )}

            {/* Top Floating Badge */}
            <div
              className="absolute top-3 left-3 sm:top-4 sm:left-4 right-3 sm:right-4 flex items-center justify-between pointer-events-none"
              style={{ transform: 'translateZ(25px)' }}
            >
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-emerald-300 text-[10px] sm:text-[11px] font-bold shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Prop : MADDELA VENKATA SUBBAIAH</span>
              </div>

              <div className="bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[10px] text-slate-200 font-medium shadow-sm">
                {current.stats}
              </div>
            </div>

            {/* Clean Small-Sized Heading directly in the image with NO dull black background */}
            <div
              className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 right-3 sm:right-4 flex items-end justify-between pointer-events-none"
              style={{ transform: 'translateZ(30px)' }}
            >
              <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 shadow-md">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300 drop-shadow">
                  Prop : MADDELA VENKATA SUBBAIAH
                </p>
                <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-wide drop-shadow">
                  VATHAN MINERALS - MINING
                </h4>
                <p className="text-[10px] text-slate-200 drop-shadow">
                  Rly Kodur, Andhra Pradesh
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 text-[10px] text-emerald-300 font-semibold shadow-sm">
                <Sparkles size={11} />
                <span>Interactive 3D View</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center mt-2.5 text-xs text-slate-400 flex items-center justify-center gap-2">
        <Rotate3d size={14} className="text-emerald-400" />
        <span>Move cursor or touch card to rotate in 3D. Click Full Screen to view full size.</span>
      </div>
    </div>
  );

  // If Fullscreen Modal is active
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-50 flex flex-col p-4 sm:p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-extrabold text-lg">VATHAN MINERALS · Full Screen 3D Experience</span>
          </div>
          <button
            onClick={() => setIsFullscreen(false)}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold border border-white/20 transition flex items-center gap-2"
          >
            <Minimize2 size={16} /> Exit Full Screen
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center max-w-7xl mx-auto w-full">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
