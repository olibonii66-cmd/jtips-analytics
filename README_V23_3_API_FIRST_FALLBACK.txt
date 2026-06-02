JTIPS V23.3 — API primeiro + fallback seguro

Alteração solicitada: deixar os dados como vêm da API FootyStats e usar fallback quando a API não devolver o campo/bloco esperado.

Arquivos alterados:
- api/league-averages.js
- api/time.js
- api/lastx-trends.js
- api/jogadores.js
- api/h2h.js

Regra aplicada:
1. Prioriza o endpoint/campo direto da API FootyStats.
2. Se o endpoint oficial não retornar dados úteis, tenta variações aceitas pela API: league_id, season_id e competition_id.
3. Se ainda não vier, usa fallback calculado somente com dados retornados pela própria API.
4. Inclui flags como fallback_used, source/fonte e attempts para auditoria.
5. Não altera layout, rotas principais, estrutura visual ou componentes do site.

Observação:
Fallback existe para não deixar telas vazias, mas os campos source/fonte e fallback_used permitem identificar quando o número não veio pronto da API principal.
