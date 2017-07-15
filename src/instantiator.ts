import * as _ from 'lodash';
import { resolve } from 'url';

export interface Options {
  ajv?: any,
  resolveDefaultRefs?: Boolean
}

export interface Schema {
  id: String
}

export interface InstantiateResult {
  hasResult: Boolean,
  result?: any,
  error?: string
}

const defaultOptions: Options = {
  resolveDefaultRefs: false
};

function deepMap(obj: any, iterator: Function) {
  return _.transform(obj, (result, val: any, key) => {
    const newVal = iterator(val, key, obj);
    result[key] = (_.isObject(val) && val === newVal) ?
      deepMap(newVal, iterator) : newVal;
  });
}

function defaultLiteralValue(type: string): any {
  switch(type) {
  case 'array':
    return [];
  case 'string':
    return '';
  case 'integer':
  case 'number':
    return 0;
  case 'boolean':
    return false;
  case 'null':
    return null;
  }
}

function resolveRef(id: string, schema: Object, options: Options): InstantiateResult {
  let withoutRef = _.omit(schema, '$ref');

  let { schemaId = id, path } = parseRef(schema['$ref']);
  // schemaId = resolve(id, schemaId);
  let validateFunction = options.ajv.getSchema(schemaId);

  if (!validateFunction) { return { hasResult: false, error: options.ajv.errors }; }

  let resolved = _.get(validateFunction.schema, path.filter(p => p !== undefined), {});
  let result = _.merge({}, resolved, withoutRef);

  return recursiveInstantiate(schemaId, result, options);
}

function maybeResolveRefs(id: string, def: any, options: Options): any {
  if (!options.resolveDefaultRefs || !_.isObject(def)) {
    return def;
  }

  if (Array.isArray(def)) {
    return def.map(val => maybeResolveRefs(id, val, options));
  }

  let result = {};

  if (_.has(def, '$ref')) {
    const { hasResult, result: resolveResult } = resolveRef(id, def, options);
    def = _.omit(def, '$ref');
    if (hasResult) {
      result = resolveResult;
    }
  }

  const rest = deepMap(def, val => (_.has(val, '$ref') ? resolveRef(id, val, options).result : val));

  return _.merge({}, result, rest);
}

function recursiveInstantiate(id: string, schema: Object, options: Options): InstantiateResult {
  if (_.has(schema, 'default')) {
    return {
      hasResult: true,
      result: maybeResolveRefs(id, schema['default'], options)
    };
  }

  if (_.has(schema, '$ref')) {
    return resolveRef(id, schema, options);
  }

  // if there's `allOf`, `merge` each item in list into new object
  if (_.has(schema, 'allOf')) {
    return schema['allOf'].reduce((res, s, idx) => {
      if (!res.hasResult) {
        return res;
      }

      const resolveResult = recursiveInstantiate(id, s, options);

      if (!resolveResult.hasResult) {
        return res;
      }

      if (resolveResult.result === null ||
        typeof resolveResult.result !== 'object' ||
        Array.isArray(resolveResult.result)) {
        return resolveResult;
      }

      return _.assign({}, res, {
        result: _.assign({}, res.result, resolveResult.result)
      });
    }, { hasResult: true, result: {} });
  }

  if (_.has(schema, 'const')) {
    return { hasResult: true, result: schema['const'] };
  }

  if (_.has(schema, 'enum')) {
    return { hasResult: true, result: schema['enum'][0] };
  }

  switch (schema['type']) {
    // if object, recurse into each property
    case 'object':
      let result = {};
      let r: string[];

      if (_.has(schema, 'properties')) {
        r = Object.keys(schema['properties']);
        for (let i = 0; i < r.length; i++) {
          let property = r[i];
          const hasDefault = _.has(schema, ['properties', property, 'default']);
          const hasRequired = _.has(schema, ['required']) &&
            schema['required'].indexOf(property) !== -1;
          if (hasDefault || hasRequired) {
            const { hasResult, result: recursiveResult, error } = recursiveInstantiate(id, schema['properties'][property], options);
            if (hasResult) {
              result[property] = recursiveResult;
            } else {
              return {
                hasResult,
                error
              };
            }
          }
        }
      }

      return {
        hasResult: true,
        result
      };
    // if integer, array, or string, return `default` value
    case 'array':
      const itemsSchema = _.get(schema, 'items');
      if (itemsSchema && !Array.isArray(itemsSchema) && _.has(schema, 'minItems') && schema['minItems'] > 0) {
        const defaultItemResult = recursiveInstantiate(id, schema['items'], options);
        if (defaultItemResult.hasResult) {
          return {
            hasResult: true,
            result: Array.from(Array(schema['minItems'])).map(() => defaultItemResult.result)
          };
        }
      }

      if (itemsSchema && Array.isArray(itemsSchema)) {
        return itemsSchema.reduce((arrayResult, s) => {
          if (!arrayResult.hasResult) {
            return arrayResult;
          }

          const itemResult = recursiveInstantiate(id, s, options);

          if (itemResult.hasResult) {
            return {
              hasResult: true,
              result: [...arrayResult.result, itemResult.result]
            };
          }

          return {
            hasResult: false,
            error: itemResult.error
          };
        }, { hasResult: true, result: [] });
      }

      return {
        hasResult: true,
        result: defaultLiteralValue(schema['type'])
      };

    case 'integer':
    case 'number':
    case 'string':
    case 'boolean':
    case 'null':
      return {
        hasResult: true,
        result: defaultLiteralValue(schema['type'])
      };
    default:
      return {
        hasResult: false,
        error: `Unknown type: ${schema['type']}`
      };
  }
}

function buildRef(baseSchemaId: string, schema: any, path: string[]): string {
  const { schemaId } = parseRef(schema.$ref);

  const refPath = path.length ? `/${path.join('/')}` : '';

  return schemaId ? `${schema.$ref}${refPath}` : `${baseSchemaId}${schema.$ref}${refPath}`;
}

function schemaHasProperRef(schema: any, nextProp: string): boolean {
  return _.has(schema, '$ref') && !_.has(schema, nextProp);
}

export function normalizeSchemaRef(schemaRef: string, options: Options): string {
  let { schemaId = schemaRef, path } = parseRef(schemaRef);

  let validateFunction = options.ajv.getSchema(schemaId);
  if (!validateFunction) {
    return schemaRef;
  }
  let schema = validateFunction.schema;

  if (schemaHasProperRef(schema, path[0])) {
    return normalizeSchemaRef(buildRef(schemaId, schema, path), options);
  }

  for (let i = 0; i < path.length; ++i) {
    schema = schema[path[i]];
    if (schemaHasProperRef(schema, path[i + 1])) {
      return normalizeSchemaRef(buildRef(schemaId, schema, path.slice(i + 1)), options);
    }
  }

  return schemaRef;
}

interface ParseRefResult {
  schemaId?: string,
  path: string[]
}

function parsePath(refPath: string): string[] {
  if (refPath.indexOf('/') === 0) {
    refPath = refPath.substr(1);
  }
  return refPath.split('/').map(prop => prop.replace('~0', '~').replace('~1', '/'));
}

function parseRef(schemaRef: string): ParseRefResult {
  if (schemaRef.indexOf('#') !== -1) {
    const [schemaId, path] = schemaRef.split('#');
    return schemaId ? { schemaId, path: parsePath(path) } : { path: parsePath(path) };
  } else if (schemaRef.indexOf('/') === 0) {
    return { path: parsePath(schemaRef) }
  } else {
    return { schemaId: schemaRef, path: [] };
  }
}

const instantiate = _.curry(function(options: Options, schemaRef: string): InstantiateResult {
  if (!options.ajv) {
    return {
      hasResult: false,
      error: 'options.ajv is required'
    }
  }

  options = _.merge({}, defaultOptions, options);

  schemaRef = normalizeSchemaRef(schemaRef, options);

  const validateFunction = options.ajv.getSchema(schemaRef);
  if (!validateFunction) {
    return {
      hasResult: false,
      error: `schema not found: ${schemaRef}`
    };
  }

  const { schemaId } = parseRef(schemaRef);

  return recursiveInstantiate(schemaId, validateFunction.schema, options);
});

export default instantiate;
