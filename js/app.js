const API_BASE_URL = "/api/footystats";
const APP_TIMEZONE = "America/Sao_Paulo";
const API_TIMEOUT = 15000;

const TARGET_LEAGUES = [
  { key: "brasileirao-a", name: "Brasileirão Série A", short: "BRA", country: "Brasil", color: "#00c853", aliases: ["serie a", "brasileirao", "brasileirão"] },
  { key: "brasileirao-b", name: "Brasileirão Série B", short: "BRB", country: "Brasil", color: "#f