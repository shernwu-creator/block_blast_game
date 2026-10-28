import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const PRECACHE_BLOCK =
  /\/\/ BEGIN GENERATED PRECACHE[\s\S]*?\/\/ END GENERATED PRECACHE/

function collectFiles(directory, root = directory, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, root, files)
    } else {
      files.push(relative(root, fullPath).split(sep).join('/'))
    }
  }
  return files
}

/**
 * Rewrites the pre-cache block of `dist/sw.js` with every file produced by the
 * build (HTML, hashed JS/CSS, fonts, icons). That is what makes the installed
 * game work offline on the very first launch, without a second online visit.
 *
 * A hash of the emitted file list becomes the cache version, so a new deploy
 * automatically replaces the old caches.
 */
function pwaPrecacheManifest() {
  let outDir = ''

  return {
    name: 'block-blast:pwa-precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = collectFiles(outDir)
        .filter((file) => file !== 'sw.js')
        .sort()

      const revision = createHash('sha256')
      for (const file of files) {
        revision.update(`${file}:${statSync(join(outDir, file)).size};`)
      }
      const buildId = revision.digest('hex').slice(0, 12)

      const block = [
        `// BEGIN GENERATED PRECACHE (build ${buildId})`,
        `const BUILD_ID = '${buildId}'`,
        `const PRECACHE_FILES = ${JSON.stringify(files, null, 2)}`,
        '// END GENERATED PRECACHE',
      ].join('\n')

      const swPath = join(outDir, 'sw.js')
      const source = readFileSync(swPath, 'utf8')
      if (!PRECACHE_BLOCK.test(source)) {
        throw new Error(
          '[pwa-precache] "BEGIN/END GENERATED PRECACHE" markers are missing from public/sw.js',
        )
      }

      writeFileSync(swPath, source.replace(PRECACHE_BLOCK, () => block))
      console.log(`[pwa-precache] ${files.length} files pre-cached (build ${buildId})`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/block_blast_game/',
  plugins: [react(), tailwindcss(), pwaPrecacheManifest()],
})

