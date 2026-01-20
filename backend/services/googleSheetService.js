// backend/services/googleSheetService.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
require('dotenv').config();

// Configuration for JWT authentication
const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Handle key formatting from environment variable
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

/**
 * Initializes and loads a Google Spreadsheet document.
 * @param {string} sheetId The ID of the spreadsheet.
 * @returns {GoogleSpreadsheet} The loaded document object.
 */
async function loadSheet(sheetId) {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        throw new Error("Google Sheet credentials not configured in environment variables.");
    }
    
    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
    await doc.loadInfo(); // Loads document properties and sheets
    return doc;
}

/**
 * Example function: Appends a new row to a specified sheet.
 * @param {string} sheetId 
 * @param {string} sheetTitle 
 * @param {object} rowData 
 */
async function appendRowToSheet(sheetId, sheetTitle, rowData) {
    try {
        const doc = await loadSheet(sheetId);
        const sheet = doc.sheetsByTitle[sheetTitle];
        
        if (!sheet) {
            throw new Error(`Sheet titled "${sheetTitle}" not found in document.`);
        }

        const addedRow = await sheet.addRow(rowData);
        console.log(`Row added successfully to Google Sheet: ${addedRow._rowNumber}`);
        return addedRow;

    } catch (error) {
        console.error("Error interacting with Google Sheet:", error.message);
        throw new Error(`Google Sheet operation failed: ${error.message}`);
    }
}

module.exports = {
    loadSheet,
    appendRowToSheet,
    // Add other functions like getRows, updateRow, etc.
};