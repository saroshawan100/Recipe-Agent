import { config } from "../config.js";

export interface LocationCoordinates {  latitude: number;
  longitude: number;
}

export async function geocodeLocation(
  location: string,
): Promise<LocationCoordinates | null> {

  if (!config.googleMapsApiKey) {
    throw new Error(
      "Missing GOOGLE_MAPS_API_KEY",
    );
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/geocode/json",
  );

  url.searchParams.set(
    "address",
    location,
  );

  url.searchParams.set(
    "key",
    config.googleMapsApiKey,
  );

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Google Geocoding request failed",
    );
  }

  const data = await response.json();

  if (
    data.status !== "OK" ||
    !data.results?.length
  ) {
    return null;
  }

  return {
    latitude:
      data.results[0].geometry.location.lat,
    longitude:
      data.results[0].geometry.location.lng,
  };
}