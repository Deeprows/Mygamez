extends RefCounted
## Shared constants. Same numbers as the Three.js build (src/world.js) so both builds feel alike.
## Player travels toward -Z. Car nose faces -Z. Ground y = 0. Units: metres, speed in m/s.

const LANES := 4
const LANE_W := 3.6
const ROAD_W := 14.4          # LANES * LANE_W
const SHOULDER := 1.0
const TOTAL_W := 16.4         # ROAD_W + 2 * SHOULDER
const SEG_LEN := 60.0
const SEG_COUNT := 14
const PLAYER_BOUND := 7.2     # max |x| for the player car centre

static func lane_x(i: int) -> float:
	return (float(i) - (LANES - 1) / 2.0) * LANE_W
