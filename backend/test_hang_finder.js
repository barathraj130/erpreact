
async function test() {
    console.log("Checking cors...");
    await import("cors");
    console.log("Checking dotenv...");
    await import("dotenv");
    console.log("Checking express...");
    await import("express");
    console.log("Checking pg...");
    await import("pg");
    console.log("Checking puppeteer...");
    await import("puppeteer");
    console.log("Checking routes...");
    await import("./routes/hrRoutes.js");
    console.log("Checking database...");
    await import("./database/schemaUpdates.js");
    console.log("DONE");
}
test();
