import { SchemaDiscovery } from '@typedapi/compiler/parser/schema/discovery';
import { JSDocEndpointParser } from '@typedapi/compiler/parser/endpoint/parser';
import { DocumentParser } from '@typedapi/compiler/parser/document/parser';
import { SchemaSafety, SchemaCompiler } from '@typedapi/compiler/parser/schema/steps';
import { DocumentEmitter } from '@typedapi/compiler/parser/document/emitter';
import type { Parser } from '@typedapi/compiler/parser/parser';

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
