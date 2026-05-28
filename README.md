# JTIPS Analytics V7 — API segura + fallback local

## Variável obrigatória na Vercel

Cadastre em Project Settings > Environment Variables:

FUTPYTHON_TOKEN=seu_token

## Fontes

- footystats
- bet365

## Ligas carregadas pela API

- BRAZIL 1
- ENGLAND 1
- FRANCE 1
- GERMANY 1
- ITALY 1
- PORTUGAL 1
- SPAIN 1

## Funcionamento

O site tenta carregar a API primeiro. Se a API falhar ou retornar vazia, tenta carregar o arquivo local em `/data/DD-MM-YYYY.csv`.

Data padrão de teste: 2026-05-30.


## V7.1
- Datas disponíveis da API no seletor.
- Botões Hoje/Amanhã/Anterior/Próxima.
- Abas: Ambas Marcam, xG / Força e Avançadas.
- Correção visual para Finalizações e Chutes a gol com dados brutos quando disponíveis.
