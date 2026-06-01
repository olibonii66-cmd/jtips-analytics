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
