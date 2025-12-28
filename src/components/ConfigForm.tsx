import type { ChangeEvent } from 'react'

export interface ConfigFormState {
  blockSize: string
  sBoxSize: string
  numberOfRounds: string
  sBoxTableText: string
  pBoxTableText: string
  applyFinalPermutation: boolean
  roundLayoutText: string
}

interface ConfigFormProps {
  value: ConfigFormState
  onChange: (next: ConfigFormState) => void
}

export function ConfigForm({ value, onChange }: ConfigFormProps) {
  const handleNumberChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value: nextValue } = event.target
    onChange({ ...value, [name]: nextValue })
  }

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const { name, value: nextValue } = event.target
    onChange({ ...value, [name]: nextValue })
  }

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target
    onChange({ ...value, [name]: checked })
  }

  return (
    <div className="config-form">
      <div className="field-group">
        <label>
          Block size (bits)
          <input name="blockSize" type="number" min={1} value={value.blockSize} onChange={handleNumberChange} />
        </label>
        <label>
          S-Box size (bits)
          <input name="sBoxSize" type="number" min={1} value={value.sBoxSize} onChange={handleNumberChange} />
        </label>
        <label>
          Rounds
          <input name="numberOfRounds" type="number" min={1} value={value.numberOfRounds} onChange={handleNumberChange} />
        </label>
      </div>

      <label className="field-block">
        S-Box table
        <textarea
          name="sBoxTableText"
          rows={3}
          value={value.sBoxTableText}
          onChange={handleTextChange}
          placeholder="Comma or space separated values. Example: 0xE, 4, 0xD, 1, ..."
        />
      </label>

      <label className="field-block">
        P-Box permutation
        <textarea
          name="pBoxTableText"
          rows={3}
          value={value.pBoxTableText}
          onChange={handleTextChange}
          placeholder="Bit positions after permutation (0-based or 1-based)."
        />
      </label>

      <label className="field-block">
        Round layout (optional)
        <textarea
          name="roundLayoutText"
          rows={4}
          value={value.roundLayoutText}
          onChange={handleTextChange}
          placeholder={
            'One line per round. Separate S-Boxes with | and bits with commas. Example: 0,1,2,3 | 4,5,6,7'
          }
        />
        <span className="help-text">
          Leave empty to use sequential groups of {value.sBoxSize || '?'} bits per S-Box.
        </span>
      </label>

      <label className="checkbox">
        <input
          name="applyFinalPermutation"
          type="checkbox"
          checked={value.applyFinalPermutation}
          onChange={handleCheckboxChange}
        />
        Apply permutation after the last round
      </label>
    </div>
  )
}
