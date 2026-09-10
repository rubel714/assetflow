const { createApp } = require("./src/app");
const migrate = require("./src/scripts/migrate");
const seed = require("./src/scripts/seed");
const env = require("./src/config/env");

const app = createApp();

const server = app.listen(env.port, "0.0.0.0", async () => {
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

server.on("error", (err) => {
  console.error("Could not start API:", err.message);
  process.exit(1);
});
