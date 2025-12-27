import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Settings } from '@/server/bonc'
import { DEFAULT_CODE, DEFAULT_SETTINGS } from '@/constant'

declare global {
  interface Window {
    Terminal?: any
    FitAddon?: any
    require?: any
    monaco?: any
  }
}

type JsonFile = {
  name: string
  path: string
}

type Backend = 'nm' | 'sat' | 'dp'
type StatusLevel = 'info' | 'error'

const MONACO_LOADER =
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js'
const MONACO_BASE =
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs'
const XTERM_SCRIPT = 'https://cdn.jsdelivr.net/npm/xterm@5.3.0/+esm'
const XTERM_FIT_SCRIPT =
  'https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.11.0/+esm'

export const Route = createFileRoute('/')({
  component: BoncApp,
})

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () =>
      reject(new Error(`Failed to load external script: ${src}`))
    document.head.appendChild(script)
  })
}

function BoncApp() {
  const editorHostRef = useRef<HTMLDivElement | null>(null)
  const terminalHostRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<any>(null)
  const terminalRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)

  const [status, setStatus] = useState('')
  const [statusLevel, setStatusLevel] = useState<StatusLevel>('info')
  const [jsonFiles, setJsonFiles] = useState<JsonFile[]>([])
  const [selectedJson, setSelectedJson] = useState<JsonFile | null>(null)
  const [runDir, setRunDir] = useState('Not yet created')
  const [backend, setBackend] = useState<Backend>('nm')
  const [isRunning, setIsRunning] = useState(false)
  const [terminalReady, setTerminalReady] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const [nmDefaultDegree, setNmDefaultDegree] = useState('')
  const [nmExpand, setNmExpand] = useState('')
  const [nmDegrees, setNmDegrees] = useState<
    Array<{ name: string; value: string }>
  >([])

  const [satMode, setSatMode] = useState<'differential' | 'linear'>(
    'differential',
  )
  const [satInputBits, setSatInputBits] = useState('')
  const [satMaxWeight, setSatMaxWeight] = useState('')
  const [satSolve, setSatSolve] = useState(false)
  const [satOutput, setSatOutput] = useState('')
  const [satPrintStates, setSatPrintStates] = useState('')

  const [dpOutput, setDpOutput] = useState('')
  const [dpActiveBits, setDpActiveBits] = useState<
    Array<{ name: string; value: string }>
  >([])
  const [dpOutputBits, setDpOutputBits] = useState<
    Array<{ name: string; value: string }>
  >([])

  const backendRunDisabled = !selectedJson || isRunning

  const updateStatus = useCallback(
    (message: string, level: StatusLevel = 'info') => {
      setStatus(message)
      setStatusLevel(level)
    },
    [],
  )

  const statusClass = useMemo(() => {
    if (!status) {
      return 'status'
    }
    return statusLevel === 'error' ? 'status error' : 'status'
  }, [status, statusLevel])

  useEffect(() => {
    let active = true
    async function initEditor() {
      if (!editorHostRef.current) {
        return
      }
      try {
        await loadScript(MONACO_LOADER)
      } catch (err) {
        updateStatus('Monaco loader unavailable.', 'error')
        return
      }
      if (!window.require) {
        updateStatus('Monaco loader unavailable.', 'error')
        return
      }
      window.require.config({ paths: { vs: MONACO_BASE } })
      window.require(['vs/editor/editor.main'], () => {
        if (!active || !editorHostRef.current) {
          return
        }
        editorRef.current = window.monaco.editor.create(editorHostRef.current, {
          value: DEFAULT_CODE,
          language: 'c',
          theme: 'vs',
          minimap: { enabled: false },
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: 13,
          automaticLayout: true,
        })
      })
    }
    initEditor()
    return () => {
      active = false
      if (editorRef.current) {
        editorRef.current.dispose()
        editorRef.current = null
      }
    }
  }, [updateStatus])

  useEffect(() => {
    async function initTerminal() {
      if (!terminalHostRef.current) {
        return
      }
      try {
        const { Terminal } = await import(/* @vite-ignore */ XTERM_SCRIPT)
        const { FitAddon } = await import(/* @vite-ignore */ XTERM_FIT_SCRIPT)
        window.Terminal = Terminal
        window.FitAddon = FitAddon
      } catch (err) {
        updateStatus('Xterm loader unavailable.', 'error')
        return
      }
      if (!window.Terminal || !window.FitAddon) {
        updateStatus('Xterm loader unavailable.', 'error')
        return
      }
      terminalRef.current = new window.Terminal({
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 13,
        theme: {
          background: '#11100f',
          foreground: '#f5e6d4',
          cursor: '#f5e6d4',
        },
      })
      fitAddonRef.current = new window.FitAddon()
      terminalRef.current.loadAddon(fitAddonRef.current)
      terminalRef.current.open(terminalHostRef.current)
      fitAddonRef.current.fit()
      setTerminalReady(true)

      const handleResize = () => {
        if (editorRef.current) {
          editorRef.current.layout()
        }
        if (fitAddonRef.current) {
          fitAddonRef.current.fit()
        }
      }
      window.addEventListener('resize', handleResize)
      return () => {
        window.removeEventListener('resize', handleResize)
      }
    }
    let cleanup: (() => void) | undefined
    initTerminal().then((maybeCleanup) => {
      cleanup = maybeCleanup
    })
    return () => {
      if (cleanup) {
        cleanup()
      }
      if (terminalRef.current) {
        terminalRef.current.dispose()
        terminalRef.current = null
      }
    }
  }, [updateStatus])

  useEffect(() => {
    if (!terminalReady) {
      return
    }
    const source = new EventSource('/api/stream')
    const handlePty = (event: MessageEvent) => {
      if (!terminalRef.current) {
        return
      }
      try {
        const payload = JSON.parse(event.data) as { data: string }
        terminalRef.current.write(payload.data)
      } catch (err) {
        terminalRef.current.write(event.data)
      }
    }
    const handleNotice = (event: MessageEvent) => {
      if (!terminalRef.current) {
        return
      }
      try {
        const payload = JSON.parse(event.data) as {
          level: string
          message: string
        }
        const prefix = payload.level === 'error' ? '[error]' : '[info]'
        terminalRef.current.writeln(`\r\n${prefix} ${payload.message}`)
      } catch (err) {
        terminalRef.current.writeln(`\r\n${event.data}`)
      }
    }
    source.addEventListener('pty', handlePty)
    source.addEventListener('notice', handleNotice)
    source.onerror = () => {
      updateStatus('Stream disconnected. Refresh to reconnect.', 'error')
    }
    return () => {
      source.close()
    }
  }, [terminalReady, updateStatus])

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/settings')
        if (!res.ok) {
          return
        }
        const data = (await res.json()) as typeof settings
        setSettings({
          clangPath: data.clangPath || '',
          boncLibPath: data.boncLibPath || '',
          frontendPath: data.frontendPath || '',
          backendNmPath: data.backendNmPath || '',
          backendSatPath: data.backendSatPath || '',
          backendDpPath: data.backendDpPath || '',
        })
      } catch {
        updateStatus('Failed to load settings.', 'error')
      }
    }
    fetchSettings()
  }, [updateStatus])

  function updatePair(
    list: Array<{ name: string; value: string }>,
    setList: Dispatch<SetStateAction<Array<{ name: string; value: string }>>>,
    index: number,
    key: 'name' | 'value',
    value: string,
  ) {
    setList(
      list.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item,
      ),
    )
  }

  function addPair(
    setList: Dispatch<SetStateAction<Array<{ name: string; value: string }>>>,
  ) {
    setList((prev) => [...prev, { name: '', value: '' }])
  }

  function removePair(
    list: Array<{ name: string; value: string }>,
    setList: Dispatch<SetStateAction<Array<{ name: string; value: string }>>>,
    index: number,
  ) {
    setList(list.filter((_, idx) => idx !== index))
  }

  async function runCompile() {
    updateStatus('Running compile and symbolic execution...')
    setIsRunning(true)
    setJsonFiles([])
    setSelectedJson(null)
    setRunDir('Running...')
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editorRef.current ? editorRef.current.getValue() : '',
        }),
      })
      const data = (await res.json()) as {
        runDir?: string
        jsonFiles?: JsonFile[]
        error?: string
      }
      if (!res.ok) {
        updateStatus(data.error || 'Compile failed.', 'error')
        setRunDir('Not available')
        return
      }
      setJsonFiles(data.jsonFiles || [])
      setRunDir(data.runDir || 'Unavailable')
      updateStatus('Compile finished. Select a JSON file.')
    } catch (err) {
      updateStatus('Compile request failed. Is the server running?', 'error')
      setRunDir('Not yet created')
    } finally {
      setIsRunning(false)
    }
  }

  function normalizePairs(list: Array<{ name: string; value: string }>) {
    return list
      .map((item) => ({
        name: item.name.trim(),
        value: item.value.trim(),
      }))
      .filter((item) => item.name || item.value)
  }

  async function runBackend() {
    if (!selectedJson) {
      updateStatus('Select a JSON file before running a backend.', 'error')
      return
    }
    let options: Record<string, unknown> = {}
    if (backend === 'nm') {
      options = {
        defaultInputDegree: nmDefaultDegree,
        expand: nmExpand,
        inputDegrees: normalizePairs(nmDegrees),
      }
    } else if (backend === 'sat') {
      if (satSolve && !satPrintStates.trim()) {
        updateStatus('Print states is required when solve is enabled.', 'error')
        return
      }
      if (!satSolve && !satOutput.trim()) {
        updateStatus('Output path is required when solve is disabled.', 'error')
        return
      }
      options = {
        mode: satMode,
        inputBits: satInputBits.trim(),
        maxWeight: satMaxWeight,
        solve: satSolve,
        outputPath: satOutput.trim(),
        printStates: satPrintStates.trim(),
      }
    } else if (backend === 'dp') {
      options = {
        outputPath: dpOutput.trim(),
        activeBits: normalizePairs(dpActiveBits),
        outputBits: normalizePairs(dpOutputBits),
      }
    }
    updateStatus('Running backend...')
    setIsRunning(true)
    try {
      const res = await fetch('/api/run-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          backend,
          jsonPath: selectedJson.path,
          options,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        updateStatus(data.error || 'Backend run failed.', 'error')
        return
      }
      updateStatus('Backend finished.')
    } catch (err) {
      updateStatus('Backend request failed. Is the server running?', 'error')
    } finally {
      setIsRunning(false)
    }
  }

  async function saveSettings() {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        updateStatus(data.error || 'Failed to save settings.', 'error')
        return
      }
      updateStatus('Settings saved.')
      setSettingsOpen(false)
    } catch (err) {
      updateStatus('Failed to save settings.', 'error')
    }
  }

  return (
    <div id="app">
      <div id="editor" ref={editorHostRef}></div>
      <div id="right-panel">
        <div id="config-panel">
          <div className="panel-header">
            <div>
              <div className="eyebrow">BONC UI</div>
              <h1>Cryptanalysis Workbench</h1>
            </div>
            <button
              className="secondary"
              type="button"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
          </div>

          <div className={statusClass}>{status}</div>

          <section className="step">
            <h2>1. Compile and Symbolic Execute</h2>
            <p>Generate LLVM IR and BONC execution results from the editor.</p>
            <button type="button" onClick={runCompile} disabled={isRunning}>
              Compile and Execute
            </button>
          </section>

          <section className="step">
            <h2>2. Select Result JSON</h2>
            <div className="list">
              {jsonFiles.length === 0 ? (
                <div className="muted">No bonc_*.json found yet.</div>
              ) : (
                jsonFiles.map((file) => {
                  const selected = selectedJson?.path === file.path
                  return (
                    <button
                      key={file.path}
                      type="button"
                      className={selected ? 'secondary selected' : 'secondary'}
                      onClick={() => setSelectedJson(file)}
                    >
                      {file.name}
                    </button>
                  )
                })
              )}
            </div>
            <div className="selected">
              Selected: <span>{selectedJson ? selectedJson.name : 'None'}</span>
            </div>
            <div className="run-dir muted">
              Run dir: <span>{runDir}</span>
            </div>
          </section>

          <section className="step">
            <h2>3. Backend Selection</h2>
            <div className="backend-tabs">
              <label>
                <input
                  type="radio"
                  name="backend"
                  value="nm"
                  checked={backend === 'nm'}
                  onChange={() => setBackend('nm')}
                />
                NM
              </label>
              <label>
                <input
                  type="radio"
                  name="backend"
                  value="sat"
                  checked={backend === 'sat'}
                  onChange={() => setBackend('sat')}
                />
                SAT
              </label>
              <label>
                <input
                  type="radio"
                  name="backend"
                  value="dp"
                  checked={backend === 'dp'}
                  onChange={() => setBackend('dp')}
                />
                DP
              </label>
            </div>

            <div
              className={
                backend === 'nm' ? 'backend-config' : 'backend-config hidden'
              }
            >
              <div className="form-row">
                <label htmlFor="nm-default-degree">
                  Default Input Degree (-D)
                </label>
                <input
                  id="nm-default-degree"
                  type="number"
                  placeholder="0"
                  value={nmDefaultDegree}
                  onChange={(event) => setNmDefaultDegree(event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="nm-expand">Expand (--expand)</label>
                <input
                  id="nm-expand"
                  type="number"
                  placeholder="1"
                  value={nmExpand}
                  onChange={(event) => setNmExpand(event.target.value)}
                />
              </div>
              <div className="form-array">
                <div className="form-array-header">
                  <span>Input Degree (-d)</span>
                  <button
                    className="small secondary"
                    type="button"
                    onClick={() => addPair(setNmDegrees)}
                  >
                    Add
                  </button>
                </div>
                <div className="form-array-body">
                  {nmDegrees.map((item, index) => (
                    <div key={`nm-${index}`} className="pair-row">
                      <input
                        type="text"
                        placeholder="name"
                        value={item.name}
                        onChange={(event) =>
                          updatePair(
                            nmDegrees,
                            setNmDegrees,
                            index,
                            'name',
                            event.target.value,
                          )
                        }
                      />
                      <input
                        type="text"
                        placeholder="value"
                        value={item.value}
                        onChange={(event) =>
                          updatePair(
                            nmDegrees,
                            setNmDegrees,
                            index,
                            'value',
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() =>
                          removePair(nmDegrees, setNmDegrees, index)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className={
                backend === 'sat' ? 'backend-config' : 'backend-config hidden'
              }
            >
              <div className="form-row">
                <label>Model Type</label>
                <div className="inline-options">
                  <label>
                    <input
                      type="radio"
                      name="sat-mode"
                      value="differential"
                      checked={satMode === 'differential'}
                      onChange={() => setSatMode('differential')}
                    />
                    Differential (-d)
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="sat-mode"
                      value="linear"
                      checked={satMode === 'linear'}
                      onChange={() => setSatMode('linear')}
                    />
                    Linear (-l)
                  </label>
                </div>
              </div>
              <div className="form-row">
                <label htmlFor="sat-input-bits">Input Bits (-I)</label>
                <input
                  id="sat-input-bits"
                  type="text"
                  placeholder="name1,name2"
                  value={satInputBits}
                  onChange={(event) => setSatInputBits(event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="sat-max-weight">Max Weight (-w)</label>
                <input
                  id="sat-max-weight"
                  type="number"
                  placeholder="Optional"
                  value={satMaxWeight}
                  onChange={(event) => setSatMaxWeight(event.target.value)}
                />
              </div>
              <div className="form-row toggle-row">
                <label htmlFor="sat-solve">Solve (--solve)</label>
                <input
                  id="sat-solve"
                  type="checkbox"
                  checked={satSolve}
                  onChange={(event) => setSatSolve(event.target.checked)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="sat-output">Output (--output)</label>
                <input
                  id="sat-output"
                  type="text"
                  placeholder="model.dimacs"
                  value={satOutput}
                  disabled={satSolve}
                  onChange={(event) => setSatOutput(event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="sat-print-states">
                  Print States (--print-states)
                </label>
                <input
                  id="sat-print-states"
                  type="text"
                  placeholder=".*"
                  value={satPrintStates}
                  disabled={!satSolve}
                  onChange={(event) => setSatPrintStates(event.target.value)}
                />
              </div>
            </div>

            <div
              className={
                backend === 'dp' ? 'backend-config' : 'backend-config hidden'
              }
            >
              <div className="form-row">
                <label htmlFor="dp-output">Output File (-o)</label>
                <input
                  id="dp-output"
                  type="text"
                  placeholder="output.lp"
                  value={dpOutput}
                  onChange={(event) => setDpOutput(event.target.value)}
                />
              </div>
              <div className="form-array">
                <div className="form-array-header">
                  <span>Active Bits (-I)</span>
                  <button
                    className="small secondary"
                    type="button"
                    onClick={() => addPair(setDpActiveBits)}
                  >
                    Add
                  </button>
                </div>
                <div className="form-array-body">
                  {dpActiveBits.map((item, index) => (
                    <div key={`dp-active-${index}`} className="pair-row">
                      <input
                        type="text"
                        placeholder="name"
                        value={item.name}
                        onChange={(event) =>
                          updatePair(
                            dpActiveBits,
                            setDpActiveBits,
                            index,
                            'name',
                            event.target.value,
                          )
                        }
                      />
                      <input
                        type="text"
                        placeholder="range"
                        value={item.value}
                        onChange={(event) =>
                          updatePair(
                            dpActiveBits,
                            setDpActiveBits,
                            index,
                            'value',
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() =>
                          removePair(dpActiveBits, setDpActiveBits, index)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-array">
                <div className="form-array-header">
                  <span>Output Bits (-O)</span>
                  <button
                    className="small secondary"
                    type="button"
                    onClick={() => addPair(setDpOutputBits)}
                  >
                    Add
                  </button>
                </div>
                <div className="form-array-body">
                  {dpOutputBits.map((item, index) => (
                    <div key={`dp-output-${index}`} className="pair-row">
                      <input
                        type="text"
                        placeholder="name"
                        value={item.name}
                        onChange={(event) =>
                          updatePair(
                            dpOutputBits,
                            setDpOutputBits,
                            index,
                            'name',
                            event.target.value,
                          )
                        }
                      />
                      <input
                        type="text"
                        placeholder="range"
                        value={item.value}
                        onChange={(event) =>
                          updatePair(
                            dpOutputBits,
                            setDpOutputBits,
                            index,
                            'value',
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="secondary small"
                        onClick={() =>
                          removePair(dpOutputBits, setDpOutputBits, index)
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              id="backend-run-button"
              type="button"
              onClick={runBackend}
              disabled={backendRunDisabled}
            >
              Run Backend
            </button>
          </section>
        </div>

        <div id="terminal-panel">
          <div className="panel-header compact">
            <div>
              <div className="eyebrow">Output</div>
              <h2>Run Log</h2>
            </div>
            <button
              className="secondary"
              type="button"
              onClick={() => terminalRef.current?.clear()}
            >
              Clear
            </button>
          </div>
          <div id="terminal" ref={terminalHostRef}></div>
        </div>
      </div>

      {settingsOpen ? (
        <>
          <div
            className="modal-backdrop"
            onClick={() => setSettingsOpen(false)}
          ></div>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <h2>Executable Paths</h2>
              <button
                className="secondary"
                type="button"
                onClick={() => setSettingsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label htmlFor="path-clang">bonc-clang</label>
                <input
                  id="path-clang"
                  type="text"
                  placeholder="/usr/local/bin/bonc-clang"
                  value={settings.clangPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      clangPath: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="path-bonclib">&lt;bonc.h&gt; location</label>
                <input
                  id="path-bonclib"
                  type="text"
                  placeholder="/usr/local/include/bonc-lib"
                  value={settings.boncLibPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      boncLibPath: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="path-frontend">bonc-frontend</label>
                <input
                  id="path-frontend"
                  type="text"
                  placeholder="/usr/local/bin/bonc-frontend"
                  value={settings.frontendPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      frontendPath: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="path-nm">bonc-backend-nm</label>
                <input
                  id="path-nm"
                  type="text"
                  placeholder="/usr/local/bin/bonc-backend-nm"
                  value={settings.backendNmPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      backendNmPath: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="path-sat">bonc-backend-sat</label>
                <input
                  id="path-sat"
                  type="text"
                  placeholder="/usr/local/bin/bonc-backend-sat"
                  value={settings.backendSatPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      backendSatPath: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="path-dp">bonc-backend-dp</label>
                <input
                  id="path-dp"
                  type="text"
                  placeholder="/usr/local/bin/bonc-backend-dp"
                  value={settings.backendDpPath}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      backendDpPath: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={saveSettings}>
                Save Settings
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
