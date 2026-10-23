/**
 * mini-schema.mjs — a dependency-free JSON Schema (draft 2020-12 subset) validator.
 *
 * The repo deliberately ships NO ajv in either runtime. This file is the CLI's
 * one validator (moved from scripts/lib/ into lib/ on 2026-10-09 so the
 * published package can validate framework documents at runtime). Its Python
 * twin, arena/mt_eval_harness/framework/mini_schema.py, produces the SAME
 * error strings; both are held to shared/test-fixtures/framework/
 * schema-vectors.json, so the two runtimes cannot judge one document
 * differently. (mt-eval-arena/scripts/lib/mini-schema.mjs is an older,
 * separate copy for that package's scripts.)
 *
 * It covers exactly the constructs our schemas use: type (incl. arrays-of-types
 * and null), required, enum, pattern, properties, patternProperties,
 * additionalProperties:false, items, $ref ("#/$defs/..."), minimum/maximum,
 * minLength, minItems/maxItems, oneOf. It is NOT a general-purpose validator —
 * it is deliberately small and auditable.
 *
 * validate(data, schema) -> { valid: boolean, errors: string[] }
 */

function typeOf(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer"; // integer is a sub-type of number
  return typeof value; // "string" | "number" | "boolean" | "object" | "undefined"
}

function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === "number") return actual === "number" || actual === "integer";
  if (type === "integer") return actual === "integer";
  return actual === type;
}

function resolveRef(ref, root) {
  // Only local "#/a/b/c" refs are supported.
  if (!ref.startsWith("#/")) {
    throw new Error(`mini-schema: unsupported $ref '${ref}' (only local #/ refs)`);
  }
  let node = root;
  for (const seg of ref.slice(2).split("/")) {
    node = node?.[seg];
    if (node === undefined) throw new Error(`mini-schema: unresolved $ref '${ref}'`);
  }
  return node;
}

function validateNode(value, schema, root, path, errors) {
  if (schema.$ref) {
    return validateNode(value, resolveRef(schema.$ref, root), root, path, errors);
  }

  // oneOf: exactly one branch must validate (branch errors are not reported
  // individually — only the count of matching branches).
  if (schema.oneOf !== undefined) {
    const matches = schema.oneOf.filter((branch) => {
      const branchErrors = [];
      validateNode(value, branch, root, path, branchErrors);
      return branchErrors.length === 0;
    }).length;
    if (matches !== 1) {
      errors.push(`${path}: matches ${matches} oneOf branches, expected exactly 1`);
    }
  }

  // type
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      errors.push(`${path}: expected type ${types.join("|")}, got ${typeOf(value)}`);
      return; // further checks are unreliable once the type is wrong
    }
  }

  // enum (null is a legal enum member)
  if (schema.enum !== undefined && !schema.enum.some((e) => e === value)) {
    errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(schema.enum)}`);
  }

  const kind = typeOf(value);

  if (kind === "string") {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: '${value}' does not match pattern /${schema.pattern}/`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
  }

  if (kind === "number" || kind === "integer") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
    }
  }

  if (kind === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${path}: array shorter than minItems ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${path}: array longer than maxItems ${schema.maxItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, i) => validateNode(item, schema.items, root, `${path}[${i}]`, errors));
    }
  }

  if (kind === "object") {
    for (const req of schema.required || []) {
      if (!(req in value)) errors.push(`${path}: missing required property '${req}'`);
    }
    const props = schema.properties || {};
    const patterns = Object.entries(schema.patternProperties || {})
      .map(([re, sub]) => [new RegExp(re), sub]);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props) && !patterns.some(([re]) => re.test(key))) {
          errors.push(`${path}: unexpected property '${key}'`);
        }
      }
    }
    for (const [key, subSchema] of Object.entries(props)) {
      if (key in value) {
        validateNode(value[key], subSchema, root, `${path}.${key}`, errors);
      }
    }
    for (const key of Object.keys(value)) {
      for (const [re, subSchema] of patterns) {
        if (re.test(key)) validateNode(value[key], subSchema, root, `${path}.${key}`, errors);
      }
    }
  }
}

export function validate(data, schema) {
  const errors = [];
  validateNode(data, schema, schema, "$", errors);
  return { valid: errors.length === 0, errors };
}
