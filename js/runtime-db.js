/**
 * Runtime Database Helper - In-memory storage (no persistence)
 * This is a fallback for when MongoDB server is not available
 * For production, use the MongoDB backend at server/
 * 
 * NOTE: This runtime version is compatible with the MongoDB schema structure
 * All data is lost on page refresh - use MongoDB for persistence
 */

(function() {
    'use strict';

    // In-memory database storage
    const memoryDB = {
        patients: [],
        doctors: [],
        appointments: [],
        appointments_history: [],
        encounters: [],
        prescriptions: [],
        invoices: [],
        inventory: [],
        analytics: [],
        dental_charts: [],
        dental_chart_history: [],
        users: [
            { id: '1', email: 'user@pakteeth.com', password: 'userpakteeth', name: 'Admin User', role: 'admin', permissions: ['dashboard', 'patients', 'appointments', 'doctors', 'encounters', 'prescriptions', 'billing', 'inventory', 'analytics', 'settings', 'capital'] }
        ]
    };

    // Simple ID generator
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // DB_HELPER API
    window.DB_HELPER = {
        // Table operations
        getAll: function(table) {
            return memoryDB[table] || [];
        },

        getById: function(table, id) {
            const items = memoryDB[table] || [];
            return items.find(item => item.id === id);
        },

        add: function(table, item) {
            if (!memoryDB[table]) memoryDB[table] = [];
            if (!item.id) item.id = generateId();
            item.createdAt = new Date().toISOString();
            memoryDB[table].push(item);
            return item;
        },

        update: function(table, id, updates) {
            if (!memoryDB[table]) return null;
            const index = memoryDB[table].findIndex(item => item.id === id);
            if (index === -1) return null;
            memoryDB[table][index] = { ...memoryDB[table][index], ...updates, updatedAt: new Date().toISOString() };
            return memoryDB[table][index];
        },

        delete: function(table, id) {
            if (!memoryDB[table]) return false;
            const index = memoryDB[table].findIndex(item => item.id === id);
            if (index === -1) return false;
            memoryDB[table].splice(index, 1);
            return true;
        },

        clearTable: function(table) {
            memoryDB[table] = [];
        },

        query: function(table, filterFn) {
            const items = memoryDB[table] || [];
            return filterFn ? items.filter(filterFn) : items;
        },

        // User operations
        getAllUsers: function() {
            return memoryDB.users;
        },

        getUser: function(email) {
            return memoryDB.users.find(u => u.email === email);
        },

        getUserById: function(id) {
            return memoryDB.users.find(u => u.id === id);
        },

        addUser: function(email, password, name, role, permissions) {
            const existing = this.getUser(email);
            if (existing) return null;
            const user = {
                id: generateId(),
                email,
                password,
                name,
                role: role || 'staff',
                permissions: permissions || ['dashboard']
            };
            memoryDB.users.push(user);
            return user;
        },

        updateUser: function(id, updates) {
            const index = memoryDB.users.findIndex(u => u.id === id);
            if (index === -1) return null;
            memoryDB.users[index] = { ...memoryDB.users[index], ...updates };
            return memoryDB.users[index];
        },

        deleteUser: function(id) {
            const index = memoryDB.users.findIndex(u => u.id === id);
            if (index === -1) return false;
            memoryDB.users.splice(index, 1);
            return true;
        },

        // Export/Import (for backup/restore)
        export: function() {
            return JSON.stringify(memoryDB, null, 2);
        },

        importData: function(jsonString) {
            try {
                const data = JSON.parse(jsonString);
                Object.keys(data).forEach(key => {
                    if (memoryDB.hasOwnProperty(key)) {
                        memoryDB[key] = data[key];
                    }
                });
                return true;
            } catch (e) {
                console.error('Import failed:', e);
                return false;
            }
        }
    };

    // Active sessions tracking (runtime only)
    window.ACTIVE_SESSIONS = {
        activeUsers: new Set(),

        login: function(email) {
            this.activeUsers.add(email);
        },

        logout: function(email) {
            this.activeUsers.delete(email);
        },

        isUserActive: function(email) {
            return this.activeUsers.has(email);
        }
    };

    // APP object for authentication and navigation
    window.APP = {
        currentUser: null,

        ensureAuth: function() {
            // Runtime-only auth - no persistent storage check
            // In a real app, you might use session cookies or tokens
            // For this demo, we allow access but track current user
            if (!this.currentUser) {
                // Default to demo user for testing
                this.currentUser = memoryDB.users[0];
                ACTIVE_SESSIONS.login(this.currentUser.email);
            }
        },

        login: function(email, password) {
            const user = DB_HELPER.getUser(email);
            if (user && user.password === password) {
                this.currentUser = user;
                ACTIVE_SESSIONS.login(email);
                return true;
            }
            return false;
        },

        logout: function() {
            if (this.currentUser) {
                ACTIVE_SESSIONS.logout(this.currentUser.email);
                this.currentUser = null;
            }
            window.location.href = '../../index.html';
        },

        hasPermission: function(permission) {
            if (!this.currentUser) return false;
            const perms = this.currentUser.permissions || [];
            return perms.includes(permission);
        }
    };

    // Mark database as ready
    window.dbReady = true;

    console.log('Runtime DB initialized - all data is in-memory only');
})();
