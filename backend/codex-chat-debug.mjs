import { writeFileSync } from "node:fs"
import nextEnv from "@next/env"

const { loadEnvConfig } = nextEnv
loadEnvConfig(process.cwd())
const { processChatRequest } = await import("./lib/chat/service.js")

try {
  const result = await processChatRequest({
    message: "oi qual os planos e valores ?",
    widgetSlug: "infrastudio-chat",
    canal: "web",
    identificadorExterno: "codex-debug-home-pricing",
    context: {
      route: { path: "/" },
      ui: {
        title: "InfraStudio Home",
        theme: "dark",
        accent: "#2563eb",
        transparent: true,
      },
    },
  })
  writeFileSync("codex-chat-debug.json", JSON.stringify(result, null, 2))
  console.log("ok")
} catch (error) {
  writeFileSync("codex-chat-debug-error.txt", String(error?.stack || error))
  console.error(error)
  process.exit(1)
}
