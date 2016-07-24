/* run with `npm test` */
import { Instantiator } from '../dist/instantiator';
import { expect } from 'chai';

const definitionSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "description": "Definitions",
  "id": "definitions.json",
  "data": {
    "description": "Arbitrary data as hex string",
    "type": "string",
    "pattern": "^([a-fA-F0-9]{2})+$"
  },
  "header": {
    "description": "Header",
    "type": "object",
    "properties": {
      "version": {
        "type": "integer",
        "minimum": 1,
        "maximum": 255,
        "default": 2
      },
      "type": {
        "description": "Index",
        "type": "integer",
        "minimum": 0,
        "maximum": 20
      },
      "length": {
        "description": "Length in bytes",
        "type": "integer",
        "minimum": 8,
        "maximum": 65535,
        "default": 8
      },
      "title": {
        "$ref": "#/text",
        "default": "No Name"
      },
      "desc": {
        "$ref": "#/text"
      }
    },
    "required": [
      "version",
      "type",
      "length",
      "title",
      "desc"
    ]
  },
  "text": {
    "type": "string",
    "default": ""
  }
}

const messageSchema = {
  "$schema": "http://json-schema.org/draft-04/schema#",
  "description": "Message",
  "id": "message.json",
  "type": "object",
  "required": [
    "header"
  ],
  "properties": {
    "header": {
      "allOf": [
        {
          "$ref": "definitions.json#/header"
        },
        {
          "properties": {
            "type": {
              "enum": [
                0
              ],
              "default": 0
            }
          }
        }
      ]
    }
  }
}

const schemata = [definitionSchema, messageSchema]
const ins = new Instantiator(schemata);

/** @test {Instantiator} */
describe('Instantiator', function(){
  /** @test {Instantiator#constructor} */
  describe('Constructor', function(){
    it('Should take schemata and return a new instance', function() {
      expect(ins).to.be.instanceof(Instantiator);
    })
  })
  /** @test {Instantiator#instantiate} */
  describe('instantiate', function(){
    it('Should correctly instantiate defaults', function(){
      const myMessage = ins.instantiate('message.json');
      expect(myMessage).to.deep.equal({ header: { version: 2, type: 0, length: 8, title: 'No Name', desc: '' } });
    })
  })
})
