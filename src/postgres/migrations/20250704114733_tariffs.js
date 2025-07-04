/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable("tariffs", (table) => {
        table.increments("id").primary();
        table.string("warehouse_name").notNullable();
        table.date("date").notNullable();

        table.decimal("delivery_and_storage_expr", 10, 2);
        table.decimal("delivery_base", 10, 2);
        table.decimal("delivery_liter", 10, 2);
        table.decimal("storage_base", 10, 2);
        table.decimal("storage_liter", 10, 2);

        table.timestamp("updated_at").defaultTo(knex.fn.now());

        table.unique(["warehouse_name", "date"]);
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable("tariffs");
}
