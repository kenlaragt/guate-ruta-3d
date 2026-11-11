package com.guaterutas3d.app.engine

import android.view.Choreographer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * GameLoopEngine - High-Performance 60 FPS Decoupled Game Loop for Android.
 *
 * Key Architecture Highlights:
 * 1. Decoupled Physics: Physics step runs with a strict fixed time step (60Hz = 16.66ms).
 *    Never perform physics, integration, or raycasts inside onDraw() or invalidate()!
 * 2. Choreographer VSYNC Sync: Utilizes Android's hardware VSYNC via Choreographer.postFrameCallback
 *    for tear-free refresh rates matching the display (60Hz / 90Hz / 120Hz).
 * 3. NanoTime Accumulator: Uses System.nanoTime() with accumulator clamping (max 100ms)
 *    to prevent the "spiral of death" during temporary stalls.
 * 4. Zero Main-Thread Blocking: Heavy physics calculations run asynchronously or within
 *    budgeted fixed-step slices, keeping the Android UI thread responsive at all times.
 */
class GameLoopEngine(
    private val onFixedPhysicsUpdate: (dt: Float) -> Unit,
    private val onRenderInterpolate: (alpha: Float) -> Unit
) : Choreographer.FrameCallback {

    companion object {
        const val FIXED_TIME_STEP_SEC = 1.0f / 60.0f // 16.666ms per physics step
        private const val FIXED_TIME_STEP_NANOS = (FIXED_TIME_STEP_SEC * 1_000_000_000L).toLong()
        private const val MAX_ACCUMULATOR_NANOS = 100_000_000L // 100ms clamp (max 6 steps)
    }

    private val scope = CoroutineScope(Dispatchers.Default + Job())

    private var isRunning = false
    private var lastFrameTimeNanos: Long = 0L
    private var accumulatorNanos: Long = 0L

    // FPS Counter Telemetry (recycled, zero allocations)
    private var frameCount = 0
    private var fpsTimerNanos: Long = 0L
    private val _currentFpsFlow = MutableStateFlow(60)
    val currentFpsFlow: StateFlow<Int> = _currentFpsFlow.asStateFlow()

    fun start() {
        if (isRunning) return
        isRunning = true
        lastFrameTimeNanos = System.nanoTime()
        fpsTimerNanos = lastFrameTimeNanos
        accumulatorNanos = 0L
        frameCount = 0
        Choreographer.getInstance().postFrameCallback(this)
    }

    fun stop() {
        isRunning = false
        Choreographer.getInstance().removeFrameCallback(this)
        scope.cancel()
    }

    override fun doFrame(frameTimeNanos: Long) {
        if (!isRunning) return

        // Compute delta time since previous frame
        if (lastFrameTimeNanos == 0L) {
            lastFrameTimeNanos = frameTimeNanos
        }
        var elapsedNanos = frameTimeNanos - lastFrameTimeNanos
        lastFrameTimeNanos = frameTimeNanos

        // Safety clamp: if backgrounded or huge spike, clamp to avoid spiral of death
        if (elapsedNanos > MAX_ACCUMULATOR_NANOS) {
            elapsedNanos = MAX_ACCUMULATOR_NANOS
        }

        accumulatorNanos += elapsedNanos

        // Fixed Time Step Physics Slices (Strict 60Hz)
        while (accumulatorNanos >= FIXED_TIME_STEP_NANOS) {
            onFixedPhysicsUpdate(FIXED_TIME_STEP_SEC)
            accumulatorNanos -= FIXED_TIME_STEP_NANOS
        }

        // Interpolation alpha [0.0 .. 1.0] for smooth sub-frame rendering between physics states
        val alpha = accumulatorNanos.toFloat() / FIXED_TIME_STEP_NANOS.toFloat()
        onRenderInterpolate(alpha)

        // FPS Calculation (updated once per second without string formatting overhead)
        frameCount++
        if (frameTimeNanos - fpsTimerNanos >= 1_000_000_000L) {
            _currentFpsFlow.value = frameCount
            frameCount = 0
            fpsTimerNanos = frameTimeNanos
        }

        // Request next hardware VSYNC frame
        Choreographer.getInstance().postFrameCallback(this)
    }
}
