# JTIPS Analytics V12.10 — Ajustes de Navegação, Apostas Prontas e Estádio

## Ajustes aplicados

- Corrigido o cabeçalho da análise para renderizar estádio e localização vindos do endpoint `match` (`stadium_name` e `stadium_location`).
- Adicionado fallback visual: `Estádio não informado` quando a API não retornar estádio/local.
- Removido o texto `Football Intelligence` do bloco de marca na sidebar.
- Renomeado o botão lateral `Apostas` para `Apostas Prontas`.
- A página `Apostas Prontas` passa a listar apostas dos jogos carregados no dia, usando apenas mercados com odds disponíveis.
- Removido o botão `Scanner` da navegação lateral, pois duplicava a função da lista de jogos.
- Removido o card lateral de `Créditos / Plano Premium`.

## Regras mantidas

- Apostas oficiais usam somente mercados com odd válida.
- Mercados sem odd ficam fora do bilhete oficial.
- Sensor do Jogo substitui RedFlags.
- Partidas, H2H e subabas seguem a estrutura da V12.9.

## V12.14 — Login e Proteção de Rotas

Adicionado fluxo de login no frontend para proteger visualmente o acesso ao sistema.

### Login de demonstração
- Usuário comum: qualquer e-mail válido + senha com 4+ caracteres.
- Admin: `admin@jtips.com` / `admin123`.

### Regras adicionadas
- Sem login, o sistema interno fica oculto e a tela de login é exibida.
- Após login, o usuário acessa Dashboard, Jogos, Análise, Apostas Prontas, Como Usar e Planos.
- O item Admin só aparece para perfil admin.
- Botão Sair adicionado à sidebar.

### Observação importante
Esse login é local/frontend, indicado para protótipo e testes. Para venda real, substituir por autenticação segura com Supabase, Firebase Auth, Auth0 ou backend próprio.
