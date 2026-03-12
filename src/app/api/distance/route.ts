// src/app/api/distance/route.ts
// Server-side proxy for the Google Distance Matrix API.
// Called from LocationDialog (client) → server fetches the Google API.
// The API key is never exposed to the browser.

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  originLat:    z.number(),
  originLng:    z.number(),
  destLat:      z.number(),
  destLng:      z.number(),
});

export async function POST(req: Request) {
  // Auth — hanya user yang login boleh kalkulasi jarak
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input." }, { status: 400 });
  }

  const { originLat, originLng, destLat, destLng } = parsed.data;
  const apiKey = process.env.GOOGLE_MAPS_API_KEY; // server-side key (not NEXT_PUBLIC_)

  if (!apiKey) {
    return Response.json({ error: "Maps API key not configured." }, { status: 500 });
  }

  // Distance Matrix API (v1) — still active and stable
  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins",      `${originLat},${originLng}`);
  url.searchParams.set("destinations", `${destLat},${destLng}`);
  url.searchParams.set("mode",         "driving");
  url.searchParams.set("units",        "metric");
  url.searchParams.set("key",          apiKey);

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    console.error("[/api/distance] Google API error:", data.status, data.error_message);
    return Response.json({ error: `Google API: ${data.status}` }, { status: 502 });
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return Response.json({ error: `Element status: ${element?.status}` }, { status: 502 });
  }

  return Response.json({
    distanceKm:  element.distance.value / 1000,
    durationMin: Math.round(element.duration.value / 60),
  });
}