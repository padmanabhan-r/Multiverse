/**
 * Per-station "plate" palettes used by CoverTile + HeroBand as generated-look
 * stand-ins until real Gemini/OpenAI art lands (S4/Sb).
 *
 * Each entry is a CSS `background` value built from radial- and linear-gradients
 * tuned to that station's location, era, and texture. All hexes are warm/cool
 * neutrals + accent tints — no purple / blue / iridescent.
 */

export interface PlateRecipe {
  /** A `background: ...;` value. */
  background: string;
  /**
   * Optional accent paint applied via `::after` (we mirror it as an extra layer
   * in the component when needed).
   */
  accentLayer?: string;
}

const PLATES: Record<string, PlateRecipe> = {
  // Brooklyn 88.7 Night Cab — NYC late-night sodium amber, yellow-cab gold,
  // asphalt rain reflection, steam-vent haze
  brooklyn_887: {
    background: [
      // rain streaks at a steep angle (subtle)
      "repeating-linear-gradient(112deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0) 9.5px)",
      // steam-vent haze near top-left
      "radial-gradient(circle at 14% 22%, rgba(218,196,150,0.20) 0%, rgba(218,196,150,0) 28%)",
      // sodium amber near street-lamp glow, lower-right
      "radial-gradient(circle at 76% 64%, rgba(240,168,76,0.42) 0%, rgba(240,168,76,0) 36%)",
      // distant yellow-cab gold pool
      "radial-gradient(circle at 28% 72%, rgba(228,170,72,0.32) 0%, rgba(228,170,72,0) 30%)",
      // asphalt reflection band
      "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(212,142,62,0.16) 64%, rgba(212,142,62,0.05) 76%, rgba(0,0,0,0) 88%)",
      // wet ground gradient base
      "linear-gradient(180deg, #0a0c10 0%, #0d1014 40%, #1a1410 64%, #0b0a0b 100%)",
    ].join(", "),
  },

  city_fm_1986: {
    background: [
      "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 14px, rgba(255,255,255,0.03) 14px, rgba(255,255,255,0) 15px)",
      "radial-gradient(circle at 70% 60%, rgba(216,82,60,0.45) 0%, rgba(216,82,60,0) 38%)",
      "radial-gradient(circle at 25% 75%, rgba(214,168,86,0.35) 0%, rgba(214,168,86,0) 32%)",
      "linear-gradient(170deg, #1a0f08 0%, #160807 50%, #0a0506 100%)",
    ].join(", "),
  },

  wartime_1940: {
    background: [
      "radial-gradient(circle at 50% 38%, rgba(0,0,0,0) 18%, rgba(0,0,0,0.4) 60%)",
      "radial-gradient(circle at 50% 35%, rgba(212,196,164,0.18) 0%, rgba(212,196,164,0) 30%)",
      "linear-gradient(180deg, #1d160e 0%, #120c08 100%)",
    ].join(", "),
  },

  orbital_2089: {
    background: [
      "radial-gradient(ellipse at 50% 50%, rgba(170,180,190,0.18) 0%, rgba(170,180,190,0) 40%)",
      "linear-gradient(180deg, #161a1d 0%, #0b0e10 100%)",
    ].join(", "),
  },

  imperium_steamwire: {
    background: [
      "radial-gradient(circle at 50% 55%, rgba(214,158,82,0.22) 0%, rgba(214,158,82,0) 38%)",
      "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.10) 0%, rgba(255,106,31,0) 28%)",
      "linear-gradient(165deg, #2a0d08 0%, #1a0606 55%, #0a0303 100%)",
    ].join(", "),
  },

  sunset_collapse_1086: {
    background: [
      "repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 22px, rgba(255,255,255,0.04) 22px, rgba(255,255,255,0) 23px)",
      "linear-gradient(180deg, #2a0a05 0%, #d96a35 45%, #1a0604 55%, #0a0202 100%)",
    ].join(", "),
    accentLayer:
      "linear-gradient(180deg, transparent 41%, rgba(255,138,61,0.85) 41.5%, rgba(255,138,61,0) 43%)",
  },
};

const FALLBACK: PlateRecipe = {
  background: [
    "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.18) 0%, rgba(255,106,31,0) 38%)",
    "linear-gradient(165deg, #1a1c22 0%, #0d1014 60%, #0a0a0c 100%)",
  ].join(", "),
};

export function plateFor(stationId: string): PlateRecipe {
  return PLATES[stationId] ?? FALLBACK;
}

/** Template stub palette for the "Start from a template" shelf. */
export function templatePlate(seed: string): PlateRecipe {
  const palettes = [
    "linear-gradient(165deg, #1d262a 0%, #0b1a1c 70%, #050a0c 100%)",
    "linear-gradient(165deg, #2a1c10 0%, #15100a 70%, #0a0604 100%)",
    "linear-gradient(165deg, #1a0700 0%, #2a0a05 60%, #0a0202 100%)",
    "linear-gradient(165deg, #161a1d 0%, #0d1418 70%, #060c0e 100%)",
    "linear-gradient(165deg, #1a0606 0%, #2a0a05 55%, #100302 100%)",
  ];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return {
    background: [
      "radial-gradient(circle at 30% 30%, rgba(255,106,31,0.18) 0%, rgba(255,106,31,0) 38%)",
      palettes[h % palettes.length],
    ].join(", "),
  };
}
