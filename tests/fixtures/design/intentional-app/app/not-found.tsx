import React from "react";

export default function NotFound() {
  return (
    <main className="p-12 text-center font-serif text-stone-800">
      <h1 className="text-3xl font-bold">Node Not Located</h1>
      <p className="mt-4 text-stone-600">The requested telemetry stream is not reporting on this cluster.</p>
      <a href="/" className="mt-6 inline-block underline font-mono text-sm">Return to cluster overview</a>
    </main>
  );
}
