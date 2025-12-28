import { useMemo } from 'react'
import type { ConnectionStyle, RoundDefinition, SPNConfig } from '../types'

interface StageData {
  id: string
  label: string
  type: 'input' | 'sbox' | 'permutation' | 'output'
  roundIndex?: number
  bits: number[]
}

interface ConnectionSegment {
  id: string
  fromStage: StageData
  toStage: StageData
  bit: number
  path: string
  style: ConnectionStyle
}

interface SBoxShape {
  id: string
  label: string
  x: number
  y: number
  height: number
}

interface SPNDiagramProps {
  config: SPNConfig
}

const stageSpacing = 180
const bitSpacing = 28
const marginX = 80
const marginY = 50
const sboxWidth = 74
const sboxPadding = 10

export function SPNDiagram({ config }: SPNDiagramProps) {
  const stageData = useMemo(() => buildStages(config), [config])
  const bitPositions = useMemo(() => mapBitPositions(stageData), [stageData])
  const stageIndexMap = useMemo(() => {
    const entries = new Map<string, number>()
    stageData.forEach((stage, index) => entries.set(stage.id, index))
    return entries
  }, [stageData])
  const connections = useMemo(
    () => buildConnections(stageData, bitPositions, config.connectionStyles ?? {}),
    [stageData, bitPositions, config.connectionStyles]
  )
  const sboxShapes = useMemo(
    () => buildSBoxShapes(stageData, bitPositions, config.rounds ?? [], stageIndexMap),
    [stageData, bitPositions, config.rounds, stageIndexMap]
  )

  const width = marginX * 2 + stageSpacing * (stageData.length - 1)
  const height = marginY * 2 + bitSpacing * (config.blockSize - 1)

  return (
    <div className="diagram-wrapper">
      <svg className="spn-diagram" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
        <defs>
          <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#4a5568" />
          </marker>
        </defs>

        {stageData.map((stage, index) => (
          <StageLabel key={stage.id} stage={stage} index={index} />
        ))}

        {config.blockSize > 0 &&
          stageData[0]?.bits.map((bit, position) => {
            const y = marginY + position * bitSpacing
            return (
              <text key={`bit-label-${bit}`} className="bit-label" x={marginX - 35} y={y + 4}>
                b{bit}
              </text>
            )
          })}

        {connections.map((connection) => (
          <path
            id={connection.id}
            key={connection.id}
            d={connection.path}
            stroke={connection.style.stroke ?? '#4a5568'}
            strokeWidth={connection.style.strokeWidth ?? 1.6}
            strokeDasharray={connection.style.strokeDasharray}
            opacity={connection.style.opacity ?? 1}
            fill="none"
            markerEnd="url(#arrow-head)"
          />
        ))}

        {stageData.flatMap((stage) => {
          const stageIndex = stageIndexMap.get(stage.id) ?? 0
          const x = marginX + stageIndex * stageSpacing
          return stage.bits.map((bit) => {
            const position = bitPositions[stage.id]?.[bit]
            if (!position) return null
            return <circle key={`${stage.id}-${bit}`} className={`bit-node ${stage.type}`} cx={x} cy={position.y} r={4} />
          })
        })}

        {sboxShapes.map((shape) => (
          <g key={shape.id} className="sbox-shape">
            <rect x={shape.x - sboxWidth / 2} y={shape.y} width={sboxWidth} height={shape.height} rx={8} ry={8} />
            <text x={shape.x} y={shape.y + shape.height / 2} className="sbox-label">
              {shape.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function buildStages(config: SPNConfig): StageData[] {
  const stages: StageData[] = []
  const bitOrder = Array.from({ length: config.blockSize }, (_, i) => i)
  stages.push({ id: 'input', label: 'Input', type: 'input', bits: bitOrder.slice() })

  let currentOrder = bitOrder.slice()

  for (let roundIndex = 0; roundIndex < config.numberOfRounds; roundIndex += 1) {
    const round = config.rounds?.[roundIndex]
    stages.push({
      id: `round-${roundIndex}-sbox`,
      label: round?.name ?? `Round ${roundIndex + 1}`,
      type: 'sbox',
      roundIndex,
      bits: currentOrder.slice(),
    })

    const shouldPermute = config.applyFinalPermutation ? true : roundIndex < config.numberOfRounds - 1
    if (shouldPermute) {
      const permuted = applyPermutation(currentOrder, config.pBox)
      currentOrder = permuted
      stages.push({
        id: `round-${roundIndex}-perm`,
        label: 'Permutation',
        type: 'permutation',
        roundIndex,
        bits: currentOrder.slice(),
      })
    }
  }

  stages.push({ id: 'output', label: 'Output', type: 'output', bits: currentOrder.slice() })

  return stages
}

function applyPermutation(order: number[], permutation: number[]): number[] {
  const next = new Array(order.length)
  for (let i = 0; i < order.length; i += 1) {
    next[permutation[i]] = order[i]
  }
  return next
}

function mapBitPositions(stages: StageData[]): Record<string, Record<number, { y: number }>> {
  const result: Record<string, Record<number, { y: number }>> = {}
  stages.forEach((stage) => {
    const bitMap: Record<number, { y: number }> = {}
    stage.bits.forEach((bitId, positionIndex) => {
      bitMap[bitId] = {
        y: marginY + positionIndex * bitSpacing,
      }
    })
    result[stage.id] = bitMap
  })
  return result
}

function buildConnections(
  stages: StageData[],
  bitPositions: Record<string, Record<number, { y: number }>>,
  styles: Record<string, ConnectionStyle>
): ConnectionSegment[] {
  const segments: ConnectionSegment[] = []

  for (let index = 0; index < stages.length - 1; index += 1) {
    const fromStage = stages[index]
    const toStage = stages[index + 1]
    const x1 = marginX + index * stageSpacing
    let x2 = marginX + (index + 1) * stageSpacing
    if (toStage.type === 'sbox') {
      x2 -= sboxWidth
    }
    const midX = (x1 + x2) / 2

    fromStage.bits.forEach((bitId, index) => {
      const fromPos = bitPositions[fromStage.id]?.[bitId]
      const toPos = bitPositions[toStage.id]?.[bitId]
      if (!fromPos || !toPos) return

      const path = `M ${x1} ${fromPos.y} C ${midX} ${fromPos.y}, ${midX} ${toPos.y}, ${x2} ${toPos.y}`
      const id = `${fromStage.id}->${toStage.id}#${index}`
      const style = styles[id] ?? {}

      segments.push({
        id,
        fromStage,
        toStage,
        bit: bitId,
        path,
        style,
      })
    })
  }

  return segments
}

function buildSBoxShapes(
  stages: StageData[],
  bitPositions: Record<string, Record<number, { y: number }>>,
  rounds: RoundDefinition[],
  stageIndexMap: Map<string, number>
): SBoxShape[] {
  const shapes: SBoxShape[] = []

  rounds.forEach((round, roundIndex) => {
    const stage = stages.find((item) => item.type === 'sbox' && item.roundIndex === roundIndex)
    if (!stage) return
    const stageIndex = stageIndexMap.get(stage.id)
    if (stageIndex === undefined) return
    const x = marginX - sboxWidth / 2 + stageIndex * stageSpacing

    round.sBoxes.forEach((sBox) => {
      const ys = sBox.bitIndexes
        .map((bit) => bitPositions[stage.id]?.[bit]?.y)
        .filter((value): value is number => typeof value === 'number')
      if (!ys.length) return

      const top = Math.min(...ys) - sboxPadding
      const bottom = Math.max(...ys) + sboxPadding

      shapes.push({
        id: `${stage.id}-${sBox.id}`,
        label: sBox.id,
        x,
        y: top,
        height: Math.max(24, bottom - top),
      })
    })
  })

  return shapes
}

function StageLabel({ stage, index }: { stage: StageData; index: number }) {
  const x = marginX + index * stageSpacing
  const y = marginY - 20
  let label = stage.label
  if (stage.type === 'sbox') {
    label = `${stage.label} · S-Box`
  } else if (stage.type === 'permutation') {
    label = `${stage.label} · P-Box`
  } else if (stage.type === 'input') {
    label = 'Input bits'
  } else if (stage.type === 'output') {
    label = 'Output bits'
  }

  return (
    <text className="stage-label" x={x} y={y}>
      {label}
    </text>
  )
}
