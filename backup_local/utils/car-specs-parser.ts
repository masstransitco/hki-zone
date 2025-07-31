/**
 * Car specifications parser for Hong Kong car listings
 * Parses spec strings like "2014, 柴油 5座 2143cc 自動AT" into structured data
 */

export interface CarSpecs {
  year?: string;
  fuel?: string;
  seats?: string;
  engine?: string;
  transmission?: string;
  raw?: string;
}

export interface ParsedCarSpecs extends CarSpecs {
  formatted: {
    fuel?: string;
    seats?: string;
    engine?: string;
    transmission?: string;
  };
}

// Fuel type mappings
const FUEL_TYPES: Record<string, string> = {
  '柴油': 'Diesel',
  '汽油': 'Petrol',
  '石油': 'Petrol',
  '電動': 'Electric',
  '混合': 'Hybrid',
  '油電': 'Hybrid',
  'Hybrid': 'Hybrid',
  'Electric': 'Electric',
  'Petrol': 'Petrol',
  'Diesel': 'Diesel',
};

// Transmission mappings
const TRANSMISSION_TYPES: Record<string, string> = {
  '自動': 'Auto',
  '手動': 'Manual',
  '自動AT': 'Auto',
  '手動MT': 'Manual',
  'CVT': 'CVT',
  'AT': 'Auto',
  'MT': 'Manual',
  'Auto': 'Auto',
  'Manual': 'Manual',
};

/**
 * Parse car specifications string
 */
export function parseCarSpecs(specString: string): ParsedCarSpecs {
  if (!specString) {
    return {
      formatted: {}
    };
  }

  const specs: CarSpecs = {
    raw: specString
  };

  // Split by comma and clean up
  const parts = specString.split(',').map(part => part.trim());

  parts.forEach(part => {
    // Extract year (4 digits)
    const yearMatch = part.match(/(\d{4})/);
    if (yearMatch && !specs.year) {
      specs.year = yearMatch[1];
    }

    // Extract fuel type
    const fuelMatch = part.match(/(柴油|汽油|石油|電動|混合|油電|Hybrid|Electric|Petrol|Diesel)/);
    if (fuelMatch && !specs.fuel) {
      specs.fuel = fuelMatch[1];
    }

    // Extract seats (number followed by 座)
    const seatsMatch = part.match(/(\d+)座/);
    if (seatsMatch && !specs.seats) {
      specs.seats = seatsMatch[1];
    }

    // Extract engine (number followed by cc)
    const engineMatch = part.match(/(\d+)cc/);
    if (engineMatch && !specs.engine) {
      specs.engine = engineMatch[1];
    }

    // Extract transmission
    const transmissionMatch = part.match(/(自動AT|手動MT|自動|手動|CVT|AT|MT|Auto|Manual)/);
    if (transmissionMatch && !specs.transmission) {
      specs.transmission = transmissionMatch[1];
    }
  });

  // Format the specifications
  const formatted: ParsedCarSpecs['formatted'] = {};

  if (specs.fuel) {
    formatted.fuel = FUEL_TYPES[specs.fuel] || specs.fuel;
  }

  if (specs.seats) {
    formatted.seats = `${specs.seats} seats`;
  }

  if (specs.engine) {
    formatted.engine = `${specs.engine}cc`;
  }

  if (specs.transmission) {
    formatted.transmission = TRANSMISSION_TYPES[specs.transmission] || specs.transmission;
  }

  return {
    ...specs,
    formatted
  };
}

/**
 * Get key specifications for display in cards
 */
export function getKeySpecs(specs: ParsedCarSpecs): string[] {
  const keySpecs: string[] = [];

  if (specs.formatted?.fuel) {
    keySpecs.push(specs.formatted.fuel);
  }

  if (specs.formatted?.seats) {
    keySpecs.push(specs.formatted.seats);
  }

  if (specs.formatted?.engine) {
    keySpecs.push(specs.formatted.engine);
  }

  if (specs.formatted?.transmission) {
    keySpecs.push(specs.formatted.transmission);
  }

  return keySpecs;
}

/**
 * Get formatted specification string for display
 */
export function getFormattedSpecString(specs: ParsedCarSpecs): string {
  const keySpecs = getKeySpecs(specs);
  return keySpecs.join(' • ');
}

/**
 * Get detailed specifications for bottom sheet
 */
export function getDetailedSpecs(specs: ParsedCarSpecs): Array<{label: string; value: string}> {
  const details: Array<{label: string; value: string}> = [];

  if (specs.year) {
    details.push({ label: 'Year', value: specs.year });
  }

  if (specs.formatted?.fuel) {
    details.push({ label: 'Fuel Type', value: specs.formatted.fuel });
  }

  if (specs.formatted?.seats) {
    details.push({ label: 'Seats', value: specs.formatted.seats });
  }

  if (specs.formatted?.engine) {
    details.push({ label: 'Engine', value: specs.formatted.engine });
  }

  if (specs.formatted?.transmission) {
    details.push({ label: 'Transmission', value: specs.formatted.transmission });
  }

  return details;
}