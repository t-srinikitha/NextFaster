"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Analytics dashboard error:", error);
  }, [error]);

  return (
    <div className="container mx-auto p-8">
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Analytics Dashboard Error
        </h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent1 text-white rounded hover:bg-opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}


