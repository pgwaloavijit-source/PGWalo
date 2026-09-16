import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Compass,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Bed,
  Wifi,
  Wind,
  Bath,
  Coffee,
  Info,
  Sparkles,
} from 'lucide-react';

interface TourSpot {
  id: string;
  label: string;
  xPercent: number;
  yPercent: number;
  type: 'navigation' | 'info';
  targetRoomId?: string;
  infoTitle?: string;
  infoText?: string;
}

interface TourRoom {
  id: string;
  name: string;
  tag: string;
  image: string;
  description: string;
  floor: string;
  dimensions: string;
  amenities: string[];
  hotspots: TourSpot[];
}

const TOUR_ROOMS: TourRoom[] = [
  {
    id: 'room-reception',
    name: 'Main Reception & Biometric Foyer',
    tag: 'Ground Floor Foyer',
    image: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=1600&q=80',
    description: '24x7 attended reception desk with facial recognition biometric turnstiles, visitor lounge, and package delivery locker station.',
    floor: 'Ground Floor',
    dimensions: '35 ft x 22 ft',
    amenities: ['Biometric Access', '24x7 Security Guard', 'Parcel Locker', 'High-Speed Wi-Fi'],
    hotspots: [
      {
        id: 'hs-1',
        label: 'Step to Dining & Kitchen',
        xPercent: 78,
        yPercent: 52,
        type: 'navigation',
        targetRoomId: 'room-dining',
      },
      {
        id: 'hs-2',
        label: 'Biometric Access Terminal',
        xPercent: 24,
        yPercent: 62,
        type: 'info',
        infoTitle: 'AI Face & Fingerprint Scanner',
        infoText: 'Residents have 24/7 keyless access with automated in/out gate logging for safety.',
      },
    ],
  },
  {
    id: 'room-dining',
    name: 'Community Dining & Live Kitchen',
    tag: 'Nutritious Buffet Hall',
    image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1600&q=80',
    description: 'Hygienic 60-seat cafeteria serving 3 daily chef-crafted meals with live roti counter and mineral RO dispensers.',
    floor: 'Ground Floor West',
    dimensions: '48 ft x 26 ft',
    amenities: ['3-Meal Buffet', 'Mineral RO Water', 'Live Chapati Counter', 'Microwave & Induction'],
    hotspots: [
      {
        id: 'hs-3',
        label: 'Walk to Deluxe Twin Room',
        xPercent: 82,
        yPercent: 48,
        type: 'navigation',
        targetRoomId: 'room-twin',
      },
      {
        id: 'hs-4',
        label: 'Water Quality Monitor',
        xPercent: 32,
        yPercent: 58,
        type: 'info',
        infoTitle: '7-Stage Mineral RO Station',
        infoText: 'Daily tested TDS < 80 ppm. Hot, ambient, and chilled water available 24/7.',
      },
    ],
  },
  {
    id: 'room-twin',
    name: 'Deluxe Twin Sharing Suite',
    tag: 'Room 201 - Tower A',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1600&q=80',
    description: 'Spacious air-conditioned room featuring dual orthopedic mattresses, ergonomic study desks with soft-close wardrobes, and high-speed Wi-Fi.',
    floor: 'Second Floor',
    dimensions: '18 ft x 14 ft',
    amenities: ['Daikin Split AC', 'Orthopedic Mattress', 'Attached Washroom', 'Private Wardrobes'],
    hotspots: [
      {
        id: 'hs-5',
        label: 'Inspect Attached Washroom',
        xPercent: 18,
        yPercent: 65,
        type: 'navigation',
        targetRoomId: 'room-bath',
      },
      {
        id: 'hs-6',
        label: 'Ergonomic Work Desk',
        xPercent: 62,
        yPercent: 55,
        type: 'info',
        infoTitle: 'Dedicated Work-From-Home Station',
        infoText: 'Equipped with dual power surge sockets, USB-C fast charging, and task lighting.',
      },
      {
        id: 'hs-7',
        label: 'Step to Balcony Lounge',
        xPercent: 88,
        yPercent: 42,
        type: 'navigation',
        targetRoomId: 'room-balcony',
      },
    ],
  },
  {
    id: 'room-bath',
    name: 'Attached Western Washroom',
    tag: 'Private Ensuite Washroom',
    image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1600&q=80',
    description: 'Spotless tiled bathroom with Jaquar chrome fittings, 25L instant geyser, exhaust ventilation, and anti-skid ceramic flooring.',
    floor: 'Ensuite Room 201',
    dimensions: '8 ft x 6 ft',
    amenities: ['Jaquar Fittings', '25L Instant Geyser', 'Anti-Skid Flooring', 'Daily Disinfection'],
    hotspots: [
      {
        id: 'hs-8',
        label: 'Return to Room 201',
        xPercent: 20,
        yPercent: 70,
        type: 'navigation',
        targetRoomId: 'room-twin',
      },
      {
        id: 'hs-9',
        label: 'Instant Water Geyser',
        xPercent: 72,
        yPercent: 30,
        type: 'info',
        infoTitle: '5-Star Energy Rated Geyser',
        infoText: 'Heats to 60°C in 3 minutes with automated thermal cut-off for electrical safety.',
      },
    ],
  },
  {
    id: 'room-balcony',
    name: 'Open-Air Sky Lounge & Balcony',
    tag: 'Rooftop Terrace',
    image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1600&q=80',
    description: 'Relaxing rooftop open terrace with synthetic turf, hanging chairs, sunset coffee counters, and fresh breeze.',
    floor: 'Fourth Floor Terrace',
    dimensions: '40 ft x 20 ft',
    amenities: ['Sunset Skyline View', 'Coffee Bar', 'Acoustic Quiet Zone', 'Garden Planters'],
    hotspots: [
      {
        id: 'hs-10',
        label: 'Back to Reception',
        xPercent: 12,
        yPercent: 70,
        type: 'navigation',
        targetRoomId: 'room-reception',
      },
    ],
  },
];

export const VirtualTourModal: React.FC = () => {
  const { showVirtualTourModal, setShowVirtualTourModal } = useApp();

  const [activeRoomId, setActiveRoomId] = useState<string>('room-twin');
  const [activeInfoModal, setActiveInfoModal] = useState<{ title: string; text: string } | null>(null);
  const [panOffset, setPanOffset] = useState<number>(0);

  if (!showVirtualTourModal) return null;

  const currentRoom = TOUR_ROOMS.find((r) => r.id === activeRoomId) || TOUR_ROOMS[0];

  const handleHotspotClick = (spot: TourSpot) => {
    if (spot.type === 'navigation' && spot.targetRoomId) {
      setActiveRoomId(spot.targetRoomId);
      setActiveInfoModal(null);
    } else if (spot.type === 'info' && spot.infoTitle) {
      setActiveInfoModal({
        title: spot.infoTitle,
        text: spot.infoText || '',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-hidden animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col h-[90vh] text-white">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  360° Interactive Virtual Walkthrough
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                  Live HD Tour
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Click interactive hotspots on the image to step between rooms or view architectural features.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowVirtualTourModal(false)}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Stage Viewport */}
        <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
          {/* Panoramic Image Stage with simulated Pan Offset */}
          <div
            className="relative w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300 select-none"
            style={{ transform: `scale(1.04) translateX(${panOffset}px)` }}
          >
            <img
              src={currentRoom.image}
              alt={currentRoom.name}
              className="w-full h-full object-cover brightness-95"
            />

            {/* Interactive Hotspots Overlay */}
            {currentRoom.hotspots.map((spot) => (
              <button
                key={spot.id}
                onClick={() => handleHotspotClick(spot)}
                style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group z-20 focus:outline-hidden"
              >
                <div className="relative flex items-center justify-center">
                  <span className="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping"></span>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-lg transition-transform group-hover:scale-125 ${
                      spot.type === 'navigation'
                        ? 'bg-blue-600 border-white text-white'
                        : 'bg-emerald-500 border-white text-white'
                    }`}
                  >
                    {spot.type === 'navigation' ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <Info className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* Hotspot Floating Tooltip */}
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2.5 px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md text-white font-bold text-xs whitespace-nowrap shadow-xl border border-white/15 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {spot.label}
                </span>
              </button>
            ))}
          </div>

          {/* Current Room Info Overlay Badge */}
          <div className="absolute top-4 left-4 z-30 max-w-sm bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-slate-700/60 shadow-xl">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-1">
              {currentRoom.tag} • {currentRoom.floor}
            </span>
            <h3 className="text-base font-bold text-white leading-tight mb-1">{currentRoom.name}</h3>
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{currentRoom.description}</p>

            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {currentRoom.amenities.map((am, i) => (
                <span
                  key={i}
                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700"
                >
                  {am}
                </span>
              ))}
            </div>
          </div>

          {/* Horizontal Pan Controls */}
          <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <span className="text-slate-400 font-medium">Pan Angle:</span>
            <button
              onClick={() => setPanOffset((prev) => Math.min(prev + 40, 120))}
              className="p-1 rounded hover:bg-slate-800 text-slate-200"
              title="Pan Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-blue-400">{Math.round(panOffset / 4)}°</span>
            <button
              onClick={() => setPanOffset((prev) => Math.max(prev - 40, -120))}
              className="p-1 rounded hover:bg-slate-800 text-slate-200"
              title="Pan Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Feature Inspection Modal Popup */}
          {activeInfoModal && (
            <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    Feature Detail
                  </div>
                  <button
                    onClick={() => setActiveInfoModal(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{activeInfoModal.title}</h4>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{activeInfoModal.text}</p>
                <button
                  onClick={() => setActiveInfoModal(null)}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Continue Walkthrough
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Room Selector Strip */}
        <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            Rooms & Zones:
          </span>
          <div className="flex items-center gap-2.5">
            {TOUR_ROOMS.map((room) => {
              const isSelected = room.id === activeRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveRoomId(room.id);
                    setActiveInfoModal(null);
                    setPanOffset(0);
                  }}
                  className={`flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <img
                    src={room.image}
                    alt={room.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <span>{room.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
