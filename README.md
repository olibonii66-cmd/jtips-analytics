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
