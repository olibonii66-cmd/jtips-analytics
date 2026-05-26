# JTIPS Analytics V5 — CSV real funcional

Esta versão remove os dados fictícios do app e carrega o CSV real pela pasta `/data`.

## Arquivos

- `index.html`
- `vercel.json`
- `data/26-05-2026.csv`

## Como usar na Vercel

Substitua os arquivos do repositório atual por estes arquivos e faça commit/push.

## Como adicionar novas datas

Coloque novos CSVs na pasta `data` usando o formato:

```txt
DD-MM-YYYY.csv
```

Exemplo:

```txt
data/27-05-2026.csv
```

No site, selecione a data no campo de data. O sistema tentará carregar automaticamente o arquivo correspondente.
