// backend/services/aiReportingService.js
import * as db from "../database/pg.js";

const GROQ_API_KEY = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Tables that have company_id for multi-tenant security filtering
const TENANT_TABLES = new Set([
    "invoices", "products", "customers", "purchase_bills", "employees",
    "attendance_logs", "payroll_runs", "ledger_entries", "ledger_groups",
    "ledgers", "transactions", "business_agreements", "lenders",
    "bank_details", "branches", "salary_advances", "advance_repayments",
    "constraints", "throughput_metrics", "constraint_actions"
]);

/**
 * 1. COMPACT SCHEMA LEARNER
 * Returns a compact schema to minimize LLM prompt size
 */
async function getCompactSchema() {
    try {
        const columns = await db.pgAll(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name NOT IN ('refresh_tokens', 'audit_log', 'system_configs')
            ORDER BY table_name, ordinal_position;
        `);

        const schema = {};
        columns.forEach(col => {
            if (!schema[col.table_name]) schema[col.table_name] = [];
            const shortType = col.data_type
                .replace('character varying', 'varchar')
                .replace('timestamp without time zone', 'timestamp')
                .replace('numeric', 'number');
            schema[col.table_name].push(`${col.column_name}(${shortType})`);
        });

        return Object.entries(schema)
            .map(([table, cols]) => `${table}: ${cols.slice(0, 12).join(', ')}`)
            .join('\n');
    } catch (err) {
        console.error("Schema Learning Failed:", err);
        return null;
    }
}

/**
 * 2. AI PARSING LOGIC
 * Converts natural language to Universal Structured Query Format (USQF)
 */
async function parseUserQuery(userPrompt, userContext = {}) {
    const schema = await getCompactSchema();
    if (!schema) throw new Error("Could not load system schema");

    const systemPrompt = `You are an ERP SQL analyst. Convert user queries to JSON.
SCHEMA:
${schema}

Return ONLY valid JSON matching this format exactly:
{
  "entities": ["table_name"],
  "fields": ["table.column"],
  "filters": [{"field": "table.col", "operator": "=", "value": "x"}],
  "aggregations": [{"type": "SUM", "field": "table.col", "alias": "total"}],
  "groupBy": ["expression"],
  "sort": [{"field": "alias_or_col", "direction": "DESC"}],
  "relationships": ["t1.col = t2.col"],
  "limit": 50,
  "summaryLabel": "Brief report title",
  "chartSuggestion": "TABLE"
}
Rules:
- chartSuggestion must be: TABLE, BAR, LINE, or PIE
- Use standard SQL functions (DATE_TRUNC, EXTRACT, TO_CHAR) in fields array as strings like "TO_CHAR(invoices.invoice_date, 'YYYY-MM') AS month"
- Only use tables and columns from SCHEMA
- If the query is unclear, return {"error": "CLARIFICATION_NEEDED", "message": "explain here"}`;

    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
            max_tokens: 1500
        })
    });

    const rawText = await response.text();
    console.log("Groq Status:", response.status);

    if (!response.ok) {
        console.error("Groq API Error:", rawText.slice(0, 300));
        throw new Error(`Groq API ${response.status}: ${rawText.slice(0, 200)}`);
    }

    const result = JSON.parse(rawText);
    const content = result.choices[0].message.content;
    console.log("AI Response Preview:", content.slice(0, 300));
    return JSON.parse(content);
}

/**
 * 3. SAFE SQL BUILDER
 * Converts USQF to optimized, secure SQL
 */
function buildSQLFromUSQF(usq, companyId) {
    if (usq.error) return null;

    // Build SELECT clause
    const selectParts = [];
    if (usq.fields && usq.fields.length > 0) {
        usq.fields.forEach(f => selectParts.push(f));
    }
    if (usq.aggregations && usq.aggregations.length > 0) {
        usq.aggregations.forEach(agg => {
            const alias = agg.alias || `${agg.type.toLowerCase()}_val`;
            selectParts.push(`${agg.type}(${agg.field}) AS "${alias}"`);
        });
    }
    const selectClause = selectParts.length > 0 ? selectParts.join(", ") : "*";

    // Build FROM clause
    const entities = usq.entities && usq.entities.length > 0 ? usq.entities : ["invoices"];
    const fromClause = entities.join(", ");

    // Build WHERE clause - only tenant tables get company_id filter
    const whereParts = [];
    entities.forEach(entity => {
        if (TENANT_TABLES.has(entity)) {
            whereParts.push(`${entity}.company_id = ${parseInt(companyId)}`);
        }
    });

    // Add join conditions
    if (usq.relationships && usq.relationships.length > 0) {
        usq.relationships.forEach(r => whereParts.push(r));
    }

    // Add user-specified filters
    if (usq.filters && usq.filters.length > 0) {
        usq.filters.forEach(filter => {
            let val = filter.value;
            if (typeof val === 'string' && !val.includes("'") && !val.match(/^\d+$/)) {
                val = `'${val}'`;
            }
            const op = filter.operator === '==' ? '=' : (filter.operator || '=');
            whereParts.push(`${filter.field} ${op} ${val}`);
        });
    }

    let sql = `SELECT ${selectClause} FROM ${fromClause}`;
    if (whereParts.length > 0) sql += ` WHERE ${whereParts.join(" AND ")}`;
    if (usq.groupBy && usq.groupBy.length > 0) sql += ` GROUP BY ${usq.groupBy.join(", ")}`;
    if (usq.sort && usq.sort.length > 0) sql += ` ORDER BY ${usq.sort.map(s => `${s.field} ${s.direction}`).join(", ")}`;
    sql += ` LIMIT ${usq.limit || 100}`;

    return sql;
}

/**
 * 4. FINAL EXECUTION LAYER
 */
export async function runAIPoweredReport(userPrompt, context) {
    const { company_id } = context;

    const structuredQuery = await parseUserQuery(userPrompt, context);
    console.log("USQF Generated:", JSON.stringify(structuredQuery, null, 2));

    if (structuredQuery.error) {
        return {
            type: "INTERACTIVE",
            mode: "CLARIFICATION",
            message: structuredQuery.message || "Could you clarify your request?"
        };
    }

    const sql = buildSQLFromUSQF(structuredQuery, company_id);
    console.log("Executing SQL:", sql);

    try {
        const data = await db.pgAll(sql);
        return {
            type: "DYNAMIC_DATA",
            metadata: {
                title: structuredQuery.summaryLabel || "Custom Report",
                intent: userPrompt,
                ui_suggestion: structuredQuery.chartSuggestion || "TABLE",
                totalRows: data.length,
                sql_preview: sql
            },
            payload: data
        };
    } catch (sqlErr) {
        console.error("SQL Execution Error:", sqlErr.message, "\nSQL:", sql);
        return {
            type: "INTERACTIVE",
            mode: "SQL_ERROR",
            message: `Query couldn't be executed. Try rephrasing: "${userPrompt}". Error: ${sqlErr.message}`
        };
    }
}
