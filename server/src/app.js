const path = require("path");
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const allRoutes = require("./routes");
const { ensureAssetsUploadDir } = require("./services/assetImage.service");
const { ensureUsersUploadDir } = require("./services/userImage.service");
const { ensureDocumentsUploadDir } = require("./services/assetDocument.service");

function createApp() {
  const app = express();
  ensureAssetsUploadDir();
  ensureUsersUploadDir();
  ensureDocumentsUploadDir();
  app.use(cors({ origin: "*", credentials: true }));
  app.use(bodyParser.json({ limit: "10mb" }));
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
  app.get("/", (req, res) => res.send("<h1>AssetFlow API is running</h1>"));
  app.use(allRoutes);
  return app;
}

module.exports = { createApp };
