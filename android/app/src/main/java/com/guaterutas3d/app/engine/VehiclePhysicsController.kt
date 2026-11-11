package com.guaterutas3d.app.engine

import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * VehicleInput - Virtual input state for vehicle control.
 */
data class VehicleInput(
    var steer: Float = 0f,      // [-1.0 .. +1.0]
    var throttle: Boolean = false,
    var brake: Boolean = false,
    var nitro: Boolean = false
)

/**
 * VehicleConfiguration - Tuned vehicle specifications.
 */
data class VehicleConfiguration(
    val massKg: Float = 1200f,
    val maxSpeedMs: Float = 48f,        // ~172 km/h
    val engineAccelMs2: Float = 14.5f,
    val brakeDecelMs2: Float = 22f,
    val reverseSpeedMaxMs: Float = 9f,
    val lateralGripFactor: Float = 1.08f,
    val dragCoefficient: Float = 0.0018f,
    val rollingResistance: Float = 0.015f
)

/**
 * VehiclePhysicsController - 3D Racing Vehicle Fixed-Time-Step Physics Controller.
 *
 * Implements clean, decoupled Euler/Verlet integration without per-frame allocations:
 * - Constant fixed time step (dt = 1/60s).
 * - Uses GamePools.vec3Pool for temporary force vectors.
 * - Separates longitudinal forces (throttle, brake, rolling, aero drag) and lateral tire grip.
 */
class VehiclePhysicsController(
    val config: VehicleConfiguration = VehicleConfiguration()
) {
    // Current World Transform & Kinematics
    var posX: Float = 0f
    var posY: Float = 0f
    var posZ: Float = 0f

    var headingRad: Float = 0f // Yaw rotation
    var speedMs: Float = 0f    // Forward speed (+ forward, - reverse)
    var steerAngleRad: Float = 0f
    var nitroPct: Float = 100f // [0 .. 100]%

    // Telemetry outputs (read-only for HUD / renderers)
    val speedKmh: Float get() = speedMs * 3.6f
    var currentGear: Int = 1
        private set
    var currentRpm: Float = 800f
        private set

    /**
     * Executes one fixed time step physics step (typically 1/60s = 0.01667s).
     * Guaranteed ZERO allocations: uses pooled math vectors.
     */
    fun updateFixedStep(input: VehicleInput, dt: Float) {
        // 1. Steering smoothing
        val targetSteer = input.steer.coerceIn(-1f, 1f) * 0.48f // max ~27.5 deg lock
        steerAngleRad += (targetSteer - steerAngleRad) * min(1f, 16f * dt)

        // 2. Longitudinal Engine & Braking Forces
        var forwardAccel = 0f

        if (input.throttle) {
            val nitroBoost = if (input.nitro && nitroPct > 0f) {
                nitroPct = max(0f, nitroPct - 18f * dt)
                1.55f // +55% acceleration
            } else {
                1.0f
            }

            // Power band drops as speed approaches maxSpeed
            val speedRatio = (speedMs / config.maxSpeedMs).coerceIn(0f, 1f)
            val availablePower = (1f - speedRatio * 0.75f) * config.engineAccelMs2 * nitroBoost
            forwardAccel += availablePower
        } else if (!input.nitro && nitroPct < 100f) {
            // Passive nitro recharge
            nitroPct = min(100f, nitroPct + 4f * dt)
        }

        if (input.brake) {
            if (speedMs > 0.5f) {
                forwardAccel -= config.brakeDecelMs2
            } else {
                // Reverse gear
                forwardAccel -= config.engineAccelMs2 * 0.55f
            }
        }

        // 3. Environmental Resistance (Aerodynamic Drag & Rolling Friction)
        val aeroDrag = config.dragCoefficient * speedMs * abs(speedMs)
        val rolling = config.rollingResistance * 9.81f * (if (speedMs > 0) 1f else if (speedMs < 0) -1f else 0f)
        forwardAccel -= (aeroDrag + rolling)

        // 4. Integrate Forward Speed
        speedMs += forwardAccel * dt
        if (!input.throttle && !input.brake && abs(speedMs) < 0.2f) {
            speedMs = 0f
        }
        speedMs = speedMs.coerceIn(-config.reverseSpeedMaxMs, config.maxSpeedMs * 1.25f)

        // 5. Angular Heading Update (Bicycle Ackermann model approximation)
        if (abs(speedMs) > 0.05f) {
            val wheelbase = 2.6f
            val angularVelocity = (speedMs / wheelbase) * sin(steerAngleRad) * config.lateralGripFactor
            headingRad += angularVelocity * dt
        }

        // 6. Integrate 3D World Position (Zero Allocations via GamePools)
        GamePools.vec3Pool.use { dir ->
            dir.x = sin(headingRad)
            dir.y = 0f
            dir.z = cos(headingRad)

            posX += dir.x * speedMs * dt
            posZ += dir.z * speedMs * dt
        }

        // 7. Update Engine RPM & Simulated Gearbox
        updateVirtualTransmission()
    }

    private fun updateVirtualTransmission() {
        val absSpeed = abs(speedMs)
        val maxSpeed = config.maxSpeedMs

        if (speedMs < -0.1f) {
            currentGear = -1 // Reverse
            currentRpm = 800f + (absSpeed / config.reverseSpeedMaxMs) * 3800f
            return
        }

        val step = maxSpeed / 6f
        currentGear = min(6, max(1, (absSpeed / step).toInt() + 1))
        val gearBaseSpeed = (currentGear - 1) * step
        val gearSpeedProgress = ((absSpeed - gearBaseSpeed) / step).coerceIn(0f, 1f)
        currentRpm = 1000f + gearSpeedProgress * 5500f
    }

    /**
     * Resets vehicle transform and speeds to initial starting grid coordinates.
     */
    fun reset(x: Float, y: Float, z: Float, heading: Float) {
        posX = x
        posY = y
        posZ = z
        headingRad = heading
        speedMs = 0f
        steerAngleRad = 0f
        nitroPct = 100f
        currentGear = 1
        currentRpm = 800f
    }
}
