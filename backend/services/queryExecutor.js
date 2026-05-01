// backend/services/queryExecutor.js
import { pgAll } from '../database/pg.js';

/**
 * Universal Query Executor: JSON -> SQL -> Result with Tenant Isolation
 */
export const executeStructuredQuery = async (queryObject, companyId = null) => {
    try {
        if (queryObject.error) {
            return { error: queryObject.error, status: "Clarification Required" };
        }

        const { entities, fields, filters, aggregations, groupBy, sort, limit, relationships } = queryObject;

        if (!entities || entities.length === 0) {
            throw new Error("No primary entity identified in query.");
        }

        const mainTable = entities[0];
        
        // 1. Core SELECT
        let selectParts = [];
        if (aggregations && aggregations.length > 0) {
            aggregations.forEach((agg, idx) => {
                // Sanitize alias: Remove special chars like * or spaces
                const safeField = agg.field.replace(/[^a-zA-Z0-9_]/g, '_');
                const alias = agg.alias || `${safeField}_${agg.func.toLowerCase()}`;
                selectParts.push(`${agg.func}(${agg.field}) AS ${alias}`);
            });
        }
        
        if (fields && fields.length > 0) {
            // Ensure fields are prefixed/scoped if joins exist (simplified)
            selectParts.push(...fields);
        }

        if (selectParts.length === 0) {
            selectParts.push("*");
        }

        let sql = `SELECT ${selectParts.join(", ")} FROM ${mainTable}`;

        // 2. JOINS
        if (relationships && relationships.length > 0) {
            relationships.forEach(rel => {
                sql += ` LEFT JOIN ${rel.to} ON ${rel.from}.${rel.on} = ${rel.to}.id`;
            });
        }

        // 3. WHERE (Tenant Isolation + Filters)
        const params = [];
        const whereParts = [];

        // ENFORCE TENANT ISOLATION
        if (companyId) {
            params.push(companyId);
            whereParts.push(`${mainTable}.company_id = $${params.length}`);
        }

        if (filters && filters.length > 0) {
            filters.forEach(f => {
                params.push(f.value);
                whereParts.push(`${f.field} ${f.operator} $${params.length}`);
            });
        }

        if (whereParts.length > 0) {
            sql += ` WHERE ${whereParts.join(" AND ")}`;
        }

        // 4. GROUP BY (Auto-fix for non-aggregated fields)
        let effectiveGroupBy = [...(groupBy || [])];
        if (aggregations && aggregations.length > 0 && fields && fields.length > 0) {
            fields.forEach(f => {
                if (!effectiveGroupBy.includes(f)) effectiveGroupBy.push(f);
            });
        }

        if (effectiveGroupBy.length > 0) {
            sql += ` GROUP BY ${effectiveGroupBy.join(", ")}`;
        }

        // 5. ORDER BY
        if (sort && sort.length > 0) {
            const sortParts = sort.map(s => `${s.field} ${s.direction || 'ASC'}`);
            sql += ` ORDER BY ${sortParts.join(", ")}`;
        }

        // 6. LIMIT
        if (limit) {
            sql += ` LIMIT ${parseInt(limit)}`;
        }

        console.log(`🛠️ [Tenant ${companyId}] Executing SQL:`, sql, "Params:", params);
        
        const data = await pgAll(sql, params);

        return {
            data,
            meta: {
                count: data.length,
                sql,
                query: queryObject
            }
        };
    } catch (err) {
        console.error("SQL Execution Error:", err, queryObject);
        throw new Error("Database execution failed: " + err.message);
    }
};
