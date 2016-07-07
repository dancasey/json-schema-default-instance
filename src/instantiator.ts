import * as _ from 'lodash';
import * as Ajv from 'ajv';

let ajv = Ajv({verbose: true});
const splitRef = /^(\w+.json)#?\/?(\w+)?/;

/**
 * Used to instantiate default objects from schemas.
 *
 * @param {Object|Object[]} schemata  JSON Schema or array of schemas to load and cache
 */
export class Instantiator {
  constructor(private schemata: Object | Object[]) {
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
    return this.recursiveInstantiate(schema);
  }

  private recursiveInstantiate(schema: Object): any {
    // if there's a `$ref`, `omit` ref part, resolve it, and merge into `withoutRef`
    if (_.has(schema, '$ref')) {
      let withoutRef = _.omit(schema, '$ref');
      let [fullRef, jsonRef, idRef] = splitRef.exec(schema['$ref']);
      let resolved = ajv.getSchema(jsonRef).schema[idRef];
      let result = _.merge(withoutRef, resolved);
      return this.recursiveInstantiate(result);
    }
    // if there's `type`, switch on it
    else if (_.has(schema, 'type')) {
      switch (schema['type']) {
        // if object, recurse into each `required` property
        case 'object':
          let result = {}
          if (_.has(schema, 'required')) {
            let r = schema['required'];
            for (let i = 0; i < r.length; i++) {
              let property = r[i];
              result[property] = this.recursiveInstantiate(schema['properties'][property]);
            }
          }
          return result;
        // if integer, array, or string, return `default` value
        case 'integer':
        case 'array':
        case 'string':
          if (_.has(schema, 'default')) {
            return schema['default'];
          }
          else return null;
        default:
          return null;
      }
    }
    // if there's `allOf`, `merge` each item in list into new object
    else if (_.has(schema, 'allOf')) {
      let allOfMerged = _.assign({}, ...schema['allOf']);
      return this.recursiveInstantiate(allOfMerged);
    }
  }
}

