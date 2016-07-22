# json-schema-default-instance [![Build Status](https://travis-ci.org/dancasey/json-schema-default-instance.svg?branch=master)](https://travis-ci.org/dancasey/json-schema-default-instance)

Creates an object as an instance of the given schema using its `default` properties.

- Ignores properties that are not listed in the `required` array.
- Accepts multiple schemas, referenced by `id`.
- Resolves `$ref` and `allOf`.


## Usage

Install with `npm install --save json-schema-default-instance`

See `test/test.js` for an example with `$ref` and `allOf`.

Simple example below:

```js
const {Instantiator} = require('json-schema-default-instance');
const mySchemas = [
  {
    "$schema": "http://json-schema.org/draft-04/schema#",
    "id": "theSchemaId",
    "type": "object",
    "required": [
      "firstName",
      "lastName"
    ],
    "properties": {
      "firstName": {
        "type": "string",
        "default": "Foo"
      },
      "lastName": {
        "type": "string",
        "default": "Bar"
      },
      "IgnoredProperty": {
        "type": "string",
        "default": "Hello"
      }
    }
  }
]
let ins = new Instantiator(mySchemas);
let myDefaultInstance = ins.instantiate('theSchemaId');
console.log(myDefaultInstance);

// => { firstName: 'Foo', lastName: 'Bar' }
```


## Notes

Relies heavily on `Ajv` for caching and lookup by ref, even though no validation is done here: [Ajv: Another JSON Schema Validator](https://github.com/epoberezkin/ajv)


## License

Public Domain