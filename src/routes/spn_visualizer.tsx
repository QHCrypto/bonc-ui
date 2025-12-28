import { createFileRoute } from '@tanstack/react-router'

import { useEffect, useMemo, useState } from 'react'
import type { ConfigFormState } from '@/components/ConfigForm'
import type { RoundDefinition, SPNConfig } from '@/types'
import { ConfigForm } from '@/components/ConfigForm'
import { SPNDiagram } from '@/components/SPNDiagram'
import { parseNumberList, sanitizeConfig } from '@/utils/spn'
import './spn_visualizer.css'

export const Route = createFileRoute('/spn_visualizer')({
  component: SpnVisualizer,
})

const defaultFormState: ConfigFormState = {
  blockSize: '128',
  sBoxSize: '4',
  numberOfRounds: '8',
  // sBoxTableText: "0xE, 4, 0xD, 1, 2, 0xF, 0xB, 8, 3, 0xA, 6, 0xC, 5, 9, 0, 7",
  sBoxTableText: `1, 10, 4,  12, 6, 15, 3, 9, 2, 13, 11, 7,  5, 0,  8, 14`,
  // pBoxTableText: "0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15",
  pBoxTableText: `0,  33, 66, 99,  96,  1,  34, 67, 64, 97,  2,  35, 32, 65, 98,  3,
    4,  37, 70, 103, 100, 5,  38, 71, 68, 101, 6,  39, 36, 69, 102, 7,
    8,  41, 74, 107, 104, 9,  42, 75, 72, 105, 10, 43, 40, 73, 106, 11,
    12, 45, 78, 111, 108, 13, 46, 79, 76, 109, 14, 47, 44, 77, 110, 15,
    16, 49, 82, 115, 112, 17, 50, 83, 80, 113, 18, 51, 48, 81, 114, 19,
    20, 53, 86, 119, 116, 21, 54, 87, 84, 117, 22, 55, 52, 85, 118, 23,
    24, 57, 90, 123, 120, 25, 58, 91, 88, 121, 26, 59, 56, 89, 122, 27,
    28, 61, 94, 127, 124, 29, 62, 95, 92, 125, 30, 63, 60, 93, 126, 31`,
  applyFinalPermutation: false,
  roundLayoutText: '',
}

function SpnVisualizer() {
  const [formState, setFormState] = useState<ConfigFormState>(defaultFormState)

  const { config, errors } = useMemo(() => parseConfig(formState), [formState])

  const sBoxTable = useMemo(
    () => (config ? formatTable(config.sBox.table, config.sBox.size) : []),
    [config],
  )
  const permutationText = useMemo(
    () => (config ? config.pBox.join(', ') : ''),
    [config],
  )

  useEffect(() => {
    addStyles()
  }, [])

  return (
    <div className="spn-visualizer">
      <aside className="side-panel">
        <header>
          <h1>SPN Visualizer</h1>
          <p>
            Configure an SPN cipher and inspect its substitution and permutation
            structure.
          </p>
        </header>

        <ConfigForm value={formState} onChange={setFormState} />

        {errors.length > 0 ? (
          <section className="validation">
            <h2>Configuration issues</h2>
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </section>
        ) : (
          config && (
            <section className="summary">
              <h2>Cipher summary</h2>
              <div>
                <span className="summary-label">Block size:</span>
                <span>{config.blockSize} bits</span>
              </div>
              <div>
                <span className="summary-label">Rounds:</span>
                <span>{config.numberOfRounds}</span>
              </div>
              <div>
                <span className="summary-label">S-Box size:</span>
                <span>{config.sBox.size} bits</span>
              </div>
              <div>
                <span className="summary-label">Permutation:</span>
                <span>{permutationText}</span>
              </div>

              <div className="table-preview">
                <h3>S-Box table</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Input</th>
                      <th>Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sBoxTable.map(({ input, output }) => (
                      <tr key={input}>
                        <td>{input}</td>
                        <td>{output}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="hint">
                Need to highlight propagation? Attach styles to connection keys
                such as
                <code>input-&gt;round-0-sbox#0</code>.
              </p>
            </section>
          )
        )}
      </aside>
      <main className="diagram-panel">
        {config ? (
          <SPNDiagram config={config} />
        ) : (
          <p className="placeholder">
            Enter a valid configuration to render the network.
          </p>
        )}
      </main>
    </div>
  )
}

function parseConfig(form: ConfigFormState): {
  config: SPNConfig | null
  errors: string[]
} {
  const errors: string[] = []

  const blockSize = parseIntegerField(form.blockSize, 'block size', errors)
  const sBoxSize = parseIntegerField(form.sBoxSize, 'S-Box size', errors)
  const numberOfRounds = parseIntegerField(
    form.numberOfRounds,
    'round count',
    errors,
  )

  let sBoxTable: number[] = []
  try {
    sBoxTable = parseNumberList(form.sBoxTableText)
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Invalid S-Box table values',
    )
  }

  if (sBoxSize !== null && sBoxTable.length !== 0) {
    const expectedSize = 1 << sBoxSize
    if (sBoxTable.length !== expectedSize) {
      errors.push(
        `S-Box table should contain ${expectedSize} entries for ${sBoxSize}-bit input`,
      )
    }
  }

  let pBoxTable: number[] = []
  try {
    pBoxTable = parseNumberList(form.pBoxTableText)
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Invalid permutation values',
    )
  }

  let roundLayouts: RoundDefinition[] | undefined
  try {
    if (blockSize !== null && sBoxSize !== null && numberOfRounds !== null) {
      roundLayouts = parseRoundLayouts(
        form.roundLayoutText,
        blockSize,
        sBoxSize,
        numberOfRounds,
      )
    }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Unable to parse round layout',
    )
  }

  if (blockSize === null || sBoxSize === null || numberOfRounds === null) {
    return { config: null, errors }
  }

  if (blockSize <= 0) {
    errors.push('Block size must be at least 1 bit')
  }
  if (sBoxSize <= 0) {
    errors.push('S-Box size must be at least 1 bit')
  }
  if (blockSize !== null && pBoxTable.length !== blockSize) {
    errors.push(`Permutation must list ${blockSize} positions`)
  }

  if (errors.length > 0) {
    return { config: null, errors }
  }

  const baseConfig: SPNConfig = {
    blockSize,
    numberOfRounds,
    sBox: {
      size: sBoxSize,
      table: sBoxTable,
    },
    pBox: pBoxTable,
    applyFinalPermutation: form.applyFinalPermutation,
    rounds: roundLayouts,
    connectionStyles: {},
  }

  try {
    const sanitized = sanitizeConfig(baseConfig)
    return { config: sanitized, errors: [] }
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Configuration is invalid',
    )
    return { config: null, errors }
  }
}

function parseRoundLayouts(
  text: string,
  blockSize: number,
  sBoxSize: number,
  numberOfRounds: number,
): RoundDefinition[] | undefined {
  const trimmed = text.trim()
  if (!trimmed) {
    return undefined
  }

  const rawLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const lines =
    rawLines.length === 1 && numberOfRounds > 1
      ? Array(numberOfRounds).fill(rawLines[0])
      : rawLines

  if (lines.length !== numberOfRounds) {
    throw new Error(
      'Provide one layout per round or a single line to reuse for every round',
    )
  }

  return lines.map((line, roundIndex) =>
    parseRoundLayoutLine(line, roundIndex, blockSize, sBoxSize),
  )
}

function parseRoundLayoutLine(
  line: string,
  roundIndex: number,
  blockSize: number,
  sBoxSize: number,
): RoundDefinition {
  let label = `Round ${roundIndex + 1}`
  let layoutPart = line

  if (line.includes(':')) {
    const [left, right] = line.split(':', 2)
    if (right.trim().length === 0) {
      throw new Error('Round layout label must be followed by bit groups')
    }
    label = left.trim() || label
    layoutPart = right
  }

  const groups = layoutPart
    .split('|')
    .map((group) => group.trim())
    .filter(Boolean)

  if (!groups.length) {
    throw new Error('Each round needs at least one S-Box group')
  }

  const sBoxes = groups.map((group, index) => {
    const bits = parseNumberList(group)
    if (bits.length !== sBoxSize) {
      throw new Error(
        `S-Box ${index + 1} for round ${
          roundIndex + 1
        } must have ${sBoxSize} bits`,
      )
    }
    bits.forEach((bit) => {
      if (bit < 0 || bit >= blockSize) {
        throw new Error(`Bit index ${bit} is outside 0..${blockSize - 1}`)
      }
    })
    return {
      id: `R${roundIndex + 1}S${index + 1}`,
      bitIndexes: bits,
    }
  })

  const allBits = sBoxes.flatMap((box) => box.bitIndexes)
  const unique = new Set(allBits)
  if (allBits.length !== blockSize) {
    throw new Error(
      `Round ${
        roundIndex + 1
      } must describe exactly ${blockSize} bits in total`,
    )
  }

  if (unique.size !== blockSize) {
    throw new Error(`Round ${roundIndex + 1} must cover every bit exactly once`)
  }

  return {
    name: label,
    sBoxes,
  }
}

function parseIntegerField(
  value: string,
  label: string,
  errors: string[],
): number | null {
  if (!value.trim()) {
    errors.push(`Please enter a value for ${label}`)
    return null
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    errors.push(`"${value}" is not a valid number for ${label}`)
    return null
  }

  return parsed
}

function formatTable(table: number[], sBoxSize: number) {
  return table.map((entry, index) => ({
    input: padBinary(index, sBoxSize),
    output: padBinary(entry, sBoxSize),
  }))
}

function padBinary(value: number, width: number) {
  return value.toString(2).padStart(width, '0')
}

const HIGHLIGHT_BITS: number[][] = [
  // [16, 25, 27],
  // [101, 103],
  // [25],
  // [68, 101],
  // [83, 91, 120],
  // [20, 22, 30, 84, 86, 92],
  [78, 79, 125, 126, 127],
  [48, 60],
  [110, 111],
  [56],
  [47, 76, 109],
]

const P_INV = [
  0, 5, 10, 15, 16, 21, 26, 31, 32, 37, 42, 47, 48, 53, 58, 63, 64, 69, 74, 79,
  80, 85, 90, 95, 96, 101, 106, 111, 112, 117, 122, 127, 12, 1, 6, 11, 28, 17,
  22, 27, 44, 33, 38, 43, 60, 49, 54, 59, 76, 65, 70, 75, 92, 81, 86, 91, 108,
  97, 102, 107, 124, 113, 118, 123, 8, 13, 2, 7, 24, 29, 18, 23, 40, 45, 34, 39,
  56, 61, 50, 55, 72, 77, 66, 71, 88, 93, 82, 87, 104, 109, 98, 103, 120, 125,
  114, 119, 4, 9, 14, 3, 20, 25, 30, 19, 36, 41, 46, 35, 52, 57, 62, 51, 68, 73,
  78, 67, 84, 89, 94, 83, 100, 105, 110, 99, 116, 121, 126, 115,
]

function addStyles() {
  const ids: string[] = []
  for (let round = 0; round < HIGHLIGHT_BITS.length; round++) {
    for (const bit of HIGHLIGHT_BITS[round]) {
      if (round > 0) {
        ids.push(`round-${round - 1}-perm-\\>round-${round}-sbox\\#${bit}`)
        ids.push(
          `round-${round - 1}-sbox-\\>round-${round - 1}-perm\\#${P_INV[bit]}`,
        )
      } else {
        ids.push(`input-\\>round-0-sbox\\#${bit}`)
      }
    }
  }
  const style = document.createElement('style')
  style.innerHTML = ids
    .map(
      (id) => `
    #${id} {
      stroke: #e53e3e;
      stroke-width: 2px;
    }
  `,
    )
    .join('\n')
  document.head.appendChild(style)
}
