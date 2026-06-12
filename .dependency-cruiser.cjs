/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-server-in-client",
      comment:
        "SPA code must never import from the BFF server — " +
        "server modules run in Bun/Node and are not available in the browser bundle.",
      severity: "error",
      from: { path: "^src/(?!server)" },
      to: { path: "^src/server" },
    },
    {
      name: "no-client-in-server",
      comment:
        "BFF server code must never import React components or SPA utilities — " +
        "they depend on browser globals and would break the Hono server.",
      severity: "error",
      from: { path: "^src/server" },
      to: { path: "^src/(components|hooks|styles)" },
    },
    {
      name: "no-circular",
      comment: "Circular dependencies make build order and testing unpredictable.",
      severity: "warn",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
