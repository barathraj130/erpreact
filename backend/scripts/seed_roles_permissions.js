import db from '../database/pg.js';

const ROLES = [
    { name: 'Admin', desc: 'Full System Access' },
    { name: 'Manager', desc: 'Operational Oversight' },
    { name: 'Accountant', desc: 'Financial Management' },
    { name: 'Sales Staff', desc: 'Order Processing' },
    { name: 'Purchase Staff', desc: 'Procurement Management' },
    { name: 'View Only', desc: 'Read-only access to all modules' }
];

const MODULES = ['Sales', 'Purchases', 'Inventory', 'Finance', 'Employees', 'Reports', 'Admin Setup'];
const ACTIONS = ['View', 'Create', 'Edit', 'Delete'];

async function seed() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');

        console.log('🌱 Seeding Roles...');
        const roleIds = {};
        for (const role of ROLES) {
            const res = await client.query(
                'INSERT INTO roles (name, description) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET description = $2 RETURNING id',
                [role.name, role.desc]
            );
            roleIds[role.name] = res.rows[0].id;
        }

        console.log('🌱 Seeding Permissions...');
        const permissionIds = [];
        for (const module of MODULES) {
            for (const action of ACTIONS) {
                const res = await client.query(
                    'INSERT INTO permissions (module, action, description) VALUES ($1, $2, $3) ON CONFLICT (module, action) DO NOTHING RETURNING id',
                    [module, action, `${action} ${module}`]
                );
                if (res.rows.length > 0) {
                    permissionIds.push(res.rows[0].id);
                } else {
                    // Fetch existing if already exists
                    const existing = await client.query(
                        'SELECT id FROM permissions WHERE module = $1 AND action = $2',
                        [module, action]
                    );
                    permissionIds.push(existing.rows[0].id);
                }
            }
        }

        // Add special permissions
        const specialPerms = [
            { module: 'Employees', action: 'Confirm Attendance', desc: 'Manager permission to confirm daily attendance' },
            { module: 'Finance', action: 'Day Closing', desc: 'Permission to perform day closing operations' }
        ];
        for (const sp of specialPerms) {
            const res = await client.query(
                'INSERT INTO permissions (module, action, description) VALUES ($1, $2, $3) ON CONFLICT (module, action) DO NOTHING RETURNING id',
                [sp.module, sp.action, sp.desc]
            );
             if (res.rows.length > 0) {
                permissionIds.push(res.rows[0].id);
            } else {
                const existing = await client.query(
                    'SELECT id FROM permissions WHERE module = $1 AND action = $2',
                    [sp.module, sp.action]
                );
                permissionIds.push(existing.rows[0].id);
            }
        }

        console.log('🌱 Mapping Role Permissions...');
        for (const pid of permissionIds) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [roleIds['Admin'], pid]
            );
        }

        const viewPerms = await client.query("SELECT id FROM permissions WHERE action = 'View'");
        for (const row of viewPerms.rows) {
            await client.query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [roleIds['View Only'], row.id]
            );
        }

        const managerPerms = await client.query("SELECT id FROM permissions WHERE NOT (module = 'Admin Setup' AND action = 'Delete')");
        for (const row of managerPerms.rows) {
             await client.query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [roleIds['Manager'], row.id]
            );
        }

        await client.query('COMMIT');
        console.log('✅ Seeding Complete!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding Failed:', err);
    } finally {
        client.release();
        process.exit(0);
    }
}

seed();
