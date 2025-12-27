import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DEFAULT_SETTINGS } from '@/constant'

export type Settings = {
  clangPath: string
  boncLibPath: string
  frontendPath: string
  backendNmPath: string
  backendSatPath: string
  backendDpPath: string
}

type PtyResult = {
  exitCode: number
  signal?: number
}

type PtyCommand = {
  label: string
  cmd: string
  args: string[]
  cwd: string
}

type Backend = 'nm' | 'sat' | 'dp'

const ROOT_DIR = process.cwd()
const DATA_DIR = path.join(ROOT_DIR, 'data')
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json')

const streamClients = new Set<(payload: string) => void>()
let settingsCache: Settings | null = null
let runInProgress = false

export class RunInProgressError extends Error {
  constructor() {
    super('Another run is already in progress.')
    this.name = 'RunInProgressError'
  }
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

export function acquireRunLock() {
  if (runInProgress) {
    throw new RunInProgressError()
  }
  runInProgress = true
  return () => {
    runInProgress = false
  }
}

function normalizeSettings(input: Partial<Settings>) {
  const next: Settings = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(next) as Array<keyof Settings>) {
    if (typeof input[key] === 'string') {
      next[key] = input[key].trim()
    }
  }
  return next
}

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true })
}

async function loadSettingsFromDisk() {
  await ensureDataDir()
  if (!fs.existsSync(SETTINGS_PATH)) {
    await fs.promises.writeFile(
      SETTINGS_PATH,
      JSON.stringify(DEFAULT_SETTINGS, null, 2),
      'utf8',
    )
    return { ...DEFAULT_SETTINGS }
  }
  const raw = await fs.promises.readFile(SETTINGS_PATH, 'utf8')
  try {
    return normalizeSettings(JSON.parse(raw))
  } catch (err) {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function getSettings() {
  if (!settingsCache) {
    settingsCache = await loadSettingsFromDisk()
  }
  return settingsCache
}

export async function saveSettings(input: Partial<Settings>) {
  const next = normalizeSettings(input)
  await ensureDataDir()
  await fs.promises.writeFile(
    SETTINGS_PATH,
    JSON.stringify(next, null, 2),
    'utf8',
  )
  settingsCache = next
  return next
}

function requireExecutable(value: string, label: string) {
  if (!value) {
    throw new BadRequestError(`${label} path is not configured.`)
  }
  if (!fs.existsSync(value)) {
    throw new BadRequestError(`${label} path not found: ${value}`)
  }
}

function broadcast(event: 'pty' | 'notice', data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of streamClients) {
    send(payload)
  }
}

export function sendPty(data: string) {
  broadcast('pty', { data })
}

export function sendNotice(level: 'info' | 'error', message: string) {
  broadcast('notice', { level, message })
}

export function addStreamClient(send: (payload: string) => void) {
  streamClients.add(send)
  return () => {
    streamClients.delete(send)
  }
}

async function runPtyCommand({ label, cmd, args, cwd }: PtyCommand) {
  const ptyModule = await import('node-pty')
  const spawn = ptyModule.spawn
  if (!spawn) {
    throw new Error('node-pty spawn is unavailable.')
  }
  sendNotice('info', `Starting ${label}`)
  return new Promise<PtyResult>((resolve, reject) => {
    let proc
    try {
      proc = spawn(cmd, args, {
        cwd,
        env: process.env,
        cols: 120,
        rows: 30,
        name: 'xterm-color',
      })
    } catch (err) {
      reject(err)
      return
    }

    proc.onData((data: string) => {
      sendPty(data)
    })

    proc.onExit(
      ({ exitCode, signal }: { exitCode: number; signal?: number }) => {
        resolve({ exitCode, signal })
      },
    )
  })
}

async function runCommand(command: PtyCommand) {
  const result = await runPtyCommand(command)
  if (result.exitCode !== 0) {
    throw new Error(`${command.label} failed with code ${result.exitCode}.`)
  }
  sendNotice('info', `${command.label} finished.`)
}

async function createRunDir() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
  const suffix = Math.random().toString(36).slice(2, 8)
  const runDir = path.join(os.tmpdir(), 'bonc-ui', `${stamp}-${suffix}`)
  await fs.promises.mkdir(runDir, { recursive: true })
  return runDir
}

function parseOptionalNumber(value: unknown, label: string) {
  if (value === null || value === undefined || value === '') {
    return null
  }
  const num = Number(value)
  if (Number.isNaN(num)) {
    throw new BadRequestError(`${label} must be a number.`)
  }
  return num
}

function buildNmArgs(jsonPath: string, options: Record<string, unknown>) {
  const args = ['--input', jsonPath]
  const defaultDegree = parseOptionalNumber(
    options.defaultInputDegree,
    'Default input degree',
  )
  const expand = parseOptionalNumber(options.expand, 'Expand')
  if (defaultDegree !== null) {
    args.push('-D', String(defaultDegree))
  }
  if (expand !== null) {
    args.push('--expand', String(expand))
  }
  if (Array.isArray(options.inputDegrees)) {
    const pairs = options.inputDegrees
      .map((item) => ({
        name: String((item as { name?: string }).name || '').trim(),
        value: String((item as { value?: string }).value || '').trim(),
      }))
      .filter((item) => item.name && item.value)
    if (pairs.length) {
      args.push(
        '-d',
        pairs.map((item) => `${item.name}=${item.value}`).join(','),
      )
    }
  }
  return args
}

function buildSatArgs(jsonPath: string, options: Record<string, unknown>) {
  const args = ['--input', jsonPath]
  if (options.mode === 'differential') {
    args.push('-d')
  } else if (options.mode === 'linear') {
    args.push('-l')
  } else {
    throw new BadRequestError(
      'SAT backend requires differential or linear mode.',
    )
  }

  if (typeof options.inputBits === 'string' && options.inputBits.trim()) {
    args.push('-I', options.inputBits.trim())
  }

  const maxWeight = parseOptionalNumber(options.maxWeight, 'Max weight')
  if (maxWeight !== null) {
    args.push('-w', String(maxWeight))
  }

  if (options.solve) {
    if (!options.printStates || !String(options.printStates).trim()) {
      throw new BadRequestError(
        'Print states is required when solve is enabled.',
      )
    }
    args.push('--solve', '--print-states', String(options.printStates).trim())
  } else {
    if (!options.outputPath || !String(options.outputPath).trim()) {
      throw new BadRequestError(
        'Output path is required when solve is disabled.',
      )
    }
    args.push('--output', String(options.outputPath).trim())
  }
  return args
}

function buildDpArgs(jsonPath: string, options: Record<string, unknown>) {
  const args = ['--input', jsonPath]
  if (options.outputPath) {
    args.push('-o', String(options.outputPath).trim())
  }

  const activePairs = Array.isArray(options.activeBits)
    ? options.activeBits
        .map((item) => ({
          name: String((item as { name?: string }).name || '').trim(),
          value: String((item as { value?: string }).value || '').trim(),
        }))
        .filter((item) => item.name && item.value)
    : []
  if (activePairs.length) {
    args.push(
      '-I',
      activePairs.map((item) => `${item.name}=${item.value}`).join(';'),
    )
  }

  const outputPairs = Array.isArray(options.outputBits)
    ? options.outputBits
        .map((item) => ({
          name: String((item as { name?: string }).name || '').trim(),
          value: String((item as { value?: string }).value || '').trim(),
        }))
        .filter((item) => item.name && item.value)
    : []
  if (outputPairs.length) {
    args.push(
      '-O',
      outputPairs.map((item) => `${item.name}=${item.value}`).join(';'),
    )
  }
  return args
}

function buildBackendCommand(
  backend: Backend,
  jsonPath: string,
  options: Record<string, unknown>,
  settings: Settings,
) {
  if (backend === 'nm') {
    requireExecutable(settings.backendNmPath, 'bonc-backend-nm')
    return {
      label: 'bonc-backend-nm',
      cmd: settings.backendNmPath,
      args: buildNmArgs(jsonPath, options),
    }
  }
  if (backend === 'sat') {
    requireExecutable(settings.backendSatPath, 'bonc-backend-sat')
    return {
      label: 'bonc-backend-sat',
      cmd: settings.backendSatPath,
      args: buildSatArgs(jsonPath, options),
    }
  }
  if (backend === 'dp') {
    requireExecutable(settings.backendDpPath, 'bonc-backend-dp')
    return {
      label: 'bonc-backend-dp',
      cmd: settings.backendDpPath,
      args: buildDpArgs(jsonPath, options),
    }
  }
  throw new BadRequestError(`Unknown backend: ${backend}`)
}

export async function compile(code: string) {
  const settings = await getSettings()
  requireExecutable(settings.clangPath, 'bonc-clang')
  requireExecutable(settings.frontendPath, 'bonc-frontend')

  const runDir = await createRunDir()
  const tempC = path.join(runDir, 'temp.c')

  await fs.promises.writeFile(tempC, code, 'utf8')
  await runCommand({
    label: 'bonc-clang',
    cmd: settings.clangPath,
    args: ['temp.c', '-I', settings.boncLibPath, '-emit-llvm', '-S', '-o', 'temp.ll'],
    cwd: runDir,
  })
  await runCommand({
    label: 'bonc-frontend',
    cmd: settings.frontendPath,
    args: ['temp.ll', '--output-dir', 'temp-out'],
    cwd: runDir,
  })

  const globModule = await import('glob')
  const globSync = globModule.globSync

  const jsonFiles = globSync
    ? globSync('temp-out/bonc_*.json', { cwd: runDir, nodir: true }).map(
        (file) => {
          const fullPath = path.join(runDir, file)
          return { name: path.basename(fullPath), path: fullPath }
        },
      )
    : []

  return { runDir, jsonFiles }
}

export async function runBackend(
  backend: Backend,
  jsonPath: string,
  options: Record<string, unknown>,
) {
  if (!fs.existsSync(jsonPath)) {
    throw new BadRequestError(`JSON not found: ${jsonPath}`)
  }
  const settings = await getSettings()
  const command = buildBackendCommand(backend, jsonPath, options, settings)
  await runCommand({
    label: command.label,
    cmd: command.cmd,
    args: command.args,
    cwd: path.dirname(jsonPath),
  })
}
