import { normalizeVinInput } from './nhtsa-vpic'

/** VIN position 10 (1-based) model-year code → possible calendar years (30-year cycle). */
const YEAR_CODE_TO_PAIR: Record<string, [number, number]> = {
  A: [1980, 2010],
  B: [1981, 2011],
  C: [1982, 2012],
  D: [1983, 2013],
  E: [1984, 2014],
  F: [1985, 2015],
  G: [1986, 2016],
  H: [1987, 2017],
  J: [1988, 2018],
  K: [1989, 2019],
  L: [1990, 2020],
  M: [1991, 2021],
  N: [1992, 2022],
  P: [1993, 2023],
  R: [1994, 2024],
  S: [1995, 2025],
  T: [1996, 2026],
  V: [1997, 2027],
  W: [1998, 2028],
  X: [1999, 2029],
  Y: [2000, 2030],
  '1': [2001, 2031],
  '2': [2002, 2032],
  '3': [2003, 2033],
  '4': [2004, 2034],
  '5': [2005, 2035],
  '6': [2006, 2036],
  '7': [2007, 2037],
  '8': [2008, 2038],
  '9': [2009, 2039],
}

/**
 * Best-guess model year from VIN character 10 for NHTSA `modelyear` query param.
 * Picks the candidate in the 30-year pair closest to the current calendar year (+1 for new models).
 */
export function modelYearHintFromVin(vin: string): number | null {
  const normalized = normalizeVinInput(vin)
  if (normalized.length < 10) return null
  const code = normalized[9]
  const pair = YEAR_CODE_TO_PAIR[code]
  if (!pair) return null

  const anchor = new Date().getFullYear() + 1
  const [a, b] = pair
  return Math.abs(a - anchor) <= Math.abs(b - anchor) ? a : b
}