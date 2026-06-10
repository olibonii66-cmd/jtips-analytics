# ScoutBet

Dashboard responsivo de análises esportivas para futebol, criado com HTML, CSS e JavaScript puro.

## Executar localmente

Abrir `index.html` diretamente não carrega dados, pois páginas em `file://` não conseguem executar Vercel Functions.

Para testar também a integração com a API, instale a CLI da Vercel e execute:

```bash
vercel dev
```

Crie um arquivo `.env.local` apenas no ambiente local:

```text
FOOTYSTATS_API_KEY=sua_chave
```

Depois acesse o endereço informado pela CLI, normalmente `http://localhost:3000`.

## Configurar a FootyStats

A chave é lida exclusivamente pela Vercel Function `api/footystats.js`. Cadastre no projeto da Vercel:

```text
FOOTYSTATS_API_KEY=sua_chave
```

O frontend chama `/api/footystats`, portanto a chave não fica exposta no navegador nem no GitHub.

Para testar o endpoint mostrado na documentação:

```text
/api/footystats?endpoint=league-tables&league_id=1625
```

O projeto não utiliza dados fictícios. Se a API estiver indisponível ou não retornar determinado campo, a interface exibe um estado vazio ou uma mensagem de erro.

## Publicar no Vercel

1. Envie estes arquivos para a raiz de um repositório no GitHub.
2. Importe o repositório no Vercel.
3. Escolha `Other` como framework.
4. Não informe comando de build.
5. Use `.` como diretório de saída.

O arquivo `vercel.json` já inclui URLs limpas e headers básicos de segurança.

## Estrutura

```text
.
├── index.html
├── vercel.json
├── api/
│   └── footystats.js
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── assets/
    └── favicon.svg
```

## Dependências externas

- Chart.js via CDN
- Font Awesome via CDN
- Google Fonts via CDN
- FootyStats API

As análises são informativas e não garantem retorno financeiro.
