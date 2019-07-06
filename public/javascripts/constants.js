const EARTH_RADIUS = 3960;
const SUN_RADIUS = 432450;
const MOON_RADIUS = 1080;

const EARTH_TO_SUN = 93000000;
const MOON_TO_EARTH = 239000;
const LIGHT_SPEED = 186282; // mps

const Fixed = {
    rad: {
    earth: 1.0,
    sun: SUN_RADIUS/EARTH_RADIUS,
    moon: MOON_RADIUS/EARTH_RADIUS
    },
    dist: {
        e2s: EARTH_TO_SUN/EARTH_RADIUS,
        m2e: MOON_TO_EARTH/EARTH_RADIUS
    },
    lightspeed_mps: LIGHT_SPEED/EARTH_RADIUS,
}

export {Fixed, EARTH_RADIUS};