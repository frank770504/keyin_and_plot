# Technical Specification: Advanced Search (Rheology Query Language - RQL)

## 1. Overview
The Advanced Search system replaces the standard text filter with a robust query engine (RQL). It allows users to perform complex filtering on the measurement list using field-specific prefixes, logical operators, and grouping.

## 2. RQL Grammar & Syntax

### A. Field Prefixes
Specific metadata fields can be targeted using a colon (`:`) separator:
- `name:<string>`: Matches the formula ID.
- `id:<string>`: Matches the PKEY.
- `date:<string>`: Matches the test date string.
- `serial:<string>`: Matches the Serial ID (UI: SID).
- `note:<string>`: Matches the notes.
- `is:<flag>`: Matches boolean or state flags:
    - `is:plot` or `is:selected`: Shows only measurements selected for comparison.
    - `is:draft`: Shows only active draft measurements.

### B. Logical Operators
Queries can be combined using standard logical operators (case-insensitive):
- `AND`, `&&`, or `[space]`: Logical conjunction (Intersection).
- `OR`, `||`, or `|`: Logical disjunction (Union).
- `NOT`, `!`: Logical negation (Exclusion).
- `( )`: Parentheses for explicit precedence control.

### C. Values & Quoting
- **Bare Values**: Single words do not require quotes.
- **Quoted Values**: Phrases containing spaces must be enclosed in double quotes (e.g., `name:"Batch 12"`).

## 3. Hybrid Search Mode
To maintain a low barrier to entry and backward compatibility, the engine implements a Hybrid Search behavior:
1.  **Simple Fallback**: If no RQL syntax characters (`:`, `(`, `)`, `!`, `|`, `&`) or uppercase keywords are detected, the system treats the input as a "Global Search" across Name, Date, and Serial ID.
2.  **Bare Terms in Queries**: Any value provided without a prefix inside a complex query (e.g., `is:plot water`) is automatically evaluated as a Global Search term.

## 4. Implementation Details
- **Parser Module**: `static/js/query_parser.js`.
- **Architecture**: A two-stage process consisting of a Regex-based **Tokenizer** followed by a **Recursive Descent Parser** that generates an Abstract Syntax Tree (AST).
- **Execution**: The AST is converted into a predicate function `(measurement) => boolean` which is applied to the list in `static/js/ui/measurement_ui.js`.
- **Resilience**: The evaluator includes robust null-checks and type-coercion to ensure that malformed data or empty fields do not crash the search interface.
