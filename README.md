# JTIPS Analytics — V4 CSV Funcional

Esta versão lê o arquivo `data/26-05-2026.csv` e monta o dashboard com jogos reais do CSV.

## Arquivos

```txt
index.html
data/26-05-2026.csv
vercel.json
README.md
```

## Deploy na Vercel

Suba todos estes arquivos no GitHub e aguarde o deploy automático da Vercel.

## Importante

Abrir o `index.html` direto pelo computador pode bloquear o carregamento do CSV por causa do `fetch`.
Na Vercel funciona normalmente porque o arquivo CSV fica hospedado junto do site.

## Próximas melhorias

- Trocar arquivo CSV por data automaticamente.
- Ler CSV direto de uma URL raw do GitHub.
- Criar painel Admin para configurar a URL do CSV.
- Adicionar login real com Supabase.
