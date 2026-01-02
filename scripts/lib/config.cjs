#!/usr/bin/env node
/**
 * Configuration Schema and Utilities
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Defines the collective.config.json schema and provides
 * utilities for reading, writing, and validating configuration.
 */

const fs = require("fs");
const path = require("path");

/**
 * Configuration schema version
 * Increment when making breaking changes
 */
const CONFIG_VERSION = "1.0.0";

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  $schema: "./node_modules/the-collective-workspace/config.schema.json",
  version: CONFIG_VERSION,
  mode: "docker",
  components: {
    memoryServer: true,
    geminiBridge: true,
    agents: true,
    instructions: true,
  },
  ports: {
    memoryServer: 3100,
    geminiBridge: 3101,
  },
  memory: {
    embeddingModel: "Xenova/all-MiniLM-L6-v2",
    rerankerModel: "Xenova/ms-marco-MiniLM-L-6-v2",
    defaultImportance: 0.5,
    maxResults: 10,
  },
  gemini: {
    model: "gemini-3-flash-preview",
    maxToolCalls: 200,
    timeout: 120000,
    workspaceRoot: "/workspace",
  },
  customizations: [],
  installedAt: null,
  updatedAt: null,
};

/**
 * JSON Schema for collective.config.json
 * This can be used for IDE autocompletion
 */
const CONFIG_JSON_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "the_collective Configuration",
  description: "Configuration file for the_collective AI framework",
  type: "object",
  properties: {
    $schema: {
      type: "string",
      description: "JSON Schema reference for IDE support",
    },
    version: {
      type: "string",
      description: "Configuration schema version",
      pattern: "^\\d+\\.\\d+\\.\\d+$",
    },
    mode: {
      type: "string",
      enum: ["docker", "stdio"],
      description: "Transport mode: docker (SSE) or stdio (Node.js direct)",
    },
    components: {
      type: "object",
      description: "Which components are installed",
      properties: {
        memoryServer: {
          type: "boolean",
          description: "Semantic memory server with DuckDB",
        },
        geminiBridge: {
          type: "boolean",
          description: "Gemini API bridge for research",
        },
        agents: {
          type: "boolean",
          description: "Agent persona definitions",
        },
        instructions: {
          type: "boolean",
          description: "Code generation instructions",
        },
      },
    },
    ports: {
      type: "object",
      description: "Port configuration for MCP servers",
      properties: {
        memoryServer: {
          type: "integer",
          minimum: 1024,
          maximum: 65535,
          default: 3100,
        },
        geminiBridge: {
          type: "integer",
          minimum: 1024,
          maximum: 65535,
          default: 3101,
        },
      },
    },
    memory: {
      type: "object",
      description: "Memory server configuration",
      properties: {
        embeddingModel: {
          type: "string",
          description: "HuggingFace model for embeddings",
          default: "Xenova/all-MiniLM-L6-v2",
        },
        rerankerModel: {
          type: "string",
          description: "Cross-encoder model for reranking",
          default: "Xenova/ms-marco-MiniLM-L-6-v2",
        },
        defaultImportance: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.5,
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 10,
        },
      },
    },
    gemini: {
      type: "object",
      description: "Gemini bridge configuration",
      properties: {
        model: {
          type: "string",
          description: "Gemini model to use",
          default: "gemini-3-flash-preview",
        },
        maxToolCalls: {
          type: "integer",
          description: "Maximum tool calls per query",
          minimum: 1,
          maximum: 1000,
          default: 200,
        },
        timeout: {
          type: "integer",
          description: "Request timeout in milliseconds",
          minimum: 1000,
          default: 120000,
        },
        workspaceRoot: {
          type: "string",
          description: "Workspace root path inside container",
          default: "/workspace",
        },
      },
    },
    customizations: {
      type: "array",
      description: "List of customizations applied to merged files",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          action: { type: "string", enum: ["merged", "created", "skipped"] },
          timestamp: { type: "string", format: "date-time" },
        },
      },
    },
    installedAt: {
      type: ["string", "null"],
      format: "date-time",
      description: "Installation timestamp",
    },
    updatedAt: {
      type: ["string", "null"],
      format: "date-time",
      description: "Last update timestamp",
    },
  },
  required: ["version", "mode", "components"],
};

/**
 * Create a new configuration object
 */
function createConfig(options = {}) {
  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Merge options
  if (options.mode) {
    config.mode = options.mode;
  }

  if (options.components) {
    config.components = { ...config.components, ...options.components };
  }

  if (options.ports) {
    config.ports = { ...config.ports, ...options.ports };
  }

  if (options.memory) {
    config.memory = { ...config.memory, ...options.memory };
  }

  if (options.gemini) {
    config.gemini = { ...config.gemini, ...options.gemini };
  }

  config.installedAt = new Date().toISOString();

  return config;
}

/**
 * Read configuration from file
 */
function readConfig(installDir) {
  const configPath = path.join(installDir, "collective.config.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Write configuration to file
 */
function writeConfig(installDir, config) {
  const configPath = path.join(installDir, "collective.config.json");

  config.updatedAt = new Date().toISOString();

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  return configPath;
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];

  if (!config.version) {
    errors.push("Missing required field: version");
  }

  if (!config.mode || !["docker", "stdio", "local"].includes(config.mode)) {
    errors.push("Invalid mode: must be 'docker' or 'stdio'");
  }

  if (!config.components || typeof config.components !== "object") {
    errors.push("Missing or invalid: components");
  }

  if (config.ports) {
    if (config.ports.memoryServer && (config.ports.memoryServer < 1024 || config.ports.memoryServer > 65535)) {
      errors.push("Invalid memoryServer port: must be between 1024 and 65535");
    }
    if (config.ports.geminiBridge && (config.ports.geminiBridge < 1024 || config.ports.geminiBridge > 65535)) {
      errors.push("Invalid geminiBridge port: must be between 1024 and 65535");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Track a customization
 */
function trackCustomization(config, file, action) {
  if (!config.customizations) {
    config.customizations = [];
  }

  config.customizations.push({
    file,
    action,
    timestamp: new Date().toISOString(),
  });

  return config;
}

/**
 * Generate the JSON schema file
 */
function generateSchemaFile(outputDir) {
  const schemaPath = path.join(outputDir, "config.schema.json");
  fs.writeFileSync(schemaPath, JSON.stringify(CONFIG_JSON_SCHEMA, null, 2) + "\n");
  return schemaPath;
}

module.exports = {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  CONFIG_JSON_SCHEMA,
  createConfig,
  readConfig,
  writeConfig,
  validateConfig,
  trackCustomization,
  generateSchemaFile,
};
