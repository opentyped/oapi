import ts from 'typescript';
import { programDiagnostics } from '@typedapi/ast/project';
import { templatePattern } from '@typedapi/ast/pattern';
import { symbolProperty } from '@typedapi/ast/navigation';
import type {
  Schema,
  SchemaDocument,
  SchemaOptions,
  SchemaRoot,
  SchemaDestination,
  SchemaCompilation,
} from '~/definition';
import { TypeMappings } from '~/mapping';
import { SchemaError } from '~/error';
import { SchemaIdentity } from '~/identity';
import { SchemaContexts } from '~/context';
import type { AnnotationContext } from '~/context';
import type { TypeBindings } from '~/projection';
import { SchemaProjection } from '~/projection';
import { wirePropertyName } from '~/property';
import { schemaOverride, fieldRequired, overrideResolver } from '~/annotation';
import { SchemaProvenance } from '~/provenance';
import { SchemaIntersection } from '~/intersection';
import { schemaCatalog, schemaReference } from '~/destination';
import { inlineDefinitions } from '~/inline';
import { discriminatorDefinitions } from '~/discriminator';

import { SchemaIndexes } from '~/indexes';
import { tupleItem } from '~/tuple';
import type { SchemaEdge } from '~/indexes';

const checkedNamespaces = new WeakSet<ts.SourceFile>();

/** One generation owns its type cache; application modules are never evaluated. */
export class SchemaGenerator {
  private readonly checker: ts.TypeChecker;
  private readonly provenance: SchemaProvenance;
  private readonly mappings: TypeMappings;

  constructor(
    private readonly program: ts.Program,
    private readonly options: SchemaOptions,
  ) {
    const compilerOptions = program.getCompilerOptions();
    if (!(compilerOptions.strictNullChecks ?? compilerOptions.strict)) {
      throw new Error('Schema generation requires strictNullChecks to preserve null and undefined');
    }
    this.checker = program.getTypeChecker();
    this.mappings = new TypeMappings(program, options.typeMappings, options.root);
    this.provenance = new SchemaProvenance(this.checker, this.options.root, (type) =>
      this.mappings.has(type),
    );
  }

  /** Discover only explicitly marked declarations. Re-exports retain declaration identity. */
  discover(): SchemaRoot[] {
    const roots: SchemaRoot[] = [];
    const identity = new SchemaIdentity(
      this.checker,
      this.options.root,
      this.options.namespaces,
      this.options.name,
      this.options.generatedName,
      this.options.namespace,
    );
    for (const source of this.program.getSourceFiles()) {
      if (source.isDeclarationFile || this.program.isSourceFileFromExternalLibrary(source))
        continue;
      const visit = (node: ts.Node): void => {
        if (
          (ts.isInterfaceDeclaration(node) ||
            ts.isTypeAliasDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isEnumDeclaration(node)) &&
          node.name
        ) {
          const symbol = this.checker.getSymbolAtLocation(node.name);
          if (symbol?.getJsDocTags(this.checker).some((tag) => tag.name === 'schema')) {
            const type = this.checker.getTypeAtLocation(node);
            const name = identity.declaration(symbol, node);
            roots.push({ name, type, node });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    return roots;
  }

  generate(roots: readonly SchemaRoot[] = this.discover()): SchemaDocument {
    const result = this.compile(roots, { path: ['$defs'] });
    return { $schema: 'https://json-schema.org/draft/2020-12/schema', $defs: result.definitions };
  }

  compile(roots: readonly SchemaRoot[], destination: SchemaDestination): SchemaCompilation {
    if (
      !Array.isArray(destination.path) ||
      !destination.path.every((token) => typeof token === 'string')
    )
      throw new Error('Schema destination path must contain JSON pointer tokens');
    const diagnostics = programDiagnostics(this.program);
    if (diagnostics.some((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)) {
      throw new Error(
        ts.formatDiagnosticsWithColorAndContext(diagnostics, {
          getCurrentDirectory: () => this.options.root,
          getCanonicalFileName: (file) => file,
          getNewLine: () => '\n',
        }),
      );
    }
    this.checkNamespaces();
    const identities = new SchemaIdentity(
      this.checker,
      this.options.root,
      this.options.namespaces,
      this.options.name,
      this.options.generatedName,
      this.options.namespace,
    );
    const definitions = Object.create(null) as Record<string, Schema>;
    const pending = new Set<string>();
    const definitionOwners = new Map<string, ts.Node>();
    const syntheticNames = new Set<string>();
    const intersection = new SchemaIntersection(
      definitions,
      pending,
      (name, node) => {
        if (definitionOwners.has(name))
          throw new SchemaError(`Intersection schema name '${name}' is already occupied`, node);
        definitionOwners.set(name, node);
        syntheticNames.add(name);
      },
      this.options.maxTypes,
      destination.path,
      this.options.generatedName,
    );
    const materialized = new Set<string>();
    const contexts = new SchemaContexts(this.checker, this.options.root);
    const rootContexts = new Map<SchemaRoot, AnnotationContext>();
    const visiting = new Set<object>();
    const completed = new Map<object, Schema>();
    const recursiveNames = new Map<object, string>();
    const names = new Map<object, string>();
    const maxTypes = this.options.maxTypes ?? 10_000;
    if (!Number.isSafeInteger(maxTypes) || maxTypes < 1) {
      throw new Error('maxTypes must be a positive safe integer');
    }
    const requested = new Map<string, SchemaRoot>();
    for (const root of roots) {
      const context = this.mappings.has(root.type)
        ? contexts.empty
        : contexts.enter(root.type, root.node, contexts.empty);
      rootContexts.set(root, context);
      const previous = requested.get(root.name);
      if (previous && !identities.sameDeclaration(previous.node, root.node))
        throw new SchemaError(`Duplicate root name '${root.name}'`, root.node);
      requested.set(root.name, root);
      definitionOwners.set(root.name, root.node);
      const symbol = root.type.aliasSymbol ?? root.type.getSymbol();
      const builtin = symbol?.declarations?.some((node) => node.getSourceFile().hasNoDefaultLib);
      const declarationSymbol =
        (ts.isInterfaceDeclaration(root.node) ||
          ts.isTypeAliasDeclaration(root.node) ||
          ts.isClassDeclaration(root.node) ||
          ts.isEnumDeclaration(root.node)) &&
        root.node.name
          ? this.checker.getSymbolAtLocation(root.node.name)
          : undefined;
      const ownsType =
        declarationSymbol === symbol || symbol?.name === '__type' || !declarationSymbol;
      const mappedRoot =
        builtin &&
        !!(root.type.flags & ts.TypeFlags.Object) &&
        !!((root.type as ts.ObjectType).objectFlags & ts.ObjectFlags.Mapped);
      if (
        !root.alias &&
        (((root.type.flags & ts.TypeFlags.Object || root.type.aliasSymbol) &&
          !builtin &&
          ownsType) ||
          mappedRoot)
      ) {
        const name =
          mappedRoot && this.override(root.node, context.bindings) === undefined
            ? (this.options.generatedName?.(`${root.name}<mapped>`) ?? `${root.name}<mapped>`)
            : root.name;
        if (name !== root.name && roots.some((requested) => requested.name === name))
          throw new SchemaError(
            `Mapped schema shape name '${name}' conflicts with a requested root`,
            root.node,
          );
        names.set(
          contexts.instance(root.type, context),
          identities.reserve(root.type, name, root.node, context.key),
        );
      }
    }
    const reference = (name: string): Schema => ({
      $ref: schemaReference(name, destination.path),
    });
    const materialize = (schema: Schema, node: ts.Node): Schema => {
      const root = roots.find((root) => !root.alias && identities.sameDeclaration(root.node, node));
      const named =
        (ts.isTypeAliasDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isPropertySignature(node) ||
          ts.isPropertyDeclaration(node) ||
          ts.isVariableDeclaration(node) ||
          ts.isParameter(node)) &&
        node.name;
      const symbol = named ? this.checker.getSymbolAtLocation(named) : undefined;
      if (!root && !symbol) return schema;
      let name = root?.name ?? identities.declaration(symbol!, node);
      if (!root && symbol) {
        const scopes: string[] = [];
        for (let parent = node.parent; parent; parent = parent.parent)
          if (
            (ts.isTypeAliasDeclaration(parent) ||
              ts.isInterfaceDeclaration(parent) ||
              ts.isClassDeclaration(parent)) &&
            parent.name
          )
            scopes.unshift(parent.name.text);
        if (scopes.length)
          name = name.slice(0, -symbol.name.length) + [...scopes, symbol.name].join('.');
      }
      const owner = definitionOwners.get(name);
      if (owner && !identities.sameDeclaration(owner, node))
        throw new SchemaError(`Schema name '${name}' belongs to more than one declaration`, node);
      definitionOwners.set(name, node);
      if (!materialized.has(name)) {
        definitions[name] = schema;
        materialized.add(name);
      }
      return reference(name);
    };
    const overrideOf = (node: ts.Node, context: AnnotationContext): Schema | undefined =>
      this.override(node, context.bindings, materialize);
    const encode = (type: ts.Type, node: ts.Node, parent = contexts.empty): Schema => {
      const mapped = this.mappings.schema(type);
      if (mapped !== undefined) return this.override(node, parent.bindings) ?? mapped;
      const context = contexts.enter(type, node, parent);
      const instance = contexts.instance(type, context);
      const override = overrideOf(node, context);
      if (override !== undefined) return override;
      // NoInfer must share its base identity before recursion and naming are tracked.
      // Constrained substitutions can narrow the base and are not transparent.
      if (type.flags & ts.TypeFlags.Substitution) {
        const substitution = type as ts.SubstitutionType;
        if (substitution.constraint.flags & ts.TypeFlags.Unknown)
          return encode(substitution.baseType, node, context);
      }
      const name =
        names.get(instance) ??
        identities.name(
          type,
          node,
          context.key,
          [...(context.bindings.origins?.values() ?? [])].map((origin) => origin.syntax),
        );
      if (name) {
        if (syntheticNames.has(name))
          throw new SchemaError(`Schema name '${name}' belongs to a synthetic intersection`, node);
        names.set(instance, name);
        if (!Object.hasOwn(definitions, name)) {
          const declaration = (type.aliasSymbol ?? type.getSymbol())?.declarations?.find(
            (source) =>
              ts.isTypeAliasDeclaration(source) ||
              ts.isInterfaceDeclaration(source) ||
              ts.isClassDeclaration(source) ||
              ts.isEnumDeclaration(source),
          );
          definitionOwners.set(name, declaration ?? node);
          definitions[name] = false;
          pending.add(name);
          const schema = resolve(type, node, context);
          pending.delete(name);
          if (!materialized.has(name)) definitions[name] = schema;
        }
        return reference(name);
      }
      return resolve(type, node, context);
    };
    const resolve = (type: ts.Type, node: ts.Node, context: AnnotationContext): Schema => {
      const instance = contexts.instance(type, context);
      const override = overrideOf(node, context);
      if (override !== undefined) return override;
      const cached = completed.get(instance);
      if (cached !== undefined) return cached;
      if (visiting.has(instance)) {
        const name = identities.recursive(
          type,
          node,
          context.key,
          [...(context.bindings.origins?.values() ?? [])].map((origin) => origin.syntax),
        );
        if (definitionOwners.has(name))
          throw new SchemaError(`Recursive schema name '${name}' is already occupied`, node);
        definitionOwners.set(name, node);
        names.set(instance, name);
        recursiveNames.set(instance, name);
        definitions[name] = false;
        pending.add(name);
        return reference(name);
      }
      if (visiting.size >= 128) {
        throw new SchemaError(
          'Schema exceeds 128 nested type resolutions; recursive expansion may be unbounded',
          node,
        );
      }
      if (completed.size + visiting.size >= maxTypes) {
        throw new SchemaError(
          `Schema exceeded ${maxTypes} distinct types; generic recursion may expand indefinitely`,
          node,
        );
      }
      visiting.add(instance);
      const child = (value: ts.Type, source: ts.Node, bindings?: TypeBindings): Schema =>
        encode(value, source, bindings ? { key: '', bindings } : context);
      let schema = this.type(
        type,
        node,
        child,
        context.bindings,
        (value, source): SchemaEdge => {
          const edge = this.mappings.has(value) ? context : contexts.enter(value, source, context);
          return {
            bindings: edge.bindings,
            encode: (item, location, bindings): Schema =>
              encode(item, location, bindings ? { key: '', bindings } : edge),
          };
        },
        intersection,
      );
      const declaration = (type.aliasSymbol ?? type.getSymbol())?.declarations?.find(
        (item) =>
          ts.isInterfaceDeclaration(item) ||
          ts.isTypeAliasDeclaration(item) ||
          ts.isClassDeclaration(item) ||
          ts.isEnumDeclaration(item),
      );
      if (declaration && !declaration.getSourceFile().hasNoDefaultLib)
        schema = this.provenance.apply(
          schema,
          declaration,
          child,
          type,
          type,
          context.bindings,
          intersection,
        );
      visiting.delete(instance);
      const recursiveName = recursiveNames.get(instance);
      if (recursiveName) {
        definitions[recursiveName] = schema;
        pending.delete(recursiveName);
        schema = reference(recursiveName);
      }
      completed.set(instance, schema);
      return schema;
    };
    for (const root of roots) {
      const context = rootContexts.get(root)!;
      const instance = contexts.instance(root.type, context);
      const child = (value: ts.Type, source: ts.Node, bindings?: TypeBindings): Schema =>
        encode(value, source, bindings ? { key: '', bindings } : context);
      const name = names.get(instance) ?? root.name;
      if (!Object.hasOwn(definitions, name)) {
        definitions[name] = false;
        pending.add(name);
        const mapped = this.mappings.schema(root.type);
        const schema =
          mapped !== undefined
            ? (this.override(root.node, context.bindings) ?? mapped)
            : names.has(instance)
              ? resolve(root.type, root.node, context)
              : encode(root.type, root.node, context);
        pending.delete(name);
        if (!materialized.has(name)) definitions[name] = schema;
      }
      const schema = root.name !== name ? reference(name) : definitions[name]!;
      definitions[root.name] =
        this.override(root.node, context.bindings) === undefined
          ? this.provenance.apply(
              schema,
              root.node,
              child,
              root.type,
              root.type,
              context.bindings,
              intersection,
            )
          : schema;
    }
    try {
      if (roots[0]) {
        discriminatorDefinitions(definitions, destination, roots[0].node);
        inlineDefinitions(definitions, destination, roots[0].node);
      }
      schemaCatalog(definitions, destination);
    } catch (error) {
      if (error instanceof SchemaError || !roots.length) throw error;
      throw new SchemaError(
        `Invalid schema resource graph: ${error instanceof Error ? error.message : String(error)}`,
        roots[0]!.node,
      );
    }
    return { definitions, roots: new Map(roots.map((root) => [root, definitions[root.name]!])) };
  }

  private override(
    node: ts.Node,
    bindings: TypeBindings,
    materialize?: (schema: Schema, declaration: ts.Node) => Schema,
  ): Schema | undefined {
    return schemaOverride(
      node,
      this.checker,
      new Set(),
      materialize,
      overrideResolver(this.checker, bindings),
    );
  }

  private checkNamespaces(): void {
    for (const source of this.program.getSourceFiles()) {
      if (
        this.program.isSourceFileDefaultLibrary(source) ||
        this.program.isSourceFileFromExternalLibrary(source)
      )
        continue;
      if (checkedNamespaces.has(source)) continue;
      const visit = (node: ts.Node): void => {
        if (ts.getJSDocTags(node).some((tag) => tag.tagName.text === 'namespace')) {
          throw new SchemaError(
            '@namespace is unsupported; configure SchemaOptions.namespaces instead',
            node,
          );
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
      checkedNamespaces.add(source);
    }
  }

  private type(
    type: ts.Type,
    node: ts.Node,
    encode: (type: ts.Type, node: ts.Node) => Schema,
    bindings: TypeBindings,
    edgeContext: (type: ts.Type, node: ts.Node) => SchemaEdge,
    intersection: SchemaIntersection,
  ): Schema {
    const flags = type.flags;
    const member = type.getSymbol()?.declarations?.find(ts.isEnumMember);
    if (member) {
      const hidden = ts.getJSDocTags(member).filter((tag) => tag.tagName.text === 'hidden');
      for (const tag of hidden) {
        const text = ts.getTextOfJSDocComment(tag.comment)?.trim();
        if (text && text !== 'true') throw new SchemaError('@hidden is a presence flag', member);
      }
      if (hidden.length) return false;
    }
    if (flags & ts.TypeFlags.Any) {
      if (this.options.types?.any === 'allow') return true;
      throw new SchemaError('Unsafe any cannot describe a JSON value', node);
    }
    if (flags & ts.TypeFlags.Unknown) {
      if (this.options.types?.unknown === 'allow') return true;
      throw new SchemaError('Unsafe unknown cannot describe a JSON value', node);
    }
    if (flags & ts.TypeFlags.Never) return false;
    if (flags & ts.TypeFlags.TemplateLiteral) {
      const pattern = templatePattern(type);
      if (!pattern)
        throw new SchemaError('Template values require unrestricted string interpolation', node);
      return { type: 'string', pattern };
    }
    if (flags & ts.TypeFlags.StringLiteral)
      return { type: 'string', const: (type as ts.StringLiteralType).value };
    if (flags & ts.TypeFlags.NumberLiteral)
      return { type: 'number', const: (type as ts.NumberLiteralType).value };
    if (flags & ts.TypeFlags.BooleanLiteral) {
      return { type: 'boolean', const: this.checker.typeToString(type) === 'true' };
    }
    if (flags & ts.TypeFlags.String) return { type: 'string' };
    if (flags & ts.TypeFlags.Number) return { type: 'number' };
    if (flags & ts.TypeFlags.Enum) return { type: 'number' };
    if (flags & ts.TypeFlags.Boolean) return { type: 'boolean' };
    if (flags & ts.TypeFlags.Null) return { type: 'null' };
    if (flags & ts.TypeFlags.NonPrimitive)
      return { anyOf: [{ type: 'object' }, { type: 'array' }] };
    const symbol = type.getSymbol();
    if (
      (symbol?.name === 'Date' || symbol?.name === 'URL') &&
      symbol.declarations?.length &&
      symbol.declarations.every((declaration) =>
        this.program.isSourceFileDefaultLibrary(declaration.getSourceFile()),
      )
    )
      return { type: 'string', format: symbol.name === 'Date' ? 'date-time' : 'uri' };
    if (type.isUnion()) return this.union(type.types.map((item) => encode(item, node)));
    if (this.checker.isTupleType(type))
      return this.tuple(type as ts.TupleTypeReference, node, encode);
    if (this.checker.isArrayType(type) || this.readonlyArray(type)) {
      const element = this.checker.getTypeArguments(type as ts.TypeReference)[0];
      if (!element) throw new SchemaError('Array has no resolved element type', node);
      return { type: 'array', items: encode(element, node) };
    }
    if (
      type.isIntersection() &&
      type.types.every((part) => part.flags & ts.TypeFlags.Object) &&
      type.types.some((part) =>
        this.checker
          .getPropertiesOfType(part)
          .some((property) => this.checker.getTypeOfSymbolAtLocation(property, node).isUnion()),
      ) &&
      type.types.every((part) => !this.checker.getIndexInfosOfType(part).length)
    )
      return type.types.reduce<Schema>(
        (schema, part) => intersection.apply(schema, encode(part, node), node),
        true,
      );
    if (type.isIntersection()) {
      const primitive = new SchemaProjection(this.checker, this.options.root).brand(type, node);
      if (primitive)
        return primitive.reduce<Schema>(
          (schema, part) => intersection.apply(schema, encode(part, node), node),
          true,
        );
      const collections = type.types.map(
        (part) =>
          this.checker.isArrayType(part) ||
          this.checker.isTupleType(part) ||
          this.readonlyArray(part),
      );
      if (collections.some(Boolean)) {
        if (!collections.every(Boolean))
          throw new SchemaError(
            'Array intersections with non-array fields require an explicit serialization schema',
            node,
          );
        return type.types.reduce<Schema>(
          (schema, part) => intersection.apply(schema, encode(part, node), node),
          true,
        );
      }
    }
    if (flags & ts.TypeFlags.Object || type.isIntersection())
      return this.object(type, node, encode, bindings, edgeContext, intersection);
    throw new SchemaError(
      `Type '${this.checker.typeToString(type)}' has no supported JSON representation`,
      node,
    );
  }

  private readonlyArray(type: ts.Type): boolean {
    return (
      type.getSymbol()?.name === 'ReadonlyArray' &&
      (type
        .getSymbol()
        ?.declarations?.every((node) =>
          this.program.isSourceFileDefaultLibrary(node.getSourceFile()),
        ) ??
        false)
    );
  }

  private tuple(
    type: ts.TupleTypeReference,
    node: ts.Node,
    encode: (type: ts.Type, node: ts.Node) => Schema,
  ): Schema {
    const elements = this.checker.getTypeArguments(type);
    const flags = type.target.elementFlags;
    const prefixItems: Schema[] = [];
    let minItems = 0;
    let items: Schema = false;
    for (const [index, element] of elements.entries()) {
      const flag = flags[index]!;
      const label = type.target.labeledElementDeclarations?.[index];
      if (flag & ts.ElementFlags.Variadic) {
        throw new SchemaError(
          'Unresolved variadic tuple cannot describe a fixed JSON array shape',
          node,
        );
      }
      if (flag & ts.ElementFlags.Rest) {
        if (index !== elements.length - 1) {
          throw new SchemaError(
            'Tuple with a required tail after a rest element is unsupported',
            node,
          );
        }
        items = tupleItem(encode(element, node), label);
      } else {
        prefixItems.push(
          tupleItem(
            flag & ts.ElementFlags.Optional
              ? this.optional(element, node, encode)
              : encode(element, node),
            label,
          ),
        );
        if (flag & ts.ElementFlags.Required) minItems = index + 1;
      }
    }
    return {
      type: 'array',
      ...(prefixItems.length ? { prefixItems } : {}),
      items,
      minItems,
      ...(items === false ? { maxItems: prefixItems.length } : {}),
    };
  }

  private object(
    type: ts.Type,
    node: ts.Node,
    encode: (type: ts.Type, node: ts.Node) => Schema,
    bindings: TypeBindings,
    edgeContext: (type: ts.Type, node: ts.Node) => SchemaEdge,
    intersection: SchemaIntersection,
  ): Schema {
    if (type.isIntersection() && type.types.some((item) => !(item.flags & ts.TypeFlags.Object))) {
      throw new SchemaError(
        'Intersection containing a non-object type needs an explicit serialization schema',
        node,
      );
    }
    if (type.getCallSignatures().length || type.getConstructSignatures().length) {
      throw new SchemaError('Functions and constructors are not JSON values', node);
    }
    const symbol = type.getSymbol();
    const classType = symbol?.declarations?.some(
      (item) => ts.isClassDeclaration(item) || ts.isClassExpression(item),
    );
    const properties = Object.create(null) as Record<string, Schema>;
    const required: string[] = [];
    const wireSources = new Map<string, string>();
    let renamed = false;
    for (const property of this.checker.getPropertiesOfType(type)) {
      const origin = this.provenance.origin(property, node, type);
      const declaration = origin ?? node;
      const value = this.checker.getTypeOfSymbolAtLocation(property, declaration);
      if (
        property.name === 'toJSON' &&
        (value.isUnion() ? value.types : [value]).some(
          (part) =>
            part.getCallSignatures().length ||
            part.getConstructSignatures().length ||
            part.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown),
        )
      )
        throw new SchemaError(
          'Custom toJSON requires an explicit serialization schema',
          declaration,
        );
      if (ts.isPropertyDeclaration(declaration) && ts.isPrivateIdentifier(declaration.name))
        continue;
      const hidden = [
        ...property
          .getJsDocTags(this.checker)
          .filter((tag) => tag.name === 'hidden')
          .map((tag) =>
            tag.text
              ?.map((part) => part.text)
              .join('')
              .trim(),
          ),
        ...(origin
          ? ts
              .getJSDocTags(origin)
              .filter((tag) => tag.tagName.text === 'hidden')
              .map((tag) => ts.getTextOfJSDocComment(tag.comment)?.trim())
          : []),
      ];
      for (const text of hidden)
        if (text && text !== 'true')
          throw new SchemaError('@hidden is a presence flag', declaration);
      if (hidden.length) continue;
      if (
        (ts.isClassDeclaration(declaration.parent) || ts.isClassExpression(declaration.parent)) &&
        (ts.isMethodDeclaration(declaration) ||
          ts.isGetAccessorDeclaration(declaration) ||
          ts.isSetAccessorDeclaration(declaration))
      )
        continue;
      if (symbolProperty(property)) {
        throw new SchemaError(
          'Symbol-keyed properties have no JSON object representation',
          declaration,
        );
      }
      const nameNode = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
      const name = wirePropertyName(this.checker, type, property, nameNode);
      const previous = wireSources.get(name);
      if (previous !== undefined && previous !== property.name)
        throw new SchemaError(
          `Schema property rename collision: ${JSON.stringify(name)}`,
          nameNode,
        );
      wireSources.set(name, property.name);
      renamed ||= name !== property.name;
      const nativeOptional = Boolean(property.flags & ts.SymbolFlags.Optional);
      const presence = fieldRequired(origin);
      const optional = presence === undefined ? nativeOptional : !presence;
      const allowUndefined = nativeOptional || optional;
      const propertyContext = edgeContext(value, declaration);
      const propertyBindings = propertyContext.bindings;
      const serialized = origin ? this.override(origin, propertyBindings) : undefined;
      if ((property.declarations?.length ?? 0) > 1 && serialized !== undefined)
        throw new SchemaError(
          'Multiple-origin property serialization requires an explicit complete property schema',
          declaration,
        );
      const schema =
        serialized !== undefined
          ? encode(value, declaration)
          : allowUndefined
            ? this.optional(value, declaration, encode)
            : encode(value, declaration);
      properties[name] =
        origin && serialized === undefined
          ? this.provenance.apply(
              schema,
              origin,
              allowUndefined
                ? (item, location, bindings): Schema =>
                    this.optional(item, location, (value, source) =>
                      propertyContext.encode(value, source, bindings),
                    )
                : propertyContext.encode,
              value,
              type,
              propertyBindings,
              intersection,
            )
          : schema;
      if (!optional) required.push(name);
    }
    const indexes = this.checker.getIndexInfosOfType(type);
    if (renamed && indexes.length)
      throw new SchemaError(
        'Field renaming with index signatures requires an explicit serialized schema',
        node,
      );
    if (!Object.keys(properties).length && !indexes.length) {
      const mapped = type.getSymbol()?.declarations?.find(ts.isMappedTypeNode);
      const keys = mapped?.typeParameter.constraint;
      const homomorphic =
        mapped &&
        !mapped.nameType &&
        keys &&
        ts.isTypeOperatorNode(keys) &&
        keys.operator === ts.SyntaxKind.KeyOfKeyword &&
        ts.isTypeReferenceNode(keys.type) &&
        this.checker
          .getSymbolAtLocation(keys.type.typeName)
          ?.declarations?.some(ts.isTypeParameterDeclaration);
      return classType || (mapped && !homomorphic)
        ? { type: 'object', additionalProperties: false }
        : { not: { type: 'null' } };
    }
    return new SchemaIndexes(
      this.checker,
      this.provenance,
      (node, scope) => this.override(node, scope),
      this.options.root,
    ).apply(type, node, properties, required, encode, bindings, edgeContext, intersection);
  }

  private optional(
    type: ts.Type,
    node: ts.Node,
    encode: (type: ts.Type, node: ts.Node) => Schema,
  ): Schema {
    if (type.flags & ts.TypeFlags.Undefined) return false;
    if (!type.isUnion()) return encode(type, node);
    const values = type.types.filter((item) => !(item.flags & ts.TypeFlags.Undefined));
    if (values.length === 1) return encode(values[0]!, node);
    return this.union(values.map((item) => encode(item, node)));
  }

  /** Compact only bare literals; annotations and reference boundaries must remain intact. */
  private union(values: Schema[]): Schema {
    const literal = (value: Schema): value is { type: string; const: unknown } =>
      typeof value === 'object' &&
      Object.keys(value).length === 2 &&
      Object.hasOwn(value, 'const') &&
      typeof value.type === 'string';
    const primitive = (value: Schema): value is { type: string } =>
      typeof value === 'object' &&
      Object.keys(value).length === 1 &&
      typeof value.type === 'string';
    const primitives = new Set(values.filter(primitive).map((value) => value.type));
    const emitted = new Set<string>();
    values = values.filter((value) => {
      if (value === false || (literal(value) && primitives.has(value.type))) return false;
      if (!primitive(value)) return true;
      if (emitted.has(value.type)) return false;
      emitted.add(value.type);
      return true;
    });
    if (!values.length) return false;
    if (values.length > 1 && values.every(literal)) {
      const type = values[0]!.type;
      if (values.every((value) => value.type === type)) {
        const choices = [...new Set(values.map((value) => value.const))];
        if (type === 'boolean' && choices.includes(true) && choices.includes(false))
          return { type: 'boolean' };
        // Checker literal order depends on which unrelated types were visited first.
        if (type === 'number' && choices.every((choice) => typeof choice === 'number'))
          choices.sort((left, right) => left - right);
        return { type, enum: choices };
      }
    }
    const booleans = values.filter(literal).filter((value) => value.type === 'boolean');
    if (
      booleans.some((value) => value.const === true) &&
      booleans.some((value) => value.const === false)
    ) {
      const first = values.indexOf(booleans[0]!);
      const members = new Set<Schema>(booleans);
      values = values.flatMap((value, index) =>
        !members.has(value) ? [value] : index === first ? [{ type: 'boolean' }] : [],
      );
    }
    return values.length === 1 ? values[0]! : { anyOf: values };
  }
}
