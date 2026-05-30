/**
 * validate-canonical.mjs — compact JSON-Schema (draft-2020-12 subset) validator
 *
 * Self-contained, zero-dependency. Supports the subset the canonical schemas
 * actually use: type, required, properties, additionalProperties:false,
 * patternProperties (none used), items, minItems/maxItems, minimum/maximum,
 * enum, const, oneOf, $ref (#/... within a file AND cross-file "name.json#/...").
 *
 * Used by extract-canonical-data.mjs / verify pass to validate each emitted
 * file against its authored schema in public/schemas/v1/.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function makeValidator(schemaDir) {
  const cache = new Map();
  function loadSchema(file) {
    if (cache.has(file)) return cache.get(file);
    const s = JSON.parse(readFileSync(path.join(schemaDir, file), 'utf8'));
    cache.set(file, s);
    return s;
  }
  function resolveRef(ref, currentFile) {
    let file = currentFile, pointer = ref;
    if (!ref.startsWith('#')) {
      const [f, frag] = ref.split('#');
      file = f;
      pointer = '#' + (frag || '');
    }
    const root = loadSchema(file);
    let node = root;
    const parts = pointer.replace(/^#\//, '').split('/').filter(Boolean);
    for (const p of parts) node = node[decodeURIComponent(p)];
    return { node, file };
  }

  function validate(schema, data, ctx, file, errs) {
    if (schema.$ref) {
      const { node, file: f } = resolveRef(schema.$ref, file);
      return validate(node, data, ctx, f, errs);
    }
    if (schema.oneOf) {
      const matches = schema.oneOf.filter(s => {
        const sub = [];
        validate(s, data, ctx, file, sub);
        return sub.length === 0;
      });
      if (matches.length !== 1) errs.push(`${ctx}: oneOf matched ${matches.length} (expected 1)`);
      return;
    }
    if (schema.const !== undefined && data !== schema.const) {
      errs.push(`${ctx}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);
    }
    if (schema.enum && !schema.enum.includes(data)) {
      errs.push(`${ctx}: ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`);
    }
    const t = schema.type;
    if (t) {
      const ok =
        (t === 'object' && data && typeof data === 'object' && !Array.isArray(data)) ||
        (t === 'array' && Array.isArray(data)) ||
        (t === 'string' && typeof data === 'string') ||
        (t === 'number' && typeof data === 'number') ||
        (t === 'integer' && Number.isInteger(data)) ||
        (t === 'boolean' && typeof data === 'boolean') ||
        (t === 'null' && data === null);
      if (!ok) { errs.push(`${ctx}: expected type ${t}, got ${Array.isArray(data) ? 'array' : typeof data}`); return; }
    }
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) errs.push(`${ctx}: ${data} < minimum ${schema.minimum}`);
      if (schema.maximum !== undefined && data > schema.maximum) errs.push(`${ctx}: ${data} > maximum ${schema.maximum}`);
    }
    if (typeof data === 'string' && schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errs.push(`${ctx}: '${data}' fails pattern ${schema.pattern}`);
    }
    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) errs.push(`${ctx}: length ${data.length} < minItems ${schema.minItems}`);
      if (schema.maxItems !== undefined && data.length > schema.maxItems) errs.push(`${ctx}: length ${data.length} > maxItems ${schema.maxItems}`);
      if (schema.items) data.forEach((v, i) => validate(schema.items, v, `${ctx}[${i}]`, file, errs));
    }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (schema.required) for (const r of schema.required) if (!(r in data)) errs.push(`${ctx}: missing required '${r}'`);
      const props = schema.properties || {};
      for (const [k, v] of Object.entries(data)) {
        if (props[k]) validate(props[k], v, `${ctx}.${k}`, file, errs);
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          validate(schema.additionalProperties, v, `${ctx}.${k}`, file, errs);
        } else if (schema.additionalProperties === false) {
          errs.push(`${ctx}: unknown property '${k}' (additionalProperties:false)`);
        }
      }
    }
  }

  return function validateFile(schemaFile, data) {
    const errs = [];
    validate(loadSchema(schemaFile), data, '$', schemaFile, errs);
    return errs;
  };
}
