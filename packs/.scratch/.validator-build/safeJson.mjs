const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
export function parseStrictJson(source, options = {}) {
    const maxBytes = options.maxBytes ?? 1_000_000;
    const maxDepth = options.maxDepth ?? 24;
    if (new TextEncoder().encode(source).byteLength > maxBytes)
        throw new Error(`JSON exceeds the ${maxBytes} byte limit.`);
    scan(source, maxDepth);
    return JSON.parse(source);
}
function scan(source, maxDepth) {
    let index = 0;
    const whitespace = () => { while (/\s/u.test(source[index] ?? ""))
        index += 1; };
    function readString() {
        if (source[index] !== '"')
            throw new Error("Malformed JSON string.");
        const start = index++;
        while (index < source.length) {
            const char = source[index++];
            if (char === '"')
                return JSON.parse(source.slice(start, index));
            if (char === "\\")
                index += 1;
            else if (char < " ")
                throw new Error("Malformed JSON string.");
        }
        throw new Error("Unterminated JSON string.");
    }
    function readValue(depth) {
        if (depth > maxDepth)
            throw new Error(`JSON nesting exceeds ${maxDepth} levels.`);
        whitespace();
        const char = source[index];
        if (char === "{")
            return readObject(depth + 1);
        if (char === "[")
            return readArray(depth + 1);
        if (char === '"') {
            readString();
            return;
        }
        const token = source.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0];
        if (!token)
            throw new Error("Malformed JSON value.");
        index += token.length;
    }
    function readObject(depth) {
        index += 1;
        whitespace();
        const keys = new Set();
        if (source[index] === "}") {
            index += 1;
            return;
        }
        while (true) {
            whitespace();
            const key = readString();
            if (DANGEROUS_KEYS.has(key))
                throw new Error(`Dangerous JSON key: ${key}.`);
            if (keys.has(key))
                throw new Error(`Duplicate JSON key: ${key}.`);
            keys.add(key);
            whitespace();
            if (source[index++] !== ":")
                throw new Error("Malformed JSON object.");
            readValue(depth);
            whitespace();
            if (source[index] === "}") {
                index += 1;
                return;
            }
            if (source[index++] !== ",")
                throw new Error("Malformed JSON object.");
        }
    }
    function readArray(depth) {
        index += 1;
        whitespace();
        if (source[index] === "]") {
            index += 1;
            return;
        }
        while (true) {
            readValue(depth);
            whitespace();
            if (source[index] === "]") {
                index += 1;
                return;
            }
            if (source[index++] !== ",")
                throw new Error("Malformed JSON array.");
        }
    }
    readValue(0);
    whitespace();
    if (index !== source.length)
        throw new Error("Mixed content is not valid JSON.");
}
