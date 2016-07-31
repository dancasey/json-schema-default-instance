/* run with `npm test` */
import {Instantiator} from './instantiator';
import test from 'ava';

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
        $ref: '#/text',
        default: 'No Name',
      },
      desc: {
        $ref: '#/text',
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
};

const defaultAddress = {
  street_address: '100 Main Street',
  city: 'New York',
  state: 'NY',
};

let schemata = [definitionSchema, messageSchema, internalSchema];
let ins = new Instantiator(schemata);

test('Constructor returns a new instance', t => {
  t.truthy(ins instanceof Instantiator);
});

test('Instantiate correctly instantiates defaults (externally-referenced schema)', t => {
  const extMessage = ins.instantiate('message.json');
  t.deepEqual(extMessage, { header: { version: 2, type: 0, length: 8, title: 'No Name', desc: '' } } as any);
});

test('Instantiate correctly instantiates defaults (internally-referenced schema)', t => {
  const intMessage = ins.instantiate('internalSchema');
  t.deepEqual(intMessage, { billing_address: defaultAddress, shipping_address: defaultAddress } as any);
});

test('Instantiate correctly instantiates defaults (externally-referenced schema, required only)', t => {
  ins.requiredOnly = true;
  const extReqMessage = ins.instantiate('message.json');
  t.deepEqual(extReqMessage, { header: { version: 2, type: 0} } as any);
});
