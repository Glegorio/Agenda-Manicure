import { Controller, Get, Header, Module, type Type } from '@nestjs/common';
import { Public } from '../auth/public.decorator.js';
import { buildOpenApiDocument, type OpenApiDocument } from './openapi.document.js';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * Opt-in (2.11): a referência só existe com `API_DOCS_ENABLED=true` (o `.env.example` de dev liga)
 * ou nos testes. Qualquer outro ambiente — inclusive sem variável — não expõe o mapa da API.
 */
export const docsEnabled = (env: Env): boolean =>
  env['API_DOCS_ENABLED'] === 'true' || env['NODE_ENV'] === 'test';

/** Scalar via CDN com versão fixa: só em dev, sem dependência no bundle da API. */
const REFERENCE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Agende API — referência</title>
  </head>
  <body>
    <script id="api-reference" data-url="/docs/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.78.1"></script>
  </body>
</html>
`;

@Public()
@Controller('docs')
export class DocsController {
  private readonly document = buildOpenApiDocument();

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  reference(): string {
    return REFERENCE_HTML;
  }

  @Get('openapi.json')
  openApi(): OpenApiDocument {
    return this.document;
  }
}

@Module({ controllers: [DocsController] })
export class DocsModule {}

/** Módulos a importar no `AppModule` conforme o ambiente. */
export const docsModules = (env: Env): Type[] => (docsEnabled(env) ? [DocsModule] : []);
