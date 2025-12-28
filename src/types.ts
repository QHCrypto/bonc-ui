export interface SBoxDefinition {
  /** Number of bits consumed and produced by the S-Box */
  size: number
  /** Lookup table: index is input value, entry is output value */
  table: number[]
}

export interface RoundSBoxDefinition {
  /** Identifier used for labels */
  id: string
  /** Bit indexes (0-based) consumed by this S-Box */
  bitIndexes: number[]
}

export interface RoundDefinition {
  name: string
  sBoxes: RoundSBoxDefinition[]
}

export interface ConnectionStyle {
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  opacity?: number
}

export type ConnectionStyleMap = Record<string, ConnectionStyle>

export interface SPNConfig {
  blockSize: number
  sBox: SBoxDefinition
  numberOfRounds: number
  /** P-Box permutation expressed with 0-based positions */
  pBox: number[]
  /** Whether the final permutation should be applied after the last round */
  applyFinalPermutation?: boolean
  /** Optional explicit round layout; defaults to sequential grouping */
  rounds?: RoundDefinition[]
  /** Optional mapping from connection key to style */
  connectionStyles?: ConnectionStyleMap
}
