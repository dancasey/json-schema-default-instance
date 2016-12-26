/* run with `npm test` */
import instantiate from './instantiator';
import test from 'ava';
import * as Ajv from 'ajv';

const ajv = Ajv({ verbose: true });

const definitionSchema = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  description: 'Definitions',
  id: 'definitions.json',
  data: {
    description: 'Arbitrary data as hex string',
    type: 'string',
    pattern: '^([a-fA-F0-9]{2})+$',
  },
  header: {
    description: 'Header',
    type: 'object',
    properties: {
      version: {
        type: 'integer',
        minimum: 1,
        maximum: 255,
        default: 2,
      },
      type: {
        description: 'Index',
        type: 'integer',
        minimum: 0,
        maximum: 20,
      },
      length: {
        description: 'Length in bytes',
        type: 'integer',
        minimum: 8,
        maximum: 65535,
        default: 8,
      },
      title: {
        allOf: [{
          $ref: '#/text'
        }],
        default: 'No Name',
      },
      desc: {
        $ref: '#/text',
      },
      obj: {
        type: 'object',
        default: {
          objProp: 'text',
        },
      },
    },
    required: [
      'version',
      'type',
    ],
  },
  text: {
    type: 'string',
    default: '',
  },
};

const messageSchema = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  description: 'Message',
  id: 'message.json',
  type: 'object',
  required: [
    'header',
  ],
  properties: {
    header: {
      allOf: [
        {
          $ref: 'definitions.json#/header',
        },
        {
          properties: {
            type: {
              enum: [
                0,
              ],
              default: 0,
            },
          },
        },
      ],
    },
  },
};

const defaultRefSchema = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  id: 'defaultRef.json',
  type: 'object',
  required: ['prop'],
  properties: {
    prop: {
      type: 'object',
      default: {
        $ref: '#/definitions/prop',
        innerProp2: {
          $ref: '#/definitions/innerProp',
        },
      },
    },
  },
  definitions: {
    prop: {
      type: 'object',
      default: {
        innerProp1: 'text',
      },
    },
    innerProp: {
      type: 'string',
      default: 'text',
    },
  },
};

// example from https://spacetelescope.github.io/understanding-json-schema/structuring.html
const internalSchema = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  id: 'internalSchema',
  definitions: {
    address: {
      type: 'object',
      properties: {
        street_address: { type: 'string', default: '100 Main Street' },
        city: { type: 'string', default: 'New York' },
        state: { type: 'string', default: 'NY' },
      },
      required: ['street_address', 'city', 'state'],
    },
  },
  type: 'object',
  properties: {
    billing_address: { $ref: '#/definitions/address' },
    shipping_address: { $ref: '#/definitions/address' },
  },
  required: ['billing_address', 'shipping_address']
};

const defaultAddress = {
  street_address: '100 Main Street',
  city: 'New York',
  state: 'NY',
};

ajv.addSchema([definitionSchema, messageSchema, internalSchema, defaultRefSchema]);
let ins = instantiate({ ajv });

test('Object defaults resolve correctly', t => {
  ajv.addSchema({
    id: 'object-defaults.json',
    type: 'object',
    properties: {
      prop: {
        type: 'integer'
      }
    },
    default: {
      prop: 1
    }
  });

  t.deepEqual(ins('object-defaults.json'), { prop: 1 } as any);
});

test('Object property defaults resolve correctly', t => {
  ajv.addSchema({
    id: 'object-prop-defaults.json',
    type: 'object',
    properties: {
      prop: {
        type: 'integer',
        default: 1
      }
    }
  });

  t.deepEqual(ins('object-prop-defaults.json'), { prop: 1 } as any);
});

test('Non-required external defaults resolve correctly', t => {
  ajv.addSchema({
    id: 'non-req-ext-defaults.json',
    type: 'object',
    properties: {
      prop: {
        $ref: '#/definitions/prop'
      }
    },
    definitions: {
      prop: {
        type: 'integer',
        default: 1
      }
    }
  });

  t.deepEqual(ins('non-req-ext-defaults.json'), { } as any);
});

test('Required external defaults resolve correctly', t => {
  ajv.addSchema({
    id: 'req-ext-defaults.json',
    type: 'object',
    properties: {
      prop: {
        $ref: '#/definitions/prop'
      }
    },
    required: ['prop'],
    definitions: {
      prop: {
        type: 'integer',
        default: 1
      }
    }
  });

  t.deepEqual(ins('req-ext-defaults.json'), { prop: 1 } as any);
});

test('Object default overrides property defaults', t => {
  ajv.addSchema({
    id: 'override-defaults.json',
    type: 'object',
    properties: {
      prop1: {
        type: 'integer',
        default: 11
      },
      prop2: {
        type: 'integer',
        default: 111
      }
    },
    default: {
      prop1: 1
    }
  });

  t.deepEqual(ins('override-defaults.json'), { prop1: 1 } as any);
});

test('Instantiate correctly instantiates defaults (externally-referenced schema)', t => {
  const extMessage = ins('message.json');
  t.deepEqual(extMessage, {
    header: { version: 2, type: 0, length: 8, title: 'No Name', obj: { objProp: 'text' } },
  } as any);
});

test('Instantiate correctly instantiates defaults (internally-referenced schema)', t => {
  const intMessage = ins('internalSchema');
  t.deepEqual(intMessage, { billing_address: defaultAddress, shipping_address: defaultAddress } as any);
});

test('Instantiate resolves refs in default', t => {
  let defaultRef = instantiate({ ajv, resolveDefaultRefs: false }, 'defaultRef.json');
  t.deepEqual(defaultRef, { prop: defaultRefSchema.properties.prop.default } as any);

  defaultRef = instantiate({ ajv, resolveDefaultRefs: true }, 'defaultRef.json');
  t.deepEqual(defaultRef, { prop: { innerProp1: 'text', innerProp2: 'text' } } as any);
});
