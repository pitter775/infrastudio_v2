import packageJson from "../../package.json"

const packageVersion =
  typeof packageJson?.version === "string" && packageJson.version.trim()
    ? packageJson.version.trim()
    : "0.1.0"

export const APP_BUILD_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || packageVersion
export const APP_BUILD_LABEL = `build ${APP_BUILD_VERSION}`
