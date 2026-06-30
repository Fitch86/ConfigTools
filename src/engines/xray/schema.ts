/**
 * JSON Schema for Xray-core 26.3 server-side config.json.
 *
 * Hand-written from the Xray-core source (transport_internet.go, config.go).
 * Used by the validator (ajv) for structural checks.
 */

export const xrayConfigSchema = {
  $id: "https://configtools.dev/schemas/xray-config.json",
  type: "object",
  required: ["inbounds", "outbounds"],
  additionalProperties: true,
  properties: {
    log: {
      type: "object",
      additionalProperties: true,
      properties: {
        loglevel: {
          type: "string",
          enum: ["Debug", "Info", "Warning", "Error", "None"],
        },
        access: { type: "string" },
        error: { type: "string" },
      },
    },
    dns: {
      type: "object",
      additionalProperties: true,
      properties: {
        servers: {
          type: "array",
          items: {
            type: "object",
            required: ["address"],
            properties: {
              address: { type: "string" },
              port: { type: "number" },
              domains: { type: "array", items: { type: "string" } },
              skipFallback: { type: "boolean" },
            },
          },
        },
      },
    },
    routing: {
      type: "object",
      required: ["rules"],
      additionalProperties: true,
      properties: {
        domainStrategy: {
          type: "string",
          enum: ["AsIs", "IPIfNonMatch", "IPOnDemand"],
        },
        domainMatcher: { type: "string", enum: ["hybrid", "linear"] },
        rules: {
          type: "array",
          items: {
            type: "object",
            required: ["type", "outboundTag"],
            properties: {
              type: { type: "string", const: "field" },
              outboundTag: { type: "string" },
              inboundTag: { type: "array", items: { type: "string" } },
              domain: {
                type: "array",
                items: {
                  oneOf: [
                    { type: "string" },
                    {
                      type: "object",
                      required: ["type", "value"],
                      properties: {
                        type: { type: "string" },
                        value: { type: "string" },
                      },
                    },
                  ],
                },
              },
              ip: { type: "array", items: { type: "string" } },
              port: { oneOf: [{ type: "string" }, { type: "number" }] },
              sourcePort: { oneOf: [{ type: "string" }, { type: "number" }] },
              network: { type: "string" },
              source: { type: "array", items: { type: "string" } },
              user: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    inbounds: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["tag", "port", "protocol", "settings", "streamSettings"],
        properties: {
          tag: { type: "string" },
          port: { type: "number", minimum: 1, maximum: 65535 },
          listen: { type: "string" },
          protocol: { type: "string", const: "vless" },
          settings: {
            type: "object",
            required: ["clients", "decryption"],
            properties: {
              clients: {
                type: "array",
                minItems: 1,
                items: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    flow: { type: "string" },
                  },
                },
              },
              decryption: { type: "string", const: "none" },
            },
          },
          streamSettings: {
            type: "object",
            required: ["network", "security"],
            properties: {
              network: {
                type: "string",
                enum: ["raw", "ws", "grpc", "h2", "http"],
              },
              security: {
                type: "string",
                enum: ["none", "tls", "reality"],
              },
              tlsSettings: {
                type: "object",
                properties: {
                  serverName: { type: "string" },
                  alpn: { type: "array", items: { type: "string" } },
                  minVersion: { type: "string" },
                  cipherSuites: { type: "array", items: { type: "string" } },
                  fingerprint: { type: "string" },
                  certificates: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        certificateFile: { type: "string" },
                        keyFile: { type: "string" },
                        certificate: {
                          oneOf: [
                            { type: "string" },
                            { type: "array", items: { type: "string" } },
                          ],
                        },
                        key: {
                          oneOf: [
                            { type: "string" },
                            { type: "array", items: { type: "string" } },
                          ],
                        },
                      },
                    },
                  },
                  allowInsecure: { type: "boolean" },
                },
              },
              realitySettings: {
                type: "object",
                required: ["dest", "serverNames", "privateKey", "shortIds"],
                properties: {
                  show: { type: "boolean" },
                  dest: { type: "string" },
                  xver: { type: "number", enum: [0, 1, 2] },
                  serverNames: { type: "array", items: { type: "string" } },
                  privateKey: { type: "string" },
                  shortIds: { type: "array", items: { type: "string" } },
                },
              },
              wsSettings: {
                type: "object",
                properties: {
                  path: { type: "string" },
                  host: { type: "string" },
                  headers: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                },
              },
              grpcSettings: {
                type: "object",
                required: ["serviceName"],
                properties: {
                  serviceName: { type: "string" },
                  multiMode: { type: "boolean" },
                  idleTimeout: { type: "number" },
                  initialWindowsSize: { type: "number" },
                  userAgent: { type: "string" },
                  healthCheckTimeout: { type: "number" },
                },
              },
              rawSettings: {
                type: "object",
                properties: {
                  acceptProxyProtocol: { type: "boolean" },
                },
              },
            },
          },
          sniffing: {
            type: "object",
            required: ["enabled", "destOverride"],
            properties: {
              enabled: { type: "boolean" },
              destOverride: {
                type: "array",
                items: { type: "string" },
              },
              routeOnly: { type: "boolean" },
            },
          },
        },
      },
    },
    outbounds: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["tag", "protocol"],
        properties: {
          tag: { type: "string" },
          protocol: {
            type: "string",
            enum: ["freedom", "blackhole", "dns"],
          },
          settings: { type: "object", additionalProperties: true },
          streamSettings: { type: "object", additionalProperties: true },
        },
      },
    },
  },
} as const;
