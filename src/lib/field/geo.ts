/** Start/finish further than this from the job address are flagged as suspicious. */
export const FIELD_DISTANCE_THRESHOLD_M = 300

export type LatLng = { lat: number; lng: number }

const EARTH_RADIUS_M = 6_371_000

/** Great-circle distance in metres (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export type ProofEvaluation = {
  /** Null when the job address could not be geocoded. */
  distanceM: number | null
  suspicious: boolean
}

/**
 * A location proof is suspicious when the device was further than the
 * threshold from the job address, or when the address could not be located
 * (nothing to compare against). Suspicious proofs require a reason.
 */
export function evaluateProof(device: LatLng, address: LatLng | null): ProofEvaluation {
  if (!address) return { distanceM: null, suspicious: true }
  const distanceM = Math.round(distanceMeters(device, address))
  return { distanceM, suspicious: distanceM > FIELD_DISTANCE_THRESHOLD_M }
}
