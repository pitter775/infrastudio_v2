import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = path.dirname(fileURLToPath(import.meta.url))
const workspaceDir = path.resolve(backendDir, '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: workspaceDir,
  turbopack: {
    root: workspaceDir,
  },
}

export default nextConfig
