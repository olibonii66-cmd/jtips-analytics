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


## V12.16 — Endpoint 22 / Dataset Final

Esta versão integra o Dataset Final gerado no Endpoint 21.

### Como usar
1. Gere o ZIP `jtips_site_dataset_final_endpoint_21.zip` no Colab.
2. Extraia o arquivo `json/jtips_site_dataset_final.json`.
3. Copie esse JSON para a pasta `data/` deste projeto com o nome:
   `data/jtips_site_dataset_final.json`.
4. Faça deploy normalmente na Vercel.

### Comportamento
- O frontend tenta carregar primeiro `/data/jtips_site_dataset_final.json`.
- Se o JSON não existir, mantém fallback para `/api/jogos`.
- A página `Apostas Prontas` usa os bilhetes compactos do dataset final quando disponíveis.
- O logo JTIPS foi incluído em `assets/jtips-logo.png` e `assets/jtips-logo-full.jpg`.

## V12.16 — Correção de Escanteios

- Corrigida a aba Probabilidades > Escanteios para seguir o padrão FootyStats.
- Linhas exibidas agora são: Mais que 6, 7, 8, 9, 10, 11, 12 e 13.
- A coluna Média/Jogo agora é calculada pelo recorte Casa x Visitante, em vez de usar odd ou potencial genérico.
- A tela busca estatísticas completas do time via `/api/time` antes de renderizar a tabela final.
