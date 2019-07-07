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

    au_2_units: (au) => {
        return au * Fixed.dist.e2s;
    },
    rel: {
        mercury: {dist: .39, rad: .383},
        venus: {dist: .723, rad: .949},
        mars: {dist: 1.524, rad: .532},
        jupiter: {dist: 5.203, rad: 11.21},
        saturn: {dist: 9.659, rad: 9.45},
        uranus: {dist: 19.539, rad: 4.01},
        neptune: {dist: 30.06, rad: 3.88},
        pluto: {dist: 39.53, rad: .186},
    },
}

export {Fixed, EARTH_RADIUS};