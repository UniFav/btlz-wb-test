export interface TariffBox {
    date: string;
    warehouse_name: string;
    delivery_and_storage_expr: number | null;
    delivery_base: number | null;
    delivery_liter: number | null;
    storage_base: number | null;
    storage_liter: number | null;
}