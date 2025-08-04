"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function USSDPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/ussd/stats")
      .then(res => res.json())
      .then(data => setStats(data.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">USSD Access</h1>
      <p className="mb-2">Access BloodLink Africa services even without internet using USSD codes.</p>
      <div className="mb-4 p-4 bg-gray-50 rounded">
        <h2 className="font-semibold mb-2">How to use USSD</h2>
        <ol className="list-decimal ml-5 space-y-1">
          <li>Dial <b>*123#</b> on your phone.</li>
          <li>Follow the menu to register, request blood, or update your status.</li>
          <li>USSD works on any phone, no internet required.</li>
        </ol>
      </div>
      <div className="mt-8">
        <h2 className="font-semibold mb-2">Your USSD Session Stats</h2>
        {loading ? (
          <p>Loading...</p>
        ) : stats ? (
          <pre className="bg-white p-2 rounded border text-sm overflow-x-auto">{JSON.stringify(stats, null, 2)}</pre>
        ) : (
          <p>No stats available.</p>
        )}
      </div>
    </div>
  );
} 