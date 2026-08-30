export declare const DEMO_TRACE: {
    readonly resourceSpans: readonly [{
        readonly resource: {
            readonly attributes: readonly [{
                readonly key: "service.name";
                readonly value: {
                    readonly stringValue: "incident-agent-demo";
                };
            }, {
                readonly key: "deployment.environment.name";
                readonly value: {
                    readonly stringValue: "demo";
                };
            }];
        };
        readonly scopeSpans: readonly [{
            readonly scope: {
                readonly name: "demo.agent.instrumentation";
                readonly version: "0.1.0";
            };
            readonly spans: readonly [{
                readonly traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910";
                readonly spanId: "1000000000000001";
                readonly name: "triage-session-550e8400-e29b-41d4-a716-446655440000";
                readonly kind: 2;
                readonly startTimeUnixNano: "1788100800000000000";
                readonly endTimeUnixNano: "1788100804800000000";
                readonly status: {
                    readonly code: 1;
                };
                readonly attributes: readonly [{
                    readonly key: "gen_ai.operation.name";
                    readonly value: {
                        readonly stringValue: "invoke_agent";
                    };
                }, {
                    readonly key: "gen_ai.input.messages";
                    readonly value: {
                        readonly stringValue: "Synthetic demo prompt that is intentionally redacted in reports.";
                    };
                }];
            }, {
                readonly traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910";
                readonly spanId: "1000000000000002";
                readonly parentSpanId: "1000000000000001";
                readonly name: "model.request";
                readonly kind: 2;
                readonly startTimeUnixNano: "1788100800200000000";
                readonly endTimeUnixNano: "1788100801350000000";
                readonly status: {
                    readonly code: 2;
                    readonly message: "synthetic provider timeout";
                };
                readonly attributes: readonly [{
                    readonly key: "gen_ai.operation.name";
                    readonly value: {
                        readonly stringValue: "chat";
                    };
                }, {
                    readonly key: "gen_ai.usage.prompt_tokens";
                    readonly value: {
                        readonly intValue: "-2";
                    };
                }];
            }, {
                readonly traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910";
                readonly spanId: "1000000000000003";
                readonly parentSpanId: "1000000000000001";
                readonly name: "tools/call https://api.example.test/logs/42";
                readonly kind: 3;
                readonly startTimeUnixNano: "1788100801450000000";
                readonly endTimeUnixNano: "1788100803100000000";
                readonly status: {
                    readonly code: 1;
                };
                readonly attributes: readonly [{
                    readonly key: "mcp.method.name";
                    readonly value: {
                        readonly stringValue: "tools/call";
                    };
                }, {
                    readonly key: "network.transport";
                    readonly value: {
                        readonly stringValue: "pipe";
                    };
                }, {
                    readonly key: "network.protocol.name";
                    readonly value: {
                        readonly stringValue: "http";
                    };
                }, {
                    readonly key: "gen_ai.tool.call.arguments";
                    readonly value: {
                        readonly stringValue: "{\"query\":\"synthetic incident\"}";
                    };
                }];
            }, {
                readonly traceId: "4fd0b3c24a3f4c7ebd91a30c76e84910";
                readonly spanId: "1000000000000004";
                readonly parentSpanId: "ffffffffffffffff";
                readonly name: "execute_tool deploy_preview";
                readonly kind: 1;
                readonly startTimeUnixNano: "1788100803300000000";
                readonly endTimeUnixNano: "1788100804200000000";
                readonly status: {
                    readonly code: 1;
                };
                readonly attributes: readonly [{
                    readonly key: "gen_ai.operation.name";
                    readonly value: {
                        readonly stringValue: "execute_tool";
                    };
                }, {
                    readonly key: "gen_ai.tool.name";
                    readonly value: {
                        readonly stringValue: "deploy_preview";
                    };
                }, {
                    readonly key: "gen_ai.tool.type";
                    readonly value: {
                        readonly stringValue: "extension";
                    };
                }];
            }];
        }];
    }];
};
//# sourceMappingURL=demo.d.ts.map