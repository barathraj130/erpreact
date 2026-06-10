// backend/services/aiQueryService.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { getDynamicSchema } from "./schemaService.js";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AI_KEY_NOT_SET");

/**
 * AI Query Engine: Transparently transforms NL -> Structured JSON Query
 */
export const transformNLToQuery = async (userQuery) => {
    // 1. Get current schema context
    const fullSchema = await getDynamicSchema();
    
    // 2. COMPACT SCHEMA for the AI
    const compactSchema = {};
    for (const [table, info] of Object.entries(fullSchema)) {
        compactSchema[table] = {
            cols: info.columns.map(c => c.name),
            rels: info.relationships.map(r => `${r.column}->${r.referencesTable}.${r.referencesColumn}`)
        };
    }

    // 3. Build the AI context
    const model = genAI.getGenerativeModel({ 
        model: "gemini-flash-latest",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
        You are an ERP Data Expert. Convert this Natural Language query into a Structured JSON Query.
        
        SCHEMA (Table: [Columns], [ForeignKeys]):
        ${JSON.stringify(compactSchema, null, 1)}

        QUERY: "${userQuery}"

        FORMAT:
        {
          "entities": ["table_name"],
          "fields": ["column_name"],
          "filters": [{ "field": "column_name", "operator": "=", "value": any }],
          "aggregations": [{ "func": "SUM|COUNT|AVG", "field": "column_name" }],
          "groupBy": [],
          "sort": [],
          "limit": 100,
          "relationships": [{ "from": "tableA", "to": "tableB", "on": "foreign_key_col" }]
        }

        RULES:
        1. Only use schema tables/columns.
        2. Identify necessary Joins. Use the relationships provided.
        3. If impossible, return { "error": "Reason" }.
        4. Date format: YYYY-MM-DD.
    `;

    try {
        console.log("--> Sending prompt to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log("--> AI Interpretation:", text);
        return JSON.parse(text);
    } catch (err) {
        console.error("AI Query Transformation Error:", err);
        throw new Error("Failed to interpret query.");
    }
};
