interface GasStationCardProps {
  name: string;
  logo: string;
  address: string;
  distance: number;
  dieselPrice: number;
  gasolinePrice: number;
  lastUpdated: string;
  viewMode: 'list' | 'grid';
  orientation: 'horizontal' | 'vertical';
  highlightGasoline?: boolean;
  highlightDiesel?: boolean;
}

export function GasStationCard({
  name,
  logo,
  address,
  distance,
  dieselPrice,
  gasolinePrice,
  lastUpdated,
  viewMode,
  orientation,
  highlightGasoline = false,
  highlightDiesel = false,
}: GasStationCardProps) {
  const isVertical = orientation === 'vertical';
  
  return (
    <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-lg hover:bg-white/10 transition-all overflow-hidden">
      <div className={`flex ${isVertical ? 'flex-col' : 'items-center justify-between'} ${isVertical ? 'gap-4' : 'gap-2'}`}>
        {/* Station Info */}
        <div className={`flex ${isVertical ? 'flex-col items-center text-center' : 'items-center'} gap-3 ${isVertical ? 'w-full' : 'flex-1 min-w-0'}`}>
          <div className="text-3xl flex-shrink-0">{logo}</div>
          <div className={`${isVertical ? 'w-full' : 'flex-1 min-w-0'}`}>
            <h3 className="text-white font-medium text-lg truncate">{name}</h3>
            <p className="text-gray-400 text-sm truncate">{address}</p>
            <div className={`flex items-center gap-2 text-gray-500 text-xs mt-1 ${isVertical ? 'justify-center' : ''}`}>
              <span>{distance} km</span>
              <span>•</span>
              <span>Oppdatert {lastUpdated}</span>
            </div>
          </div>
        </div>

        {/* Prices */}
        <div className={`flex ${isVertical ? 'w-full justify-center' : 'flex-shrink-0'} gap-2`}>
          {/* Diesel Price */}
          <div className={`rounded-lg px-3 py-2 ${isVertical ? 'min-w-[120px]' : 'w-[110px]'} text-center border ${
            highlightDiesel 
              ? 'bg-green-500/10 border-green-500' 
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="text-gray-400 text-xs mb-1">DIESEL</div>
            <div className={`text-lg font-medium whitespace-nowrap ${
              highlightDiesel ? 'text-green-400' : 'text-white'
            }`}>
              {dieselPrice.toFixed(2)} NOK
            </div>
          </div>

          {/* Gasoline Price */}
          <div className={`rounded-lg px-3 py-2 ${isVertical ? 'min-w-[120px]' : 'w-[110px]'} text-center border ${
            highlightGasoline 
              ? 'bg-green-500/10 border-green-500' 
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="text-gray-400 text-xs mb-1">BENSIN</div>
            <div className={`text-lg font-medium whitespace-nowrap ${
              highlightGasoline ? 'text-green-400' : 'text-white'
            }`}>
              {gasolinePrice.toFixed(2)} NOK
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}