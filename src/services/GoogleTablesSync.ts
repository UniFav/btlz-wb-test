/**
 * Service for syncing tariff data from a PostgreSQL database
 * to a Google Sheets spreadsheet.
 * 
 * Fetches tariff data from the "tariffs" table,
 * formats it, and writes it to the specified Google Sheets tab.
 * Supports retry attempts on failures.
 */

import { logger } from "#logger.js";
import { TariffBox } from "#types.js";
import { sheets_v4 } from "googleapis";
import knex from "#postgres/knex.js";

interface TariffSheetSyncServiceParams {
    sheetsClient: sheets_v4.Sheets;
    spreadsheetId: string;
    sheetName?: string;
    maxRetries?: number;
}

export class TariffSheetSyncService {
    private sheetsClient: sheets_v4.Sheets;
    private spreadsheetId: string;
    private sheetName: string;
    private maxRetries: number;

    /**
     * Constructor for the sync service.
     * @param params Object with parameters:
     *  - sheetsClient: Google Sheets API client.
     *  - spreadsheetId: ID of the Google spreadsheet.
     *  - sheetName: name of the sheet/tab to write data to (default is "stocks_coefs").
     *  - maxRetries: maximum retry attempts on failure (default is 3).
     */
    constructor({ sheetsClient, spreadsheetId, sheetName = "stocks_coefs", maxRetries = 3 }: TariffSheetSyncServiceParams) {
        this.sheetsClient = sheetsClient;
        this.spreadsheetId = spreadsheetId;
        this.sheetName = sheetName;
        this.maxRetries = maxRetries;
    }

    /**
     * Retrieves tariff data from the "tariffs" table in the database.
     * The data is sorted ascending by the "delivery_liter" field.
     * @returns Promise resolving to an array of TariffBox objects.
     */
    private async getTariffData(): Promise<TariffBox[]> {
        return knex<TariffBox>("tariffs").select("*").orderBy("delivery_liter", "asc");
    }

    /**
     * Formats a given value into a string with two decimal places,
     * using a comma as the decimal separator.
     * Returns null if the value is not a valid number.
     * @param value The value to format.
     * @returns Formatted string or null.
     */
    private formatNumber(value: unknown): string | null {
        const num = Number(value);

        if (isNaN(num)) return null;

        return num.toFixed(2).replace(".", ",");
    }

    /**
     * Formats a date into a string in "DD.MM.YYYY" format.
     * Returns null if the input is null or invalid.
     * @param iso Date in ISO string, Date object, or null.
     * @returns Formatted date string or null.
     */
    private formatDate(iso: string | Date | null): string | null {
        if (!iso) return null;
        const date = new Date(iso);
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Builds a 2D array of values for writing to Google Sheets,
     * including headers and tariff data rows.
     * @param data Array of tariff objects.
     * @returns 2D array of strings, numbers, or nulls formatted for Sheets.
     */
    private formatRows(data: TariffBox[]): (string | number | null)[][] {
        const headers = ["Date", "Warehouse", "DeliveryBase", "DeliveryLiter", "DeliveryAndStorageExpr", "StorageBase", "StorageLiter"];

        const rows = data.map((row) => [
            this.formatDate(row.date),
            row.warehouse_name,
            this.formatNumber(row.delivery_base),
            this.formatNumber(row.delivery_liter),
            this.formatNumber(row.delivery_and_storage_expr),
            this.formatNumber(row.storage_base),
            this.formatNumber(row.storage_liter),
        ]);

        return [headers, ...rows];
    }

    /**
     * Clears the range A1:Z1000 on the specified sheet.
     * @returns Promise resolved after clearing.
     */
    private async clearSheet(): Promise<void> {
        await this.sheetsClient.spreadsheets.values.clear({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A1:Z1000`,
        });
    }

    /**
     * Updates the sheet with the provided values starting from cell A1.
     * Uses USER_ENTERED input option to allow Sheets to auto-format values.
     * @param values 2D array of values to write.
     * @returns Promise resolved after update.
     */
    private async updateSheet(values: (string | number | null)[][]): Promise<void> {
        await this.sheetsClient.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${this.sheetName}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values },
        });
    }

    /**
     * Performs the synchronization process:
     * 1. Fetches data from the database.
     * 2. Formats the data for Google Sheets.
     * 3. Clears the target sheet.
     * 4. Updates the sheet with new data.
     * Retries on failure with exponential backoff delay.
     */
    public async sync(): Promise<void> {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const data = await this.getTariffData();
                const rows = this.formatRows(data);
                await this.clearSheet();
                await this.updateSheet(rows);

                logger.info(`✔️ Synced: ${this.spreadsheetId} (${rows.length - 1} rows)`);
                break;
            } catch (error: unknown) {
                const err = error as Error;
                logger.error({
                    msg: `❌ Attempt ${attempt} failed: ${err.message}`,
                    spreadsheetId: this.spreadsheetId,
                    stack: err.stack,
                });

                if (attempt < this.maxRetries) {
                    const delay = 1000 * Math.pow(2, attempt);
                    logger.warn(`⏳ Retrying in ${delay / 1000}s...`);
                    await new Promise((res) => setTimeout(res, delay));
                } else {
                    logger.error(`🚫 Sync failed after ${this.maxRetries} attempts`);
                }
            }
        }
    }
}