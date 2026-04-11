import path from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = path.dirname(fileURLToPath(import.meta.url))
const projectsDir = path.resolve(backendDir, '../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: projectsDir,
  turbopack: {
    root: projectsDir,
  },
}

export default nextConfig
