const express = require("express");

const app = express();
const PORT = 4000;

app.use(express.json());

app.post("/webhook", (req, res) => {
  console.log("Webhook received:");
  console.log(req.body);

  res.status(200).json({
    message: "Webhook received successfully",
  });
});

app.listen(PORT, () => {
  console.log(`Test webhook receiver running on http://localhost:${PORT}`);
});