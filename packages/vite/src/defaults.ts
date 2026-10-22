import { SchemaDiscovery } from '@opentyped/compiler/parser/schema/discovery';
import { JSDocEndpointParser } from '@opentyped/compiler/parser/endpoint/parser';
import { DocumentParser } from '@opentyped/compiler/parser/document/parser';
import { SchemaSafety, SchemaCompiler } from '@opentyped/compiler/parser/schema/steps';
import { DocumentEmitter } from '@opentyped/compiler/parser/document/emitter';
import type { Parser } from '@opentyped/compiler/parser/parser';

export function defaultParsers(): Parser[] {
  return [
    new SchemaDiscovery(),
    new JSDocEndpointParser(),
    new DocumentParser(),
    new SchemaSafety(),
    new SchemaCompiler(),
    new DocumentEmitter(),
  ];
}
