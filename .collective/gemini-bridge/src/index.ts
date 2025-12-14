/**
 * gemini-bridge - Main entry point
 * 
 * Part of the_collective by screamingearth
 * Copyright © 2025 screamingearth. Licensed under Apache License 2.0.
 * the_collective, Nyx, Prometheus, Cassandra, and Apollo are trademarks of screamingearth.
 * See NOTICE and LICENSE files for details.
 *
 * Provides the bridge between the_collective and Gemini CLI,
 * enabling parallel agent processing with Echo.
 */

export { Echo, echo } from "./echo.js";
export type {
    EchoInvocationOptions,
    EchoResult,
    EchoStatus,
    GeminiBridgeConfig, GeminiJsonResponse,
    GeminiStreamEvent
} from "./types.js";
export {
    buildArgs, checkAuthStatus, extractTextFromEvents, getGeminiCliPath,
    parseJsonResponse,
    parseStreamEvents, spawnGemini
} from "./utils.js";

