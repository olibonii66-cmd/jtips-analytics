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
