# JTIPS Analytics V8 — FootyStats único + redesenho

Versão redesenhada seguindo a nova direção visual aprovada.

## Fonte única

A operação usa somente FootyStats por enquanto, para evitar duplicidade entre bases.

## Variável obrigatória na Vercel

Cadastre:

```txt
FUTPYTHON_TOKEN=seu_token
```

## Ligas consultadas

- BRAZIL 1
- ENGLAND 1
- FRANCE 1
- GERMANY 1
- ITALY 1
- PORTUGAL 1
- SPAIN 1

## Funcionamento

Ao abrir, o site busca as datas disponíveis na API FootyStats e carrega a data mais próxima/recente com jogos. A tela Jogos do Dia exibe todos os jogos carregados e os filtros trabalham em cima da base já retornada.
