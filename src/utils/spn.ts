import type { RoundDefinition, SPNConfig } from '../types'

export function parseNumberList(text: string): number[] {
  const tokens = text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  return tokens.map(parseNumberToken)
}

function parseNumberToken(token: string): number {
  if (!token) {
    throw new Error('Encountered empty numeric token')
  }

  let normalized = token.toLowerCase()

  if (normalized.endsWith('h')) {
    normalized = '0x' + normalized.slice(0, -1)
  }

  const value = Number.parseInt(normalized, 0)
  if (Number.isNaN(value)) {
    throw new Error(`Unable to parse number token "${token}"`)
  }

  return value
}

export function normalizePermutation(permutation: number[], blockSize: number): number[] {
  if (permutation.length !== blockSize) {
    throw new Error(`Permutation should contain ${blockSize} positions, received ${permutation.length}`)
  }

  const hasOneBased = permutation.some((value) => value === blockSize)
  const adjusted = hasOneBased ? permutation.map((value) => value - 1) : permutation.slice()

  const seen = new Set<number>()
  adjusted.forEach((value) => {
    if (value < 0 || value >= blockSize) {
      throw new Error(`Permutation position ${value} is outside of 0..${blockSize - 1}`)
    }
    if (seen.has(value)) {
      throw new Error(`Permutation repeats position ${value}`)
    }
    seen.add(value)
  })

  return adjusted
}

export function generateSequentialRounds(
  blockSize: number,
  sBoxSize: number,
  numberOfRounds: number,
  permutation: number[],
): RoundDefinition[] {
  if (blockSize % sBoxSize !== 0) {
    throw new Error('Block size must be divisible by the S-Box size to build sequential layout')
  }

  const boxesPerRound = blockSize / sBoxSize
  let bitOrder = Array.from({ length: blockSize }, (_, index) => index)

  return Array.from({ length: numberOfRounds }, (_, roundIndex) => {
    const sBoxes = Array.from({ length: boxesPerRound }, (_, boxIndex) => {
      const sliceStart = boxIndex * sBoxSize
      const bits = bitOrder.slice(sliceStart, sliceStart + sBoxSize)
      return {
        id: `S${roundIndex + 1}.${boxIndex + 1}`,
        bitIndexes: bits,
      }
    })

    if (roundIndex < numberOfRounds - 1) {
      bitOrder = applyPermutation(bitOrder, permutation)
    }

    return {
      name: `Round ${roundIndex + 1}`,
      sBoxes,
    }
  })
}

export function sanitizeConfig(config: SPNConfig): SPNConfig {
  const normalizedPermutation = normalizePermutation(config.pBox, config.blockSize)

  const rounds =
    config.rounds ??
    generateSequentialRounds(config.blockSize, config.sBox.size, config.numberOfRounds, normalizedPermutation)

  return {
    ...config,
    pBox: normalizedPermutation,
    rounds,
  }
}

export function invertPermutation(permutation: number[]): number[] {
  const inverse = new Array(permutation.length).fill(-1)
  permutation.forEach((target, index) => {
    inverse[target] = index
  })

  if (inverse.some((value) => value === -1)) {
    throw new Error('Permutation is not a bijection and cannot be inverted')
  }

  return inverse
}

function applyPermutation<T>(values: T[], permutation: number[]): T[] {
  const next = values.slice()
  permutation.forEach((position, index) => {
    next[position] = values[index]
  })
  return next
}
