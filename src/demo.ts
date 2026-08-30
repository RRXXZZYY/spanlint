export const DEMO_TRACE = {
  resourceSpans: [
    {
      resource: {
        attributes: [
          { key: "service.name", value: { stringValue: "incident-agent-demo" } },
          { key: "deployment.environment.name", value: { stringValue: "demo" } }
        ]
      },
      scopeSpans: [
        {
          scope: { name: "demo.agent.instrumentation", version: "0.1.0" },
          spans: [
            {
              traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910",
              spanId: "1000000000000001",
              name: "triage-session-550e8400-e29b-41d4-a716-446655440000",
              kind: 2,
              startTimeUnixNano: "1788100800000000000",
              endTimeUnixNano: "1788100804800000000",
              status: { code: 1 },
              attributes: [
                { key: "gen_ai.operation.name", value: { stringValue: "invoke_agent" } },
                { key: "gen_ai.input.messages", value: { stringValue: "Synthetic demo prompt that is intentionally redacted in reports." } }
              ]
            },
            {
              traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910",
              spanId: "1000000000000002",
              parentSpanId: "1000000000000001",
              name: "model.request",
              kind: 2,
              startTimeUnixNano: "1788100800200000000",
              endTimeUnixNano: "1788100801350000000",
              status: { code: 2, message: "synthetic provider timeout" },
              attributes: [
                { key: "gen_ai.operation.name", value: { stringValue: "chat" } },
                { key: "gen_ai.usage.prompt_tokens", value: { intValue: "-2" } }
              ]
            },
            {
              traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910",
              spanId: "1000000000000003",
              parentSpanId: "1000000000000001",
              name: "tools/call https://api.example.test/logs/42",
              kind: 3,
              startTimeUnixNano: "1788100801450000000",
              endTimeUnixNano: "1788100803100000000",
              status: { code: 1 },
              attributes: [
                { key: "mcp.method.name", value: { stringValue: "tools/call" } },
                { key: "network.transport", value: { stringValue: "pipe" } },
                { key: "network.protocol.name", value: { stringValue: "http" } },
                { key: "gen_ai.tool.call.arguments", value: { stringValue: "{\"query\":\"synthetic incident\"}" } }
              ]
            },
            {
              traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910",
              spanId: "1000000000000004",
              parentSpanId: "ffffffffffffffff",
              name: "execute_tool deploy_preview",
              kind: 1,
              startTimeUnixNano: "1788100803300000000",
              endTimeUnixNano: "1788100804200000000",
              status: { code: 1 },
              attributes: [
                { key: "gen_ai.operation.name", value: { stringValue: "execute_tool" } },
                { key: "gen_ai.tool.name", value: { stringValue: "deploy_preview" } },
                { key: "gen_ai.tool.type", value: { stringValue: "extension" } }
              ]
            }
          ]
        }
      ]
    }
  ]
} as const;
