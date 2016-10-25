import * as _ from 'lodash';
import * as Ajv from 'ajv';
import {resolve} from 'url';

let ajv = Ajv({verbose: true});

/** Split a `$ref` into its relevant parts */
const splitRef = /^(\w+.json)?(?:#)?\/?(\w+)\/?(\w+)?/;

/**
 * Used to instantiate default objects from schemas.
 *
 * @param {Object|Object[]} schemata  JSON Schema or array of schemas to load and cache
 * @param {boolean} [onlyRequired=false] Whether to instantiate only those properties in the `required` array
 */
export class Instantiator {
  constructor(private schemata: Object | Object[], public requiredOnly = false) {
    ajv.addSchema(schemata);
  }

  /**
   * Creates an object as an instance of the given schema using its `default` properties.
   *
   * @param {string} id  The `id` of the object in `schema` to instantiate
   * @return {Object} Instantiated default object
   */
  public instantiate(id: string): Object {
    const schema = ajv.getSchema(id).schema;
    if (!schema) {
      return {};
    }
    return this.recursiveInstantiate(id, schema);
  }

  private recursiveInstantiate(id: string, schema: Object): any {
    // if there's a `$ref`, `omit` ref part, resolve it, and merge into `withoutRef`
    if (_.has(schema, '$ref')) {
      let withoutRef = _.omit(schema, '$ref');
      // let [fullRef, first, second, third] = splitRef.exec(schema['$ref']);
      let refs = splitRef.exec(schema['$ref']);
      if (!refs) { return; }
      // tslint:disable-next-line:no-unused-variable
      let [fullRef, jsonRef = id, first, second] = refs;
      // resolve up to three levels, e.g. `definitions.json#/section/item`, or `#/section/item`, or just `item`
      jsonRef = resolve(id, jsonRef);
      let validateFunction = ajv.getSchema(jsonRef);
      if (!validateFunction) { return; }
      let resolved = validateFunction.schema;
      if (first && resolved) {
        resolved = resolved[first];
        if (second && resolved) {
          resolved = resolved[second];
        }
      }
      let result = _.merge({}, resolved, withoutRef);
      return this.recursiveInstantiate(jsonRef, result);
    }

    // if there's `type`, switch on it
    if (_.has(schema, 'type')) {
      switch (schema['type']) {
        // if object, recurse into each property
        case 'object':
          let result = {};
          let r: string[];
          if (this.requiredOnly && _.has(schema, 'required')) {
            r = schema['required'];
            for (let i = 0; i < r.length; i++) {
              let property = r[i];
              result[property] = this.recursiveInstantiate(id, schema['properties'][property]);
            }
          } else if (!this.requiredOnly && _.has(schema, 'properties')) {
            r = Object.keys(schema['properties']);
            for (let i = 0; i < r.length; i++) {
              let property = r[i];
              result[property] = this.recursiveInstantiate(id, schema['properties'][property]);
            }
          }
          return result;
        // if integer, array, or string, return `default` value
        case 'integer':
        case 'array':
        case 'string':
          if (_.has(schema, 'default')) {
            return schema['default'];
          } else {
            return null;
          }
        default:
          return null;
      }
    }

    // if there's `allOf`, `merge` each item in list into new object
    if (_.has(schema, 'allOf')) {
      let allOfMerged = _.assign({}, ...schema['allOf']);
      return this.recursiveInstantiate(id, allOfMerged);
    }
  }
}
