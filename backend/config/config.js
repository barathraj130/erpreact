// backend/config/config.js
// General configuration settings (non-secret)
module.exports = {
    app: {
        name: "ERP System PG Backend",
        version: "1.0.0",
        defaultPort: 3000
    },
    // Example: Inventory management thresholds
    inventory: {
        lowStockWarningRatio: 0.15, // Warn if stock is below 15% of reorder level
        defaultUnitId: 1 // Assuming ID 1 is the default unit (e.g., 'PCS')
    }
};