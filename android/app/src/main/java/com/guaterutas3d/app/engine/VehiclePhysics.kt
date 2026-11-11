package com.guaterutas3d.app.engine

/**
 * Modelo de física determinista para vehículo en 3D con paso de tiempo fijo (Fixed Delta Time).
 * Velocidad máxima recomendada: 30 a 60 m/s (100 a 200 km/h virtuales).
 * Aceleración inicial: 12 m/s² para arranque veloz y respuesta inmediata.
 */
class VehiclePhysics {

    // Velocidad expresada en metros por segundo (m/s)
    var currentSpeed: Float = 0f
    val maxSpeed: Float = 45f        // Aprox. 160 km/h (Mantiene la física estable)
    val acceleration: Float = 12f     // Aceleración m/s²
    val deceleration: Float = 8f      // Freno / Fricción m/s²

    // Ángulo de dirección (heading) en radianes
    var heading: Float = 0f
    val turnSpeed: Float = 2.4f      // Radianes por segundo al girar

    fun update(deltaTime: Float, isAccelerating: Boolean, isBraking: Boolean) {
        // Ajuste de velocidad según las entradas del jugador
        if (isAccelerating) {
            currentSpeed += acceleration * deltaTime
            if (currentSpeed > maxSpeed) currentSpeed = maxSpeed
        } else if (isBraking) {
            currentSpeed -= deceleration * 2 * deltaTime
            if (currentSpeed < 0f) currentSpeed = 0f
        } else {
            // Desaceleración natural por fricción
            currentSpeed -= deceleration * deltaTime
            if (currentSpeed < 0f) currentSpeed = 0f
        }
    }

    fun turn(direction: Float, deltaTime: Float) {
        // Rotación proporcional a la velocidad para evitar giros irreales detenido
        val speedFactor = if (currentSpeed > 0.5f) (currentSpeed / maxSpeed).coerceIn(0.2f, 1.0f) else 0f
        heading += direction * turnSpeed * speedFactor * deltaTime
    }

    fun reset() {
        currentSpeed = 0f
        heading = 0f
    }
}
