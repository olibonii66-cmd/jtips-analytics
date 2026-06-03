JTIPS Analytics V27 - Estrutura mais fiel ao modelo FootyStats

Esta versão partiu da V26 e reorganizou a página da partida para ficar mais próxima do fluxo estatístico do FootyStats, mantendo a identidade visual JTIPS.

Principais ajustes:
- A primeira aba da análise agora é "Quem vai vencer?".
- A página usa blocos/tabelas por seção, no padrão Casa x Visitante x Jogo.
- Forma recente traduzida: W -> V, D/Draw -> E, L -> D.
- Títulos e subtabs padronizados:
  - Gols Marcados / Jogo Inteiro
  - Gols Sofridos / Jogo Inteiro
  - Mais de 2,5 & Ambas Marcam
  - Número de Escanteios / Total de Escanteios / Individuais por Time
  - Número de Cartões / Total de Cartões / Cartões por Time / Média de Cartões
  - Primeiro/Segundo Tempo
  - Chutes / NO GOL
  - Quais jogadores marcarão?
  - Jogador para Tomar Cartão
  - H2H e Partidas
- O frontend prioriza os campos vindos da API FootyStats e usa fallback apenas quando o campo oficial não vem.
- Mantido diagnóstico API para verificar source/fallback.

Observação:
Não foi copiada marca, identidade visual ou conteúdo proprietário do FootyStats. A estrutura estatística foi aproximada dentro do JTIPS.
