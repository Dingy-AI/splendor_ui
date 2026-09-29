import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const audioDir = join(projectRoot, 'public', 'audio')
await mkdir(audioDir, { recursive: true })
const entries = await readdir(audioDir, { withFileTypes: true })
const byFilename = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const tracks = entries
  .filter(entry => entry.isFile() && /\.m4a$/i.test(entry.name))
  .map(entry => entry.name)
  .sort(byFilename.compare)
  .map(name => `/audio/${encodeURIComponent(name)}`)

await writeFile(join(audioDir, 'playlist.json'), `${JSON.stringify({ tracks }, null, 2)}\n`)
console.log(`Music playlist: ${tracks.length} M4A song${tracks.length === 1 ? '' : 's'}`)
