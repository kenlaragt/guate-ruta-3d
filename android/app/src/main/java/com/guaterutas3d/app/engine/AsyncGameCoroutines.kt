package com.guaterutas3d.app.engine

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * GameDispatcherProvider - Centralized coroutine dispatchers for the game engine.
 * Ensures strict separation between UI, heavy physics/AI compute, and disk/network I/O.
 */
interface GameDispatcherProvider {
    val main: CoroutineDispatcher
    val compute: CoroutineDispatcher // Physics, pathfinding, AI math
    val io: CoroutineDispatcher      // Tracks, textures, audio, local persistence
}

class DefaultGameDispatcherProvider : GameDispatcherProvider {
    override val main: CoroutineDispatcher = Dispatchers.Main.immediate
    override val compute: CoroutineDispatcher = Dispatchers.Default
    override val io: CoroutineDispatcher = Dispatchers.IO
}

/**
 * AsyncGameRunner - Manages asynchronous game tasks without blocking the Android UI thread.
 */
class AsyncGameRunner(
    private val dispatchers: GameDispatcherProvider = DefaultGameDispatcherProvider()
) {
    private val exceptionHandler = CoroutineExceptionHandler { _, throwable ->
        android.util.Log.e("GameEngine", "Unhandled async game coroutine exception: ${throwable.message}", throwable)
    }

    // Engine Scope bounded with SupervisorJob so one failure does not crash the loop
    val engineScope = CoroutineScope(SupervisorJob() + dispatchers.compute + exceptionHandler)

    // Event bus for asynchronous game events (e.g., checkpoint passed, award unlocked)
    private val _gameEvents = MutableSharedFlow<String>(extraBufferCapacity = 64)
    val gameEvents: SharedFlow<String> = _gameEvents.asSharedFlow()

    /**
     * Executes heavy computations (e.g., AI driver path evaluation, procedural meshes)
     * strictly on Dispatchers.Default, leaving the UI thread buttery smooth.
     */
    fun launchComputeTask(block: suspend CoroutineScope.() -> Unit) {
        engineScope.launch(dispatchers.compute) {
            block()
        }
    }

    /**
     * Executes I/O tasks (e.g., loading 3D track definitions, caching textures, saving medals)
     * strictly on Dispatchers.IO.
     */
    fun launchIOTask(block: suspend CoroutineScope.() -> Unit) {
        engineScope.launch(dispatchers.io) {
            block()
        }
    }

    /**
     * Emits a game event asynchronously without blocking.
     */
    fun emitEvent(eventName: String) {
        _gameEvents.tryEmit(eventName)
    }
}
