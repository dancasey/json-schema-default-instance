# json-schema-default-instance

[![Build Status](https://travis-ci.org/dancasey/json-schema-default-instance.svg?branch=master)](https://travis-ci.org/dancasey/json-schema-default-instance)

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

Relies heavily on `Ajv` for caching and lookup by ref, even though no validation is done here.
[Ajv: Another JSON Schema Validator](https://github.com/epoberezkin/ajv)

`Ajv` *does* have its own `useDefaults` option which can be used instead of this package,
but it does not support `default` keywords in subschemas or `allOf`.
If you don't need `allOf`, just use `Ajv` directly (see [Ajv assigning-defaults](https://github.com/epoberezkin/ajv#assigning-defaults) and related [discussion](https://github.com/epoberezkin/ajv/issues/42)).

Need help understanding JSON Schema? I would recommend the Space Telescope Science Institute's [Understanding JSON Schema](https://spacetelescope.github.io/understanding-json-schema/index.html)


## License

Public Domain