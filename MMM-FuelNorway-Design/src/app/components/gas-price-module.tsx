import { useState } from 'react';
import { GasStationCard } from './gas-station-card';
import { LayoutGrid, LayoutList, MoveHorizontal, MoveVertical } from 'lucide-react';

interface GasStation {
  id: string;
  name: string;
  logo: string;
  address: string;
  distance: number;
  dieselPrice: number;
  gasolinePrice: number;
  lastUpdated: string;
  highlightGasoline?: boolean;
  highlightDiesel?: boolean;
}

const mockGasStations: GasStation[] = [
  {
    id: '1',
    name: 'Oddemarka',
    logo: '⛽',
    address: 'Østre ringvei 88',
    distance: 1.4,
    dieselPrice: 25.05,
    gasolinePrice: 20.14,
    lastUpdated: '6h',
  },
  {
    id: '2',
    name: 'Walhalla',
    logo: '⛽',
    address: 'Marviksveien 12A',
    distance: 1.6,
    dieselPrice: 24.85,
    gasolinePrice: 20.14,
    lastUpdated: '6h',
  },
  {
    id: '3',
    name: 'Krossen',
    logo: '⛽',
    address: 'Setesdalsveien 98',
    distance: 1.7,
    dieselPrice: 24.95,
    gasolinePrice: 20.04,
    lastUpdated: '8h',
    highlightGasoline: true,
  },
  {
    id: '4',
    name: 'Circle K',
    logo: '⭕',
    address: 'Storgata 45',
    distance: 2.1,
    dieselPrice: 25.15,
    gasolinePrice: 20.25,
    lastUpdated: '4h',
  },
  {
    id: '5',
    name: 'Shell',
    logo: '🐚',
    address: 'Havnegata 12',
    distance: 2.3,
    dieselPrice: 25.35,
    gasolinePrice: 20.35,
    lastUpdated: '5h',
  },
  {
    id: '6',
    name: 'YX',
    logo: '⚡',
    address: 'Industriveien 7',
    distance: 2.8,
    dieselPrice: 24.75,
    gasolinePrice: 20.05,
    lastUpdated: '7h',
    highlightDiesel: true,
  },
];

export function GasPriceModule() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-white text-3xl font-light">Bensinpriser</h1>
          
          <div className="flex gap-3">
            {/* View Toggle */}
            <div className="flex gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutList className="w-4 h-4" />
                Liste
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                Rutenett
              </button>
            </div>

            {/* Orientation Toggle */}
            <div className="flex gap-2 bg-white/5 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setOrientation('horizontal')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  orientation === 'horizontal'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MoveHorizontal className="w-4 h-4" />
                Horisontal
              </button>
              <button
                onClick={() => setOrientation('vertical')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
                  orientation === 'vertical'
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MoveVertical className="w-4 h-4" />
                Vertikal
              </button>
            </div>
          </div>
        </div>

        {/* Gas Stations */}
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4'
            : `flex flex-col gap-4 ${orientation === 'vertical' ? 'max-w-sm mx-auto' : 'max-w-xl'}`
        }>
          {mockGasStations.map((station) => (
            <GasStationCard
              key={station.id}
              name={station.name}
              logo={station.logo}
              address={station.address}
              distance={station.distance}
              dieselPrice={station.dieselPrice}
              gasolinePrice={station.gasolinePrice}
              lastUpdated={station.lastUpdated}
              viewMode={viewMode}
              orientation={orientation}
              highlightGasoline={station.highlightGasoline}
              highlightDiesel={station.highlightDiesel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}