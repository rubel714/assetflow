module.exports = {
  jwtSecret: process.env.JWT_SECRET || "assetflow-dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  port: Number(process.env.PORT || 5001),
};
