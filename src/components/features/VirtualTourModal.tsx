import React, { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, Compass, ChevronLeft, ChevronRight, Eye, Info, Images, Move, Maximize2 } from 'lucide-react';
import { Property, RoomOption } from '../../types';

interface TourSpot {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  type: 'navigation' | 'info';
  targetSceneIndex?: number;
  infoTitle?: string;
  infoText?: string;
}

interface TourScene {
  id: string;
  name: string;
  tag: string;
  image: string;
  caption: string;
  hotspots: TourSpot[];
}

const roomDetail = (room: RoomOption, index: number): string => {
  const bath = room.hasAttachedBath ? 'attached washroom' : 'common washroom access';
  const ac = room.hasAC ? 'air-conditioned' : 'fan-cooled';
  const balcony = room.hasBalcony ? ' with a private balcony' : '';
  return `${room.type} sharing — ${ac} room with ${bath}${balcony}. ₹${room.rentPerMonth.toLocaleString('en-IN')}/month, ₹${(room.deposit ?? 0).toLocaleString('en-IN')} security deposit. ${(room.availableBeds ?? 0)} of ${room.totalBeds ?? room.availableBeds ?? 0} beds available.`;
};

/** Build real scenes from the owner's property: cover, gallery, each room tier. */
function buildScenes(property: Property | undefined): TourScene[] {
  if (!property) return [];
  const scenes: TourScene[] = [];
  const seen = new Set<string>();

  const push = (scene: TourScene) => {
    if (!scene.image || seen.has(scene.image)) return;
    seen.add(scene.image);
    scenes.push(scene);
  };

  push({
    id: 'scene-exterior',
    name: property.name,
    tag: 'Exterior · Entrance',
    image: property.coverImage,
    caption: property.tagline || `${property.locality}, ${property.city}`,
    hotspots: [],
  });

  (property.galleryImages || []).forEach((img, i) => {
    push({
      id: `scene-gallery-${i}`,
      name: `Gallery view ${i + 1}`,
      tag: property.name,
      image: img,
      caption: `${property.name} — ${property.locality}, ${property.city}`,
      hotspots: [],
    });
  });

  (property.rooms || []).forEach((room, i) => {
    push({
      id: `scene-room-${room.id}`,
      name: `${room.type} Sharing Room`,
      tag: `${room.availableBeds ?? 0}/${room.totalBeds ?? 0} beds available`,
      image: (property.galleryImages || [])[i + 1] || property.coverImage,
      caption: roomDetail(room, i),
      hotspots: [],
    });
  });

  // Chain scenes with navigation hotspots, and add a feature pin per room.
  scenes.forEach((scene, i) => {
    const next = scenes[i + 1];
    const prev = scenes[i - 1];
    if (next) {
      scene.hotspots.push({
        id: `${scene.id}-next`,
        label: `Go to ${next.name}`,
        xPercent: 84,
        yPercent: 55,
        type: 'navigation',
        targetSceneIndex: i + 1,
      });
    }
    if (prev) {
      scene.hotspots.push({
        id: `${scene.id}-prev`,
        label: `Back to ${prev.name}`,
        xPercent: 14,
        yPercent: 62,
        type: 'navigation',
        targetSceneIndex: i - 1,
      });
    }
    if (scene.id.startsWith('scene-room-')) {
      scene.hotspots.push({
        id: `${scene.id}-info`,
        label: 'Room details & tariff',
        xPercent: 50,
        yPercent: 38,
        type: 'info',
        infoTitle: scene.name,
        infoText: scene.caption,
      });
    }
  });

  return scenes;
}

const DEMO_SCENES: TourScene[] = [
  {
    id: 'demo-reception',
    name: 'Sample PG — Reception',
    tag: 'Demo walkthrough',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1600&q=80',
    caption: 'A sample tour so you can see how it works. Publish your property with photos and rooms to generate your own.',
    hotspots: [],
  },
  {
    id: 'demo-dining',
    name: 'Sample PG — Dining Hall',
    tag: 'Demo walkthrough',
    image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1600&q=80',
    caption: 'Guests step between scenes using the glowing hotspots or the strip below.',
    hotspots: [],
  },
  {
    id: 'demo-room',
    name: 'Sample PG — Twin Sharing Room',
    tag: 'Demo walkthrough',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
    caption: 'Room scenes carry tariff, deposit and live availability when built from your property.',
    hotspots: [],
  },
];
DEMO_SCENES.forEach((scene, i) => {
  const next = DEMO_SCENES[i + 1];
  const prev = DEMO_SCENES[i - 1];
  if (next) scene.hotspots.push({ id: `${scene.id}-next`, label: `Go to ${next.name}`, xPercent: 84, yPercent: 55, type: 'navigation', targetSceneIndex: i + 1 });
  if (prev) scene.hotspots.push({ id: `${scene.id}-prev`, label: `Back to ${prev.name}`, xPercent: 14, yPercent: 62, type: 'navigation', targetSceneIndex: i - 1 });
});

export interface VirtualTourModalProps {
  propertyName?: string;
  onClose?: () => void;
}

export const VirtualTourModal: React.FC<VirtualTourModalProps> = ({ propertyName, onClose }) => {
  const { showVirtualTourModal, setShowVirtualTourModal, properties } = useApp();

  const tourProperty = useMemo(
    () => properties.find((p) => p.name === propertyName) || properties[0],
    [properties, propertyName]
  );
  const scenes = useMemo(() => {
    const built = buildScenes(tourProperty);
    return built.length >= 1 ? built : DEMO_SCENES;
  }, [tourProperty]);
  const isDemo = scenes === DEMO_SCENES;

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeInfo, setActiveInfo] = useState<{ title: string; text: string } | null>(null);
  const [panOffset, setPanOffset] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null);

  if (!showVirtualTourModal) return null;

  const current = scenes[Math.min(activeIndex, scenes.length - 1)];
  const maxPan = 120;

  const goTo = (index: number) => {
    setActiveIndex(((index % scenes.length) + scenes.length) % scenes.length);
    setActiveInfo(null);
    setPanOffset(0);
  };

  const handleSpot = (spot: TourSpot) => {
    if (spot.type === 'navigation' && typeof spot.targetSceneIndex === 'number') {
      goTo(spot.targetSceneIndex);
    } else if (spot.type === 'info' && spot.infoTitle) {
      setActiveInfo({ title: spot.infoTitle, text: spot.infoText || '' });
    }
  };

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      void el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col h-[90vh] text-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  360° Virtual Tour — {tourProperty?.name || 'Sample walkthrough'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                  {scenes.length} scene{scenes.length === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Drag to pan · click hotspots to move between scenes
                {isDemo && ' · showing a sample tour (add property photos to customise)'}
              </p>
            </div>
          </div>
          <button
            onClick={() => (onClose ? onClose() : setShowVirtualTourModal(false))}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close virtual tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          className={`relative flex-1 bg-black overflow-hidden flex items-center justify-center ${isFullscreen ? 'bg-black' : ''}`}
        >
          <div
            className="relative w-full h-full cursor-grab active:cursor-grabbing select-none"
            style={{ transform: `scale(1.06) translateX(${panOffset}px)`, transition: dragRef.current ? 'none' : 'transform 200ms ease-out' }}
            onPointerDown={(e) => {
              dragRef.current = { startX: e.clientX, startOffset: panOffset };
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!dragRef.current) return;
              const next = dragRef.current.startOffset + (e.clientX - dragRef.current.startX);
              setPanOffset(Math.max(-maxPan, Math.min(maxPan, next)));
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}
          >
            <img
              key={current.id}
              src={current.image}
              alt={current.name}
              draggable={false}
              className="w-full h-full object-cover brightness-95"
            />

            {current.hotspots.map((spot) => (
              <button
                key={spot.id}
                onClick={() => handleSpot(spot)}
                style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 focus:outline-hidden"
                aria-label={spot.label}
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping"></span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-lg transition-transform group-hover:scale-125 ${
                      spot.type === 'navigation' ? 'bg-blue-600 border-white text-white' : 'bg-emerald-500 border-white text-white'
                    }`}
                  >
                    {spot.type === 'navigation' ? <Eye className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                  </div>
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md text-white font-bold text-xs whitespace-nowrap shadow-xl border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {spot.label}
                </span>
              </button>
            ))}
          </div>

          {/* Scene info overlay */}
          <div className="absolute top-4 left-4 z-30 max-w-sm bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-700/60 shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-1">{current.tag}</span>
            <h3 className="text-base font-bold text-white leading-tight mb-1">{current.name}</h3>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{current.caption}</p>
          </div>

          {/* Pan + fullscreen controls */}
          <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Move className="w-3.5 h-3.5 text-slate-400" />
            <button
              onClick={() => setPanOffset((p) => Math.min(p + 40, maxPan))}
              className="p-1 rounded hover:bg-slate-800 text-slate-200"
              title="Pan left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-blue-400">{Math.round(panOffset / 4)}°</span>
            <button
              onClick={() => setPanOffset((p) => Math.max(p - 40, -maxPan))}
              className="p-1 rounded hover:bg-slate-800 text-slate-200"
              title="Pan right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-slate-700 mx-1" />
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded hover:bg-slate-800 text-slate-200"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Arrows */}
          {scenes.length > 1 && (
            <>
              <button
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white"
                title="Previous scene"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white"
                title="Next scene"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Info popup */}
          {activeInfo && (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Info className="w-4 h-4" />
                    Scene details
                  </div>
                  <button onClick={() => setActiveInfo(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{activeInfo.title}</h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{activeInfo.text}</p>
                <button
                  onClick={() => setActiveInfo(null)}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Continue walkthrough
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scene strip */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1.5">
            <Images className="w-3.5 h-3.5" />
            Scenes
          </span>
          <div className="flex items-center gap-2.5">
            {scenes.map((scene, i) => (
              <button
                key={scene.id}
                onClick={() => goTo(i)}
                className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-all ${
                  i === activeIndex
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <img src={scene.image} alt={scene.name} className="w-8 h-8 rounded-lg object-cover" />
                <span>{scene.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
