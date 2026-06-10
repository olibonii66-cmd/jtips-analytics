# ⚽ BetAnalytics — Análises de Futebol

Site de análises esportivas para apostas de futebol, integrado com a API Footstats.

## 🚀 Deploy

Hospedado no **Vercel**, com código versionado no **GitHub**.

## 📁 Estrutura

```
/
├── index.html          ← Página principal
├── vercel.json         ← Config do Vercel
├── css/
│   └── style.css       ← Estilos (dark/light mode)
├── js/
│   └── app.js          ← Lógica + chamadas à API Footstats
└── assets/             ← Ícones e imagens (se necessário)
```

## ⚙️ Configuração da API

Em `js/app.js`, substitua a chave:

```js
const API_KEY = 'SUA_CHAVE_AQUI';
const API_BASE = 'https://api.footstats.com.br/v1'; // ajuste conforme documentação
```

> **Dica:** Para ambientes de produção, use variáveis de ambiente do Vercel e um proxy/serverless function para não expor a chave no frontend.

## 🏆 Campeonatos Cobertos

- 🇧🇷 Brasileirão Série A e B
- 🇧🇷 Copa do Brasil
- 🏆 Libertadores
- 🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League
- 🇪🇸 La Liga
- 🇩🇪 Bundesliga
- 🇮🇹 Serie A
- 🇫🇷 Ligue 1

## 📊 Seções

| Seção | Descrição |
|---|---|
| Dashboard | Visão geral, jogos em destaque e tips do dia |
| Jogos & Resultados | Agenda navegável com filtro por campeonato |
| Estatísticas | Tabela de classificação e artilheiros |
| Odds & Probabilidades | Comparativo de odds com value bets |
| H2H | Histórico de confrontos diretos |
| Tips do Dia | Análises editoriais com confiança em estrelas |

## 🛠️ Tech Stack

- HTML5 / CSS3 / JavaScript Vanilla
- [Chart.js](https://www.chartjs.org/) — gráficos
- [Font Awesome](https://fontawesome.com/) — ícones
- [Footstats API](https://footstats.com.br) — dados esportivos
- [Vercel](https://vercel.com) — hospedagem

## 📝 Notas

- Dados mockados como fallback caso a API esteja indisponível
- Auto-refresh dos jogos ao vivo a cada 30 segundos
- Dark mode como padrão, com opção de alternar para light
