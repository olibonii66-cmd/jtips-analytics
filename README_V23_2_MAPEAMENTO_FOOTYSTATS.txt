JTIPS v23.2 — Correção controlada de mapeamento FootyStats

Alterações feitas sem refatorar a estrutura-base do site:

1) api/league-averages.js
- Deixou de depender de league-teams?season_id=...&include=stats para médias da liga.
- Passou a usar league-tables?league_id=...&include=stats, que foi validado na temporada de teste finalizada da FootyStats.
- Trata corretamente a estrutura data.league_table e demais blocos de tabela.

2) api/lastx-trends.js
- Força lastx com last_x=5, conforme padrão de forma recente.
- Prioriza exatamente last_x_match_num = 5.
- Atualiza o cache para não reutilizar dados antigos.

3) api/h2h.js
- Prioriza o bloco pronto da API: match.h2h.betting_stats e match.h2h.previous_matches_results.
- Só recalcula H2H se o bloco pronto da FootyStats não vier.
- Usa previous_matches_ids já embutido no match quando disponível, evitando chamadas desnecessárias.

4) api/time.js
- Remove fallback silencioso para outra competição quando uma competição específica é solicitada.
- Se a API não devolver estatística da competição exata, o endpoint não retorna estatística principal para evitar número incorreto.

5) api/jogadores.js
- Usa league_id no endpoint league-players, conforme validado no Colab com a temporada 1625.
- Mantém mais campos reais de jogadores: gols casa/fora, assistências, gols por 90, minutos por gol, cartões por 90, minutos por cartão e rankings.

Objetivo:
Aproximar os números do site do padrão FootyStats usando campos prontos da API sempre que disponíveis, reduzindo recálculos internos e fallbacks que podiam gerar divergência.
