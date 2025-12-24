## BONC UI Requirements Document

Build a local Web application whose basic function is to provide a visual user interface for several command-line programs.

Target platform: Linux only
Technical architecture: local Server + browser UI; TanStack Start (or similar) is recommended.

## Basic Concepts

BONC is a cryptanalysis suite. Assume the following programs already exist on the user’s computer:

* `bonc-clang`: a modified C compiler frontend
* `bonc-frontend`: a symbolic executor based on LLVM input, producing several execution result files
* `bonc-backend-*`: a family of backend implementations, each with its own CLI format

## UI

```
+--------+----------+
|        | Config   |
| Monaco | Items    |
| Editor +----------+
|        | Xterm.js |
+--------+----------+
```

The left side of the UI is a Monaco Editor with basic C syntax highlighting. The upper-right is a configuration panel, where the user configures the following step by step:

1. Button: Compile & Symbolic Execute
2. Execution result list: after execution, list all result files; selecting one enables the next step
3. Backend selection & parameter setup & run the selected backend

After any of the above buttons are clicked, the UI sends a request to the backend to start the corresponding program execution, and streams the output back in PTY form to the Xterm.js panel in the lower-right.

A basic settings modal is available in a corner, allowing configuration of the paths to `bonc-clang`, `bonc-frontend`, and all `bonc-backend-*` executables (manual input; do not scan `PATH`).

## Details

### Step 1 Compile & Symbolic Execute

* Save user input as `temp.c`
* Run `bonc-clang temp.c -emit-llvm -S -o temp.ll`
* Run `bonc-frontend temp.ll --output-dir temp-out`

If execution succeeds, `temp-out` will contain several `bonc_*.json`. Use Glob to obtain all `bonc_*.json` and list them in the Step 2 list.

This temp directory can be placed under the OS temporary directory, kept on disk, and should support user manual deletion.

### Step 2 Select one JSON file

Display a filename list for the user to select. (No need to preview file contents for now; they are large and hard to render.)

### Step 3 Backend Selection

The user can choose one of the following three backends: `bonc-backend-nm`, `bonc-backend-sat`, and `bonc-backend-dp`.

The CLI formats for each backend are as follows:

```
./bonc-backend-nm --help
Allowed options:
  --help                                Print help message
  --input arg                           Input file containing the frontend
                                        result in JSON format
  -d [ --input-degree ] arg             BONC Input degree, format
                                        "name1=value1,name2=value2,..."
  -D [ --default-input-degree ] arg (=0)
                                        Default BONC Input degree
  --expand arg (=1)                     Expand substitute operation n times
```

Pass the JSON path via `--input`. The user can configure `-D` and `--expand`, and configure `-d` as a Form Array.

```
./bonc-backend-sat --help
Allowed options:
  --help                   Print help message
  --input arg              Input file containing the frontend result in JSON
                           format
  -d [ --differential ]    Construct differential propagation model
  -l [ --linear ]          Construct linear propagation model
  -I [ --input-bits ] arg  BONC Input bits' name, format "name1,name2..."
  -w [ --max-weight ] arg  Max weight (probability or correlation) allowed;
                           defaults to input size / 2 for linear, input size
                           for differential
  --output arg             Output file to write the model in DIMACS format
  --solve                  Solve the model using cryptominisat5
  --print-states arg (=.*) A regex pattern to filter state variable solutions
                           to print
```

Pass the JSON path via `--input`. The user must choose exactly one of `-d` or `-l`. Configure `-I` as a Tag Input. Optionally configure integer input `-w`. Configure `--solve` as a toggle: if enabled, `--print-states` is required; otherwise, `--output` is required.

```
./bonc-backend-dp --help
Allowed options:
  --help                           Print help message
  --input arg                      Input file containing the frontend result in
                                   JSON format
  -I [ --active-bits ] arg         Specify active bits as initial DP, format
                                   "name1=range;name2=range;...". Range is
                                   comma-separated numbers or a-b for
                                   contiguous ranges, e.g., "0,2,4-7"
  -O [ --output-bits ] arg         Specify output bits as target final DP,
                                   format "name1=range;name2=range;...".
                                   Defaults to all output bits. Range is
                                   comma-separated numbers or a-b for
                                   contiguous ranges, e.g., "0,2,4-7"
  -o [ --output ] arg (=output.lp) Output LP file
```

Pass the JSON path via `--input`. The user can configure `-o`, and configure `-I` and `-O` as Form Arrays.

After configuration, clicking Run automatically assembles the command line and executes it. The results are displayed in the lower-right output window as well.
