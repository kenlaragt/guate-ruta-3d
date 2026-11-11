package com.guaterutas3d.app.engine

import android.graphics.Paint
import android.graphics.RectF

/**
 * Mutable 3D Vector for zero-allocation math operations.
 */
class Vec3(var x: Float = 0f, var y: Float = 0f, var z: Float = 0f) {
    fun set(nx: Float, ny: Float, nz: Float): Vec3 {
        x = nx
        y = ny
        z = nz
        return this
    }

    fun set(other: Vec3): Vec3 {
        x = other.x
        y = other.y
        z = other.z
        return this
    }

    fun add(other: Vec3): Vec3 {
        x += other.x
        y += other.y
        z += other.z
        return this
    }

    fun sub(other: Vec3): Vec3 {
        x -= other.x
        y -= other.y
        z -= other.z
        return this
    }

    fun scale(factor: Float): Vec3 {
        x *= factor
        y *= factor
        z *= factor
        return this
    }

    fun lengthSquared(): Float = x * x + y * y + z * z
    fun length(): Float = kotlin.math.sqrt(lengthSquared())

    fun normalize(): Vec3 {
        val len = length()
        if (len > 0.00001f) {
            val inv = 1.0f / len
            x *= inv
            y *= inv
            z *= inv
        }
        return this
    }

    fun reset(): Vec3 {
        x = 0f
        y = 0f
        z = 0f
        return this
    }
}

/**
 * Generic High-Speed Object Pool.
 *
 * Avoids garbage collection pauses by reusing pre-allocated instances.
 * Best practice: Always pair acquire() with release() inside try/finally blocks.
 */
class ObjectPool<T>(
    private val factory: () -> T,
    private val reset: (T) -> Unit,
    initialCapacity: Int = 32,
    private val maxCapacity: Int = 256
) {
    private val pool = ArrayList<T>(maxCapacity)

    init {
        for (i in 0 until initialCapacity) {
            pool.add(factory())
        }
    }

    fun acquire(): T {
        return if (pool.isNotEmpty()) {
            pool.removeAt(pool.size - 1)
        } else {
            factory()
        }
    }

    fun release(instance: T) {
        if (pool.size < maxCapacity) {
            reset(instance)
            pool.add(instance)
        }
    }

    /**
     * Scoped inline helper: acquires an instance, provides it to the block,
     * and guarantees release back into the pool with zero allocation.
     */
    inline fun <R> use(block: (T) -> R): R {
        val item = acquire()
        try {
            return block(item)
        } finally {
            release(item)
        }
    }
}

/**
 * Global Object Pools for rendering and 3D vehicle physics.
 */
object GamePools {
    // 3D Vector Pool (for physics, velocity, forces, raycasts)
    val vec3Pool = ObjectPool(
        factory = { Vec3() },
        reset = { it.reset() },
        initialCapacity = 64,
        maxCapacity = 512
    )

    // Android RectF Pool (for UI bounds, touch collision checks)
    val rectFPool = ObjectPool(
        factory = { RectF() },
        reset = { it.setEmpty() },
        initialCapacity = 16,
        maxCapacity = 64
    )

    // Android Paint Pool (for 2D canvas drawing / HUD overlays)
    val paintPool = ObjectPool(
        factory = { Paint(Paint.ANTI_ALIAS_FLAG) },
        reset = { it.reset(); it.isAntiAlias = true },
        initialCapacity = 8,
        maxCapacity = 32
    )
}
