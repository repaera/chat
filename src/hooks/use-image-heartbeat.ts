// src/hooks/use-image-heartbeat.ts

"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Ping /api/upload/heartbeat every 15 minutes while imageId exists.
// This refreshes lastSeenAt in the DB so the cleanup job doesn't
// delete images still active in the UI.
export function useImageHeartbeat(imageId: string | null) {
  useEffect(() => {
    if (!imageId) return;

    const ping = () => {
      // fire-and-forget — no need to await; failures don't need to be handled
      void fetch("/api/upload/heartbeat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      }).catch(() => {
        // Heartbeat failed — the image may have already expired or there was a network issue.
        // The cleanup job will handle removal if the image is truly old.
      });
    };

    // Ping immediately when a new imageId is set — refresh TTL from the start
    ping();

    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [imageId]);
}