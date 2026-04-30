/**
 * query_parser.js - A lightweight parser for Rheology Query Language (RQL)
 * Supports: AND, OR, NOT, Grouping (), Fields (name:, date:, serial:, is:)
 * Hybrid Mode: Fallback to global search if no query syntax detected.
 */

export function parseQuery(query, comparisonSelected) {
    if (!query || !query.trim()) {
        return () => true;
    }

    const trimmedQuery = query.trim();

    // Check for "Simple Mode" (no operators or fields)
    const hasSpecialChars = /[:()!|&]/.test(trimmedQuery);
    const hasKeywords = /\b(AND|OR|NOT)\b/.test(trimmedQuery);

    if (!hasSpecialChars && !hasKeywords) {
        return (m) => {
            try {
                const term = trimmedQuery.toLowerCase();
                const name = (m.name || '').toString().toLowerCase();
                const date = (m.date || '').toString();
                const serial = (m.serial_id || '').toString().toLowerCase();
                return name.includes(term) || date.includes(term) || serial.includes(term);
            } catch (e) {
                return false;
            }
        };
    }

    try {
        const tokens = tokenize(trimmedQuery);
        const expression = parseExpression(tokens);
        return (m) => {
            try {
                return evaluate(expression, m, comparisonSelected);
            } catch (e) {
                return false;
            }
        };
    } catch (e) {
        console.warn("RQL Parse Error:", e);
        return () => false;
    }
}

function tokenize(str) {
    const tokens = [];
    // Allowed characters for values include letters, numbers, and common symbols like colons for fields
    const regex = /"([^"]*)"|(\()|(\))|(!|&&|\|\||AND|OR|NOT)|([^\s()!|&]+)/g;
    let match;

    while ((match = regex.exec(str)) !== null) {
        if (match[1] !== undefined) tokens.push({ type: 'VALUE', val: match[1] });
        else if (match[2]) tokens.push({ type: 'LPAREN' });
        else if (match[3]) tokens.push({ type: 'RPAREN' });
        else if (match[4]) {
            let op = match[4];
            if (op === '&&') op = 'AND';
            if (op === '||' || op === '|') op = 'OR';
            if (op === '!') op = 'NOT';
            tokens.push({ type: 'OPERATOR', val: op });
        }
        else if (match[5]) {
            const parts = match[5].split(':');
            if (parts.length > 1 && ['name', 'date', 'serial', 'is'].includes(parts[0])) {
                tokens.push({ type: 'FIELD', field: parts[0], val: parts.slice(1).join(':') });
            } else {
                tokens.push({ type: 'VALUE', val: match[5] });
            }
        }
    }
    return tokens;
}

// Simple Recursive Descent Parser
function parseExpression(tokens) {
    let pos = 0;

    function parseOr() {
        let node = parseAnd();
        while (pos < tokens.length && (tokens[pos].val === 'OR')) {
            pos++;
            node = { type: 'OR', left: node, right: parseAnd() };
        }
        return node;
    }

    function parseAnd() {
        let node = parsePrimary();
        while (pos < tokens.length && (tokens[pos].val === 'AND' || tokens[pos].type === 'FIELD' || tokens[pos].type === 'VALUE' || tokens[pos].type === 'LPAREN' || tokens[pos].val === 'NOT')) {
            if (tokens[pos].val === 'AND') pos++;
            node = { type: 'AND', left: node, right: parsePrimary() };
        }
        return node;
    }

    function parsePrimary() {
        const token = tokens[pos++];
        if (!token) throw new Error("Unexpected end of query");

        if (token.type === 'LPAREN') {
            const node = parseOr();
            if (!tokens[pos] || tokens[pos].type !== 'RPAREN') throw new Error("Missing )");
            pos++;
            return node;
        }
        if (token.type === 'OPERATOR' && token.val === 'NOT') {
            return { type: 'NOT', operand: parsePrimary() };
        }
        return token;
    }

    return parseOr();
}

function evaluate(node, m, comparisonSelected) {
    if (!node) return false;

    switch (node.type) {
        case 'AND': return evaluate(node.left, m, comparisonSelected) && evaluate(node.right, m, comparisonSelected);
        case 'OR': return evaluate(node.left, m, comparisonSelected) || evaluate(node.right, m, comparisonSelected);
        case 'NOT': return !evaluate(node.operand, m, comparisonSelected);
        case 'FIELD':
            const val = (node.val || '').toLowerCase();
            switch (node.field) {
                case 'name': 
                    return (m.name || '').toString().toLowerCase().includes(val);
                case 'date': 
                    return (m.date || '').toString().includes(val);
                case 'serial': 
                    return (m.serial_id || '').toString().toLowerCase().includes(val);
                case 'is':
                    if (val === 'plot' || val === 'selected') return comparisonSelected.has(m.name);
                    if (val === 'draft') return !!m.is_draft;
                    return false;
            }
            return false;
        case 'VALUE':
            const v = (node.val || '').toLowerCase();
            const name = (m.name || '').toString().toLowerCase();
            const date = (m.date || '').toString();
            const serial = (m.serial_id || '').toString().toLowerCase();
            return name.includes(v) || date.includes(v) || serial.includes(v);
        default: return false;
    }
}
