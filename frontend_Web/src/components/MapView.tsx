import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Define types for Nominatim and OSRM API responses
interface NominatimReverseResponse {
  display_name: string;
}

interface NominatimSearchResponse {
  lat: string;
  lon: string;
}

interface OSRMRouteResponse {
  routes: {
    geometry: {
      coordinates: [number, number][];
    };
  }[];
}

interface Route {
  coords: [number, number][];
  endCoords: [number, number];
}

// Custom icons for markers
const blueIcon = L.divIcon({
  className: 'custom-icon',
  html: '<div style="background-color: blue; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const redIcon = L.divIcon({
  className: 'custom-icon',
  html: '<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const MapView: React.FC = () => {
  const [userCoords, setUserCoords] = useState<[number, number]>([20.5937, 78.9629]); // Default to India
  const [userAddress, setUserAddress] = useState<string>('');
  const [destination, setDestination] = useState<string>('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState<boolean>(false);

  // Get user's location on component mount
  useEffect(() => {
    console.log('Attempting to get user location...');
    navigator.geolocation.getCurrentPosition(
      async (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const coords: [number, number] = [latitude, longitude];
        console.log('User coords set:', coords);
        setUserCoords(coords);

        try {
          const res = await axios.get<NominatimReverseResponse>(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          console.log('User address fetched:', res.data.display_name);
          setUserAddress(res.data.display_name);
        } catch (error) {
          console.error('Failed to reverse geocode:', error);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        // Keep default coordinates if geolocation fails
        console.log('Using default coords:', userCoords);
      }
    );
  }, []);

  // Component to center the map and ensure it renders
  const MapController: React.FC = () => {
    const map = useMap();
    useEffect(() => {
      console.log('MapController: Centering map on userCoords:', userCoords);
      map.setView(userCoords, 13);
      map.invalidateSize(); // Ensure the map re-renders correctly

      if (selectedRoute !== null && routes[selectedRoute]) {
        console.log('MapController: Fitting bounds for selected route:', selectedRoute);
        const bounds = L.latLngBounds(routes[selectedRoute].coords);
        map.fitBounds(bounds);
      } else if (routes.length > 0) {
        console.log('MapController: Fitting bounds for first route');
        const bounds = L.latLngBounds(routes[0].coords);
        map.fitBounds(bounds);
      }
    }, [map, userCoords, routes, selectedRoute]);
    return null;
  };

  const getCoordinates = async (address: string): Promise<[number, number]> => {
    try {
      const res = await axios.get<NominatimSearchResponse[]>(
        `https://nominatim.openstreetmap.org/search?format=json&q=${address}`
      );
      if (!res.data[0]) throw new Error('Invalid address');
      console.log('Coordinates fetched for address:', address, res.data[0]);
      return [parseFloat(res.data[0].lat), parseFloat(res.data[0].lon)];
    } catch (error) {
      console.error('Failed to get coordinates:', error);
      throw error;
    }
  };

  const getRoutes = async () => {
    try {
      const start = userAddress ? await getCoordinates(userAddress) : userCoords;
      const end = await getCoordinates(destination);

      if (!start) {
        throw new Error('Starting location is not available');
      }

      const routePromises = [0, 1, 2].map(async (i: number) => {
        const res = await axios.get<OSRMRouteResponse>(
          `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&alternatives=${i}`
        );
        const coords: [number, number][] = res.data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]);
        return { coords, endCoords: end };
      });

      const fetchedRoutes: Route[] = await Promise.all(routePromises);
      console.log('Routes fetched:', fetchedRoutes);
      setRoutes(fetchedRoutes);
      setSelectedRoute(null);
    } catch (err) {
      console.error('Failed to fetch routes:', err);
    }
  };

  const handleRouteClick = (index: number) => {
    console.log('Route clicked:', index);
    setSelectedRoute(index);
  };

  const handleChooseRoute = () => {
    if (selectedRoute === null) return;

    // Simulate backend calculation for time and cost
    const distance: number = routes[selectedRoute].coords.length * 0.1; // Dummy distance in km
    const time: number = distance * 2; // 2 minutes per km
    const cost: number = distance * 10; // 10 units per km

    console.log('Calculated time:', time, 'minutes, Cost:', cost, 'units');
    setEstimatedTime(time);
    setEstimatedCost(cost);
  };

  return (
    <div className={`flex ${fullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-screen'}`}>
      {/* Left Panel - Input Form */}
      <div className="w-full md:w-1/3 p-4 bg-gray-100 shadow-md overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-center">Route Customization Booking App</h2>
        <div className="mb-3">
          <label className="block font-medium">Your Location/Pickup Location</label>
          <input
            type="text"
            value={userAddress}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserAddress(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="Your current location"
          />
        </div>
        <div className="mb-3">
          <label className="block font-medium">Drop Location/Destination</label>
          <input
            type="text"
            value={destination}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDestination(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded"
            placeholder="e.g. India Gate, Delhi"
          />
        </div>
        <button
          onClick={getRoutes}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-full mb-3"
        >
          Search Routes
        </button>

        {routes.length > 0 && selectedRoute === null && (
          <div className="mb-3">
            <p className="font-medium">Select a route by clicking on it:</p>
            <ul>
              <li>Blue: Route 1</li>
              <li>Green: Route 2</li>
              <li>Purple: Route 3</li>
            </ul>
            <button
              onClick={handleChooseRoute}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 w-full mt-2"
              disabled={selectedRoute === null}
            >
              Choose
            </button>
          </div>
        )}

        {estimatedTime && estimatedCost && (
          <div className="mt-4 p-4 bg-blue-100 rounded">
            <p><strong>Estimated Time:</strong> {estimatedTime.toFixed(1)} minutes</p>
            <p><strong>Estimated Cost:</strong> {estimatedCost.toFixed(2)} units</p>
          </div>
        )}
      </div>

      {/* Right Panel - Map */}
      <div className="w-full md:w-2/3 relative" style={{ height: '100%' }}>
        <MapContainer
          center={userCoords}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          className="z-10"
        >
          <TileLayer
            attribution='© OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController />
          {userCoords && <Marker position={userCoords} icon={blueIcon} />}
          {routes.length > 0 && <Marker position={routes[0].endCoords} icon={redIcon} />}
          {selectedRoute !== null && routes[selectedRoute] && (
            <Polyline positions={routes[selectedRoute].coords} color="blue" />
          )}
          {selectedRoute === null &&
            routes.map((route, index) => {
              const color = index === 0 ? 'blue' : index === 1 ? 'green' : 'purple';
              return (
                <Polyline
                  key={index}
                  positions={route.coords}
                  color={color}
                  weight={5}
                  eventHandlers={{
                    click: () => handleRouteClick(index),
                  }}
                />
              );
            })}
        </MapContainer>
        <button
          className="absolute top-4 right-4 z-20 bg-black text-white px-3 py-1 rounded"
          onClick={() => setFullscreen(!fullscreen)}
        >
          {fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      </div>
    </div>
  );
};

export default MapView;