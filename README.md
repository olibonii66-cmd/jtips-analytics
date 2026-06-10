# FootyEdge Analytics

Site estático em HTML, CSS e JavaScript puro para análises esportivas de futebol voltadas a apostas.

## Estrutura

```txt
/
├── index.html
├── vercel.json
├── css/styles.css
├── js/app.js
└── assets/
```

## Como testar

1. Abra `js/app.js`.
2. Troque `FOOTYSTATS_API_KEY = 'example'` pela sua chave final.
3. Ajuste `DEFAULT_SEASON_ID` para a liga/temporada desejada.
4. Rode com um servidor local, por exemplo: `python -m http.server 3000`.
5. Publique no Vercel apontando para a raiz do repositório.

## Observação

A chave em JS fica exposta no navegador. Para produção, o ideal é criar uma rota serverless no Vercel para proxy da API e guardar a chave como variável de ambiente.
