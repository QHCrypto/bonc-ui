# Connect the BONC-UI with a SPN visualizer.

When running SAT backend, the program may output following text pattern in its `stdout`:

```
### print-state begin
# State plaintext: 
-x-x-xaxcx-x6x-x-x-x-x-x-xcxcx-x
# State 0/5: 
-x-x-x-x1x-x-xcx-x-x-x-x-xax-x-x
# State 1/5: 
-x-x-x-x-x-x-x-x-x-x-x-x-xcx-x1x
# State 2/5: 
-x-x-xax-x-x-x-x-x-x-x-x-x-x-x-x
# State 3/5: 
-x-x-x-x1x-x-x-x-x-x-x-x-x-x-x-x
# State 4/5: 
-x-x-x-x-x-x-x-x-x-x-x-x-x8x-x-x
# State 5/5: 
-x-x-x2x-x-x-x-x-x-x-x-x-x-x-x1x
# State 6/5: 
8x-x-x8x-x-x-x-x2x-x-x-x-x-x-x-x
# State 7/5: 
1-------3---2---2---4-----------
### print-state end
```

The lines between `### print-state begin` and `### print-state end` could be used to make a visualization diagram using the page `spn_visualizer`.

## Basic approach

Try to write an add-on for the current Xterm.js panel, that when above pattern is detected, hover and add a `Go to SPN visualization` button that open a popup for configuring visualization data. It should include:

- Block size (required)
- S-box size (can be queried from an API, see below)
- Comma-separated S-box truthy value table (can be queried too)
- Comma-separated P-box truthy value table (required)
- Comma-separated round layout (optional)
- Number of round (readonly, fill in the count of valid lines of printed states)
- Highlight bits (readonly, calculated from below script)

...and a redirect button to open the visualizer. When opening SPN visualizer page, it should be able to fetch some initialization data (e.g. from url search parameter), including `ConfigFormState` and `HIGHLIGHT_BITS` (you should make that configurable, it is hard coded now). Fill in them with the previous configured data.

The `P_INV` inside `spn_visualizer.tsx` should be calculated from P-box truthy value and not be hardcoded.

## S-box info querying

The server side reads the current selecting `bonc_*.json`. It might have following fields:

```jsonc
{
  "components": {
    "sboxes": [
      {
        "input_width": 4,
        "name": "const_arr1",
        "output_width": 4,
        "value": [
          // ...
        ]
      }
    ]
  }
  // ...
}
```

Find the `components.sboxes.[0]` and return its `output_width` and `value`. If not exists, leave it empty to user.

## Highlight Bits from printed state lines

```ts
import assert from "node:assert";

// printed states, ignoring #-started lines
const TRAIL = `-x-x-xaxcx-x6x-x-x-x-x-x-xcxcx-x
-x-x-x-x1x-x-xcx-x-x-x-x-xax-x-x
-x-x-x-x-x-x-x-x-x-x-x-x-xcx-x1x
-x-x-xax-x-x-x-x-x-x-x-x-x-x-x-x
-x-x-x-x1x-x-x-x-x-x-x-x-x-x-x-x
-x-x-x-x-x-x-x-x-x-x-x-x-x8x-x-x
-x-x-x2x-x-x-x-x-x-x-x-x-x-x-x1x
8x-x-x8x-x-x-x-x2x-x-x-x-x-x-x-x
1-------3---2---2---4-----------`;

const bitsOfInt = (value: number) => {
  // If assertion failure, hint to user and disable visualization
  assert(value >= 0 && value < 16, "Value must be between 0 and 15");
  const bits = [];
  for (let i = 0; i < 4; i++) {
    if ((value & (1 << i)) !== 0) {
      bits.push(i);
    }
  }
  return bits;
};

const lines = TRAIL.split("\n")
  .map((l) => l.trim())
  .map((l) =>
    [...l]
      // Better to be configured from user that we can reverse bits
      // .reverse()
      // Below line aimed to filter the column contains an `x`. You should try another method to do that.
      .filter((c, i) => i % 2 === 0)
      .map((c) => (c === "-" ? 0 : parseInt(c, 16)))
      .map((v, i) => bitsOfInt(v).map((b) => b + i * 4))
      .flat(),
  );

console.log(lines);
```