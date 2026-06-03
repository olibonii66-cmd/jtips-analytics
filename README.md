# JTIPS Analytics — MVP Visual Novo

Projeto novo do JTIPS Analytics no formato GitHub + Vercel.

## Estrutura

- `index.html`: site completo em HTML, CSS e JavaScript puro.
- `assets/logo-jtips.svg`: logo temporária no padrão verde/dourado.
- `api/health.js`: endpoint simples para testar se a Vercel está online.
- `vercel.json`: configuração básica para Vercel.
- `package.json`: scripts para Vercel Dev.

## Como publicar

1. Suba esta pasta para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Deploy automático.

## Logo

A logo atual é SVG temporária. Para usar sua logo oficial:

1. Salve sua imagem em `assets/logo-jtips.jpg`.
2. No `index.html`, troque:

```html
<img src="assets/logo-jtips.svg" alt="JTIPS">
