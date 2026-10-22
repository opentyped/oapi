import ts from 'typescript';
import { moduleSymbols } from '@opentyped/oapi-ast/module';
import { validateJson } from '@opentyped/oapi-openapi/json';
import { explicitSchema } from '@opentyped/oapi-openapi/schema/validation';
import type { Schema, TypeMapping } from '~/definition';

/** Match exported declaration identity, never structural assignability or a class name. */
export class TypeMappings {
  private readonly schemas = new Map<ts.Symbol, Schema>();

  constructor(program: ts.Program, mappings: readonly TypeMapping[] = [], root: string) {
    if (!Array.isArray(mappings)) throw new Error('typeMappings must be an array.');
    const checker = program.getTypeChecker();
    for (const [index, mapping] of mappings.entries()) {
      const label = `typeMappings[${index}]`;
      if (
        !mapping?.match ||
        typeof mapping.match.module !== 'string' ||
        !mapping.match.module.trim() ||
        typeof mapping.match.export !== 'string' ||
        !mapping.match.export.trim()
      )
        throw new Error(`${label} requires match.module and match.export.`);
      const symbols = moduleSymbols(program, mapping.match.module, root).map((module) =>
        checker.getExportsOfModule(module).find((symbol) => symbol.name === mapping.match.export),
      );
      if (!symbols.length || symbols.some((symbol) => !symbol))
        throw new Error(
          `${label}: Export '${mapping.match.export}' from '${mapping.match.module}' was not found in the checked TypeScript program.`,
        );
      validateJson(mapping.schema, `${label}.schema`);
      const schema = explicitSchema(
        structuredClone(mapping.schema),
        {},
        {
          location: label,
          fail(message): never {
            throw new Error(`${label}: ${message}`);
          },
        },
        'document',
      );
      const targets = new Set(
        symbols
          .filter((symbol) => symbol !== undefined)
          .map((symbol) =>
            symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol,
          ),
      );
      for (const symbol of targets) {
        if (!(symbol.flags & ts.SymbolFlags.Type))
          throw new Error(`${label} must select an exported type.`);
        const type = checker.getDeclaredTypeOfSymbol(symbol);
        if (type.aliasSymbol !== symbol && type.getSymbol() !== symbol)
          throw new Error(
            `${label}: The exported type has no retained declaration identity. Map its underlying class/interface instead.`,
          );
        if (this.schemas.has(symbol))
          throw new Error(`${label} overlaps another mapping for the same exported type.`);
        this.schemas.set(symbol, schema);
      }
    }
  }

  has(type: ts.Type): boolean {
    return this.find(type) !== undefined;
  }

  schema(type: ts.Type): Schema | undefined {
    const schema = this.find(type);
    return schema === undefined ? undefined : structuredClone(schema);
  }

  private find(type: ts.Type): Schema | undefined {
    if (!this.schemas.size) return;
    // A constructor value is not an instance of the class being serialized.
    const owner = type.getSymbol();
    if (type.getConstructSignatures().length && owner && owner.flags & ts.SymbolFlags.Class) return;
    for (const symbol of [type.aliasSymbol, type.getSymbol()]) {
      if (symbol && this.schemas.has(symbol)) return this.schemas.get(symbol);
    }
    if (
      type.aliasSymbol?.name === 'Readonly' &&
      type.aliasSymbol.declarations?.every((node) => node.getSourceFile().hasNoDefaultLib)
    ) {
      const value = type.aliasTypeArguments?.[0];
      if (value) return this.find(value);
    }
    return undefined;
  }
}
