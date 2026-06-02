JTIPS 22.9 — recuperação estável

Correção feita:
- Remove o bloqueio rígido do 22.8 que zerava os dados quando a competição exata não era encontrada.
- /api/time agora tenta league_id, season_id, competition_id e none.
- Se encontrar a competição exata, usa ela.
- Se não encontrar, retorna a melhor linha disponível com warning em vez de deixar a tela vazia.
- Mantém a tela de escanteios no padrão FootyStats overall: Mais que 6 até Mais que 13.
