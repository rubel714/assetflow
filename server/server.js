const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const allRoutes = require("./src/routes");
const migrate = require("./src/scripts/migrate");
const seed = require("./src/scripts/seed");
const env = require("./src/config/env");

const app = express();

app.use(cors({ origin: "*", credentials: true }));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", (req, res) => res.send("<h1>AssetFlow API is running</h1>"));

app.use(allRoutes);

app.listen(env.port, async () => {
  try {
    await migrate();
    await seed();
  } catch (err) {
    console.error("Could not migrate or seed:", err.message);
  }
  if (!process.env.JWT_SECRET) {
    console.warn("JWT_SECRET is not set; using the development default.");
  }
  console.log(`AssetFlow API running at http://localhost:${env.port}`);
});
