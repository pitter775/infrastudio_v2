import packageJson from "../../package.json"

const packageVersion =
  typeof packageJson?.version === "string" && packageJson.version.trim()
    ? packageJson.version.trim()
    : "0.1.0"

function resolveBuildVersion() {
  const explicitVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim()
  if (explicitVersion) {
    return explicitVersion
  }

  const commitSha =
    process.env.NEXT_PUBLIC_GIT_SHA?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.trim() ||
    process.env.GITHUB_SHA?.trim() ||
    ""

  if (commitSha) {
    return commitSha.slice(0, 7)
  }

  return packageVersion
}

export const APP_BUILD_VERSION = resolveBuildVersion()
export const APP_BUILD_LABEL = APP_BUILD_VERSION
