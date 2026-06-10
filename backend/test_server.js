console.log("Starting...");
import express from "express";
console.log("Express loaded");
const app = express();
app.listen(3001, () => console.log("Test Server on 3001"));
