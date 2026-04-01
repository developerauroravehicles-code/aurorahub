/**
 * Add light/dark Tailwind pairs for dashboard + shared components.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
process.chdir(root)

const roots = [path.join('src', 'app', 'dashboard'), path.join('src', 'components')]
const extraFiles = [
  path.join('src', 'app', 'page.tsx'),
  path.join('src', 'components', 'landing-content.tsx'),
  path.join('src', 'app', 'login', 'page.tsx'),
]

const skip = new Set(['theme-provider.tsx', 'theme-toggle.tsx'])

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const pairs = [
  [/border-gray-800\b/g, 'border-zinc-200 dark:border-gray-800'],
  [/border-gray-700\b/g, 'border-zinc-300 dark:border-gray-700'],
  [/border-gray-600\b/g, 'border-zinc-300 dark:border-gray-600'],
  [/divide-gray-800\b/g, 'divide-zinc-200 dark:divide-gray-800'],
  [/(?<!dark:)bg-black\/50\b/g, 'bg-white dark:bg-black/50'],
  [/(?<!dark:)bg-black\/30\b/g, 'bg-zinc-100/90 dark:bg-black/30'],
  [/(?<!dark:)bg-black\/70\b/g, 'bg-zinc-900/50 dark:bg-black/70'],
  [/(?<!dark:)bg-black\/80\b/g, 'bg-zinc-900/60 dark:bg-black/80'],
  [/(?<!dark:)bg-black\b/g, 'bg-zinc-50 dark:bg-black'],
  [/bg-gray-900\/50\b/g, 'bg-zinc-200/80 dark:bg-gray-900/50'],
  [/bg-gray-900\/30\b/g, 'bg-zinc-200/60 dark:bg-gray-900/30'],
  [/(?<!dark:)bg-gray-900\b/g, 'bg-zinc-200 dark:bg-gray-900'],
  [/bg-white\/5\b/g, 'bg-zinc-200/50 dark:bg-white/5'],
  [/bg-white\/10\b/g, 'bg-zinc-200 dark:bg-white/10'],
  [/hover:bg-white\/5\b/g, 'hover:bg-zinc-200/70 dark:hover:bg-white/5'],
  [/hover:bg-white\/10\b/g, 'hover:bg-zinc-300 dark:hover:bg-white/10'],
  [/text-gray-200\b/g, 'text-zinc-800 dark:text-gray-200'],
  [/text-gray-300\b/g, 'text-zinc-600 dark:text-gray-300'],
  [/text-gray-400\b/g, 'text-zinc-500 dark:text-gray-400'],
  [/text-gray-500\b/g, 'text-zinc-500 dark:text-gray-500'],
  [/text-gray-600\b/g, 'text-zinc-600 dark:text-gray-600'],
]

const keepWhiteLine =
  /C27E00|c27e00|a06900|bg-green-|bg-red-|bg-blue-9|bg-amber|bg-emerald|bg-yellow-9|bg-orange|text-emerald|text-green-4|text-red-4|text-blue-4|text-yellow-3|bg-gray-600|bg-gray-700 hover:bg-gray-500|bg-\[#/

function migrateFile(file) {
  let s = fs.readFileSync(file, 'utf8')
  const original = s
  for (const [re, to] of pairs) s = s.replace(re, to)

  s = s
    .split('\n')
    .map((line) => {
      if (keepWhiteLine.test(line)) return line
      return line.replace(/\btext-white\b/g, 'text-zinc-900 dark:text-white')
    })
    .join('\n')

  if (s !== original) {
    fs.writeFileSync(file, s, 'utf8')
    return true
  }
  return false
}

const files = new Set()
for (const r of roots) walk(r).forEach((f) => files.add(f))
for (const f of extraFiles) if (fs.existsSync(f)) files.add(f)

let n = 0
for (const file of files) {
  if (skip.has(path.basename(file))) continue
  if (migrateFile(file)) n++
}
console.log('Updated files:', n)
