# JTIPS Analytics V9.3 — Ligas e data corrigidas

Versão API oficial FootyStats.

## Variável obrigatória na Vercel

```txt
FOOTYSTATS_API_KEY=sua_chave
```

## Ajustes desta versão

- busca todos os jogos da data selecionada;
- trata paginação do endpoint de jogos do dia;
- filtro de liga mostra somente as ligas com jogos naquela data;
- ao trocar a data, o filtro de liga é recriado automaticamente;
- jogos com status `incomplete` aparecem como Pré-jogo;
- remove faixa pública de Dados atualizados após o carregamento;
- mensagens públicas sem menção técnica à API.


## V9.4
- Corrige identificação de jogos ao vivo usando status, horário provável e estatísticas realizadas.
- Jogos `incomplete` em andamento agora entram na aba Ao Vivo.
- Mensagem pública da tela Ao Vivo foi limpa.

## V9.5 — Status corrigido
- O horário do jogo agora prevalece na tela pública.
- Jogo futuro aparece como Pré-jogo.
- Jogo dentro da janela provável da partida aparece como Ao vivo.
- Jogo passado fora da janela aparece como Finalizado.
- Corrige casos em que a base marca todos como Finalizado indevidamente.

## V9.6 — Layout Ao Vivo
- Implementa a página Ao Vivo no formato de ficha/placar ao vivo.
- Placar central, minuto, abas, estádio, árbitro, chips de escanteios/cartões e barras comparativas.
- Lista lateral com outros jogos ao vivo.

## V9.7 — Ao Vivo com dados detalhados
- A tela Ao Vivo agora busca detalhes atualizados de cada partida em andamento.
- O placar e as estatísticas ao vivo são puxados do detalhe da partida, não apenas da lista do dia.
- Reduzido cache do detalhe da partida para melhorar atualização ao vivo.
- O refresh do detalhe usa `no-store`.

## V9.8 — Pré-jogo responsivo
- Remove a área Ao Vivo por enquanto.
- Remove lógica de simulação de ao vivo por horário.
- Site focado em pré-jogo e pós-jogo confiável.
- Adapta layout para desktop, notebook 1366px, tablet e celular.
- Filtros, lista de jogos, análise, abas e cards passam a quebrar corretamente em telas menores.

## V9.9 — Status e layout corrigidos
- Corrige status público usando horário do jogo como regra principal.
- Jogo futuro nunca aparece como Finalizado.
- Jogo dentro da janela provável aparece como Em andamento.
- Jogo passado fora da janela aparece como Finalizado.
- Adiciona filtro Em andamento.
- Ajusta largura da tabela/lista para notebook 1366px, evitando botão cortado.

## V10 — Premium Green/Gold
- Aplica a nova identidade visual JTIPS baseada na logo verde/dourada.
- Substitui a identidade azul por verde escuro, grafite e dourado.
- Aplica a nova logo em assets/jtips-logo.png.
- Mantém a remoção do Ao Vivo e o foco em pré-jogo.
- Mantém a responsividade para desktop, notebook, tablet e celular.
- Ajusta botões, cards, filtros, abas, tabelas e estados ativos para a nova paleta.

## V10.1 — Estatísticas avançadas reais
- Adiciona endpoint `api/time.js` para buscar `/team?include=stats`.
- A análise da partida passa a buscar stats do mandante e visitante filtrando por `competition_id`.
- Adiciona Comparativo dos Times no Resumo.
- Melhora Finalizações com shotsAVG, shotsOnTargetAVG e shotsOffTargetAVG.
- Melhora Escanteios com cornersAVG, cornersAgainstAVG, cornersTotalAVG e linhas over.
- Melhora Cartões com cardsAVG e linhas over.
- Melhora xG / Força com xg_for_avg e xg_against_avg.
- Avançadas passa a exibir Impedimentos e Faltas reais quando disponíveis.
- Ajusta visual do status “Em andamento” para não quebrar linha.
- Compacta abas e oculta barra branca de rolagem.

## V10.2 — Abas redesenhadas
- Barra principal da análise reduzida para: Resumo, Vencedores, Estatísticas e Insights.
- A aba Estatísticas agora tem subabas internas: Gols, Escanteios, Cartões, Intervalo, Jogadores e Avançadas.
- Cria estrutura visual inicial inspirada nas referências do FootyStats.
- Gols contém blocos de Gols Marcados, Gols Sofridos, Projeções de Gols/BTTS e Quem Marca Primeiro.
- Escanteios contém Leitura rápida, Número de Escanteios e Escanteios por Time.
- Cartões contém Leitura rápida, Número de Cartões, Cartões por Time e espaço para jogadores advertidos.
- Intervalo contém Resultado 1º/2º Tempo e Cartões por tempo.
- Jogadores contém estrutura para escalação, artilheiros, cartões recebidos e cartões por 90.
- Avançadas fica dentro de Estatísticas.

## V10.3 — Estatísticas completas conectadas
- Mantém a estrutura: Resumo, Vencedores, Estatísticas e Insights.
- Em Estatísticas: Gols, Escanteios, Cartões, Intervalo, Jogadores e Avançadas.
- Conecta Gols com campos reais de `team.stats` e `/match`.
- Conecta Escanteios com totais, por tempo e por time.
- Conecta Cartões com total, por time e por tempo quando disponível.
- Conecta Intervalo com HT/2H: resultado, gols e cartões por etapa.
- Conecta Jogadores via novo endpoint `api/jogadores.js` usando `league-players`.
- Jogadores são filtrados por `club_team_id`/`national_team_id` conforme `homeID` e `awayID`.
- Avançadas usa impedimentos, faltas e campos adicionais quando disponíveis.
- Mantém fallback limpo para escalações/jogadores quando não houver dados.

## V10.4 — Jogadores visual
- Corrige a aba Jogadores para nunca exibir JSON bruto.
- A seção de escalações agora renderiza duas colunas visuais: Mandante e Visitante.
- Mostra titulares agrupados por Goleiro, Defensores, Meio-campistas, Atacantes e Outros.
- Mostra reservas em grid visual.
- Cruza player_id com a base de jogadores quando possível.
- Se lineups/bench não vierem completos, monta uma escalação estimada a partir dos jogadores da temporada e mostra aviso limpo.
- Mantém os blocos Quem pode marcar, Quem pode receber cartão e Cartões por 90 minutos.

## V10.5 — Jogadores corrigido
- Corrige a tela de escalações para não mostrar somente números e traços.
- Remove rating inventado/fixo 6.1 quando a API não fornece rating.
- Quando a escalação vier só com camisa/ID, mostra "Camisa X" e aviso de dados parciais.
- Quando não houver escalação mas houver jogadores, usa lista da temporada como estimativa.
- Atualiza `api/jogadores.js` para paginar `league-players` em vez de usar apenas a primeira página.
- Filtra jogadores por `club_team_id`, `club_team_2_id` e `national_team_id`.

## V10.6 — Jogadores layout corrigido
- Corrige a escalação para não mostrar nomes como Goalkeeper/Defender/Forward no lugar de atleta.
- Quando a API de lineup vem apenas com ID/camisa, o item é ocultado até ter nome resolvido.
- Usa lista de jogadores da temporada como estimativa quando a escalação oficial não tem nomes.
- Corrige sobreposição visual das colunas da escalação.
- Remove badge de nota fixa quando não há rating real.
- Reservas vazias agora mostram mensagem limpa em vez de linhas com pontos e traços.

## V10.7 — Cores e fontes padronizadas
- Padroniza a paleta do site inteiro para verde escuro + dourado premium.
- Remove inconsistências de azul forte, cinza claro e estilos diferentes entre cards/tabelas/botões.
- Padroniza fonte global com fallback Inter / Segoe UI.
- Padroniza títulos, textos, botões, abas, badges, tabelas, inputs, cards e sidebar.
- Mantém azul apenas como detalhe secundário suave, não como cor principal.
- Ajusta scrollbar e estados ativos/hover.

## V10.8 — Vencedores padronizado
- Corrige a aba Vencedores que ainda estava com azul forte e cards fora da paleta.
- Percentuais, odds, barras e cards agora seguem verde escuro + dourado premium.
- Adiciona renderer padronizado para Resultado Final e Chance Dupla.
- Remove azul forte remanescente dos percentuais.

## V10.9 — Over/Under traduzido
- Traduz Over para “Mais de” em todo o site.
- Traduz Under para “Menos de” em todo o site.
- Adiciona normalizador final para textos gerados dinamicamente por funções JS.
- Traduz variações comuns: HT/FH/2H, BTTS, Goals, Cards e Corners.
- Mantém termos técnicos somente nos nomes internos das variáveis/campos da API.

## V11 — Resumo e Insights API
- Nova aba Resumo com Confronto Direto, Indicadores H2H, Últimos confrontos e Estatísticas de previsão.
- H2H usa `match.h2h.previous_matches_ids` e busca cada `/match` por ID.
- H2H é calculado pela perspectiva da partida atual, não pelo mandante histórico da linha.
- Estatísticas de previsão usam `/match` + médias da liga calculadas por `league-teams?include=stats`.
- Nova aba Insights com `gpt_int.pt` / `gpt_en` e Team Trends gerado por `/lastx.stats`.
- `match.trends` não é obrigatório; `/lastx` é a fonte principal das tendências.
- Título/informações da partida centralizados.
- Mantém tradução Mais de/Menos de e paleta verde/dourado.

## V11.1 — Correção H2H e Trends
- Corrige carregamento do H2H e últimos confrontos.
- `api/h2h.js` agora extrai IDs de H2H de forma mais ampla e busca confrontos em lotes paralelos.
- `api/lastx-trends.js` aceita `season_id`, `competition_id`, `season`, `homeID`, `awayID` e variações.
- Front-end agora descobre IDs em `selected`, `selected.raw` e `selected.odds`.
- Adiciona estados de carregamento: "Carregando confronto direto..." e "Carregando tendências recentes...".
- Exibe erro técnico limpo se endpoint falhar, em vez de mostrar indisponível antes da hora.
- Reduz visualmente o bloco grande de Insights com área rolável.

## V12 — Bilhetes + ajustes
- Remove cards “Jogos do dia”, “Ligas” e “Oportunidades” do Dashboard.
- Ajusta calendário e botão “Atualizar dados”.
- Limpa Admin e coloca colunas técnicas em área expansível.
- Adiciona aba Bilhetes com Apostas da IA, Apostas Seguras e Apostas de Valor.
- Bilhetes combinados com regras anti-conflito e aviso 🔞 18+ Jogo Responsável.
