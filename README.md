# Footy Analytics

Projeto estático em HTML, CSS e JavaScript puro para análises esportivas focadas em apostas de futebol.

## Rodando no Vercel

O arquivo `vercel.json` contém um rewrite `/api/footystats/*` para `https://api.football-data-api.com/*`. Isso reduz problemas de CORS quando o site está publicado no Vercel.

## Configuração da API

No topo de `js/app.js`:

```js
const FOOTYSTATS_API_KEY = 'example';
const DEFAULT_SEASON_ID = 2012;
const FALLBACK_LEAGUE_ID = 1625;
```

A chave `example` é limitada e pode não retornar jogos atuais em `todays-matches`. Por isso o dashboard tenta primeiro os jogos do dia e depois cai para a temporada de teste documentada.

Abra o console do navegador para ver logs `[FootyStats]` com endpoint, quantidade de registros e payload retornado.
