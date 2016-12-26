import * as _ from 'lodash';
import { resolve } from 'url';

export interface Options {
  ajv?: any,
  resolveDefaultRefs?: Boolean
}

export interface Schema {
  id: String
}

interface InstantiateResult {
  hasValue: Boolean,
  value?: any
}

const defaultOptions: Options = {
  resolveDefaultRefs: false
};

/** Split a `$ref` into its relevant parts */
const splitRef = /^([\w+_./:-]+)?(?:#)?\/?((?:[^/]|~0|~1)+)\/?((?:[^/]|~0|~1)+)?\/?((?:[^/]|~0|~1)+)?\/?((?:[^/]|~0|~1)+)?\/?((?:[^/]|~0|~1)+)?\/?((?:[^/]|~0|~1)+)?/;

function deepMap(obj: any, iterator: Function) {
  return _.transform(obj, (result, val: any, key) => {
    const newVal = iterator(val, key, obj);
    result[key] = (_.isObject(val) && val === newVal) ?
      deepMap(newVal, iterator) : newVal;
  });
}

function defaultLiteralValue(type: string): any {
  switch(type) {
  case 'string':
    return '';
  case 'integer':
  case 'number':
    return 0;
  case 'boolean':
    return false;
  case 'null':
    return null;
  case 'undefined':
    return undefined;
  }
}

function resolveRef(id: string, schema: Object, options: Options): InstantiateResult {
  let withoutRef = _.omit(schema, '$ref');
  let refs = splitRef.exec(schema['$ref']);

  if (!refs) { return { hasValue: false }; }

  let [, jsonRef = id, ...path] = refs;
  // resolve up to three levels, e.g. `definitions.json#/section/item`, or `#/section/item`, or just `item`
  jsonRef = resolve(id, jsonRef);
  let validateFunction = options.ajv.getSchema(jsonRef);

  if (!validateFunction) { return { hasValue: false }; }

  let resolved = _.get(validateFunction.schema, path.filter(p => p !== undefined), {});
  let result = _.merge({}, resolved, withoutRef);

  return recursiveInstantiate(jsonRef, result, options);
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
    const { hasValue, value } = resolveRef(id, def, options);
    def = _.omit(def, '$ref');
    if (hasValue) {
      result = value;
    }
  }

  const rest = deepMap(def, val => (_.has(val, '$ref') ? resolveRef(id, val, options).value : val));

  return _.merge({}, result, rest);
}

function recursiveInstantiate(id: string, schema: Object, options: Options): InstantiateResult {
  if (_.has(schema, 'default')) {
    return {
      hasValue: true,
      value: maybeResolveRefs(id, schema['default'], options)
    };
  }

  if (_.has(schema, '$ref')) {
    return resolveRef(id, schema, options);
  }

  // if there's `allOf`, `merge` each item in list into new object
  if (_.has(schema, 'allOf')) {
    return {
      hasValue: true,
      value: _.assign({}, ...schema['allOf'].map(s =>
        recursiveInstantiate(id, s, options).value
      ))
    };
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
            const { hasValue, value } = recursiveInstantiate(id, schema['properties'][property], options);
            if (hasValue) {
              result[property] = value;
            }
          }
        }
      }

      return {
        hasValue: true,
        value: result
      };
    // if integer, array, or string, return `default` value
    case 'integer':
    case 'array':
    case 'string':
    case 'boolean':
    case 'null':
    case 'undefined':
      return {
        hasValue: true,
        value: defaultLiteralValue(schema['type'])
      };
    default:
      return {
        hasValue: false
      };
  }
}

const instantiate = _.curry(function(options: Options, id: string): Object {
  if (!options.ajv) {
    throw Error('options.ajv is required');
  }

  options = _.merge({}, defaultOptions, options);

  const schema = options.ajv.getSchema(id).schema;
  if (!schema) {
    return {};
  }

  return recursiveInstantiate(id, schema, options).value;
});

export default instantiate;
