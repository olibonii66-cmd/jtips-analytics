export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    app: "JTIPS Analytics",
    version: "novo-mvp-visual",
    status: "online"
  });
}
