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
