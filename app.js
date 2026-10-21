// Vercel Express entry point. npm start still runs the local server.
const express = require("express");
const app = express();
app.use(require("./server/index.js"));
module.exports = app;
