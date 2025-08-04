"use client"

import React, { useEffect, useState } from 'react';
import { getEmergencyResponseService } from '@/lib/emergency-response-service';
import { supabase } from '@/lib/supabase';

const EmergencyDashboard = () => {
  const [activeCrises, setActiveCrises] = useState<any[]>([]);
  const [vehicleLocations, setVehicleLocations] = useState<Record<string, any>>({});

  useEffect(() => {
    const emergencyService = getEmergencyResponseService(supabase);

    // Fetch initial crisis data
    const fetchCrises = async () => {
      const { data, error } = await supabase
        .from('crisis_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setActiveCrises(data);
    };

    fetchCrises();

    // Listen for real-time updates
    const crisisSubscription = supabase
      .channel('crisis-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crisis_events' }, (payload) => {
        console.log('New crisis event:', payload.new);
        setActiveCrises(prevCrises => [payload.new, ...prevCrises]);
      })
      .subscribe();

    // Simulate vehicle tracking updates
    const interval = setInterval(() => {
      const newLocation = {
        latitude: 34.0522 + (Math.random() - 0.5) * 0.1,
        longitude: -118.2437 + (Math.random() - 0.5) * 0.1,
      };
      emergencyService.trackEmergencyVehicle('ambulance-01', newLocation);
      setVehicleLocations(prev => ({ ...prev, 'ambulance-01': newLocation }));
    }, 5000);

    return () => {
      supabase.removeChannel(crisisSubscription);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6">Emergency Coordinator Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Crises Panel */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Active Crisis Events</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {activeCrises.map((crisis) => (
              <div key={crisis.id} className="bg-red-900/50 p-3 rounded-md">
                <p className="font-bold">{crisis.event_type}</p>
                <p className="text-sm text-gray-300">{new Date(crisis.created_at).toLocaleString()}</p>
                <pre className="text-xs mt-2 bg-gray-900 p-2 rounded">{JSON.stringify(crisis.details, null, 2)}</pre>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle Tracking Panel */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Emergency Vehicle Tracking</h2>
          <div>
            {Object.entries(vehicleLocations).map(([vehicleId, location]) => (
              <div key={vehicleId} className="bg-blue-900/50 p-3 rounded-md">
                <p className="font-bold">{vehicleId}</p>
                <p>Lat: {location.latitude.toFixed(4)}, Lon: {location.longitude.toFixed(4)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmergencyDashboard;
