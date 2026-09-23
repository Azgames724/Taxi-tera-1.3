/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function isValidLatLng(coord: unknown): coord is [number, number] {
  if (!Array.isArray(coord) || coord.length < 2) {
    return false;
  }
  const lat = coord[0];
  const lng = coord[1];
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export const DEFAULT_ADDIS_CENTER: [number, number] = [9.0222, 38.7469];
export const DEFAULT_ZOOM = 14;
