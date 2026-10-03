import React, { useState } from "react";
import { Navigation } from "./components/Nav";

interface NodeTelemetry {
  id: string;
  uptimeHours: number;
  temperatureC: number;
  status: "nominal" | "degraded";
}

export default function TelemetryConsole() {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<NodeTelemetry[]>([
    { id: "node-us-east-01", uptimeHours: 742, temperatureC: 41.2, status: "nominal" },
    { id: "node-eu-west-02", uptimeHours: 198, temperatureC: 38.6, status: "nominal" },
  ]);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 font-sans">
      <Navigation />

      <main className="max-w-5xl mx-auto py-12 px-6">
        <header className="mb-10 border-b border-stone-300 pb-6">
          <span className="font-mono text-xs uppercase tracking-wider text-stone-500">
            Cluster Telemetry Console
          </span>
          <h1 className="mt-2 text-3xl font-serif font-bold text-stone-900">
            Node status & hardware metrics
          </h1>
          <p className="mt-2 text-stone-600">
            Live ingestion monitoring across edge compute nodes.
          </p>
        </header>

        {/* Real Product Workflow: Data Table with intentional states */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-8 bg-stone-200 rounded animate-pulse" />
            <div className="h-8 bg-stone-200 rounded animate-pulse" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="p-8 border border-dashed border-stone-300 rounded text-center text-stone-500">
            No telemetry streams connected to this cluster.
          </div>
        ) : (
          <div className="border border-stone-300 rounded overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600">
                <tr>
                  <th className="p-3">Node ID</th>
                  <th className="p-3">Uptime</th>
                  <th className="p-3">Temperature</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {nodes.map((node) => (
                  <tr key={node.id} className="hover:bg-stone-50">
                    <td className="p-3 font-semibold">{node.id}</td>
                    <td className="p-3">{node.uptimeHours}h</td>
                    <td className="p-3">{node.temperatureC}°C</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800">
                        {node.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => setLoading(!loading)}
            className="px-4 py-2 bg-stone-800 text-stone-100 rounded text-sm hover:bg-stone-900 focus-visible:ring-2 focus-visible:ring-stone-600"
          >
            Refresh Telemetry
          </button>
        </div>
      </main>

      <footer className="mt-20 py-8 border-t border-stone-200 text-center text-xs text-stone-500">
        <a href="/terms" className="underline mr-4">Terms</a>
        <a href="/privacy" className="underline">Privacy Policy</a>
      </footer>
    </div>
  );
}
