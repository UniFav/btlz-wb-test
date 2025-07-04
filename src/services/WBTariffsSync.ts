/**
 * Service for syncing tariff data from the Wildberries (WB) API
 * into the local PostgreSQL database.
 * 
 * Fetches tariffs for the current date via WB API,
 * parses and converts values,
 * then inserts or updates the local "tariffs" table in chunks.
 * Implements retry logic for HTTP requests.
 */

import axios, { AxiosInstance } from "axios";
import axiosRetry from "axios-retry";
import knex from "#postgres/knex.js";
import env from "#config/env/env.js";
import { TariffBox } from "#types.js";
import { logger } from "../logger.js";

export class WBTariffsSync {
  private axiosInstance: AxiosInstance;

  /**
   * Initializes the HTTP client with base URL, timeout, 
   * authorization header and retry policy.
   */
  constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://common-api.wildberries.ru/api/v1",
      timeout: 10000,
      headers: {
        Authorization: env.WB_API_KEY,
      },
    });

    axiosRetry(this.axiosInstance, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) =>
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.code === "ECONNABORTED",
    });
  }

  /**
   * Parses a string that represents a number with comma decimal separator
   * into a float number or returns null if parsing fails or input is invalid.
   * Logs a warning if conversion fails.
   * 
   * @param value Numeric string to parse, or null/undefined.
   * @returns Parsed number or null.
   */
  private parseNumeric(value: string | null | undefined): number | null {
    if (!value || value.trim() === "-") {
      return null;
    }

    const parsed = parseFloat(value.replace(",", "."));

    if (isNaN(parsed)) {
      logger.warn({ value }, "❗ Failed to convert value to number");
      return null;
    }

    return parsed;
  }

  /**
   * Fetches tariffs for the current date from the WB API,
   * parses and maps the response to TariffBox objects,
   * then inserts or updates them in the local database.
   * Handles errors and logs progress.
   */
  public async sync(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    logger.info(`🚚 Starting WB tariffs sync for ${today}`);

    try {
      const response = await this.axiosInstance.get(`/tariffs/box?date=${today}`);

      const warehouseList = response?.data?.response?.data?.warehouseList;
      if (!Array.isArray(warehouseList)) {
        logger.warn("⚠️ Invalid data format from WB API");
        return;
      }

      const tariffs: TariffBox[] = warehouseList.map((w: any) => ({
        warehouse_name: w.warehouseName,
        delivery_base: this.parseNumeric(w.boxDeliveryBase),
        delivery_liter: this.parseNumeric(w.boxDeliveryLiter),
        delivery_and_storage_expr: this.parseNumeric(w.boxDeliveryAndStorageExpr),
        storage_base: this.parseNumeric(w.boxStorageBase),
        storage_liter: this.parseNumeric(w.boxStorageLiter),
        date: today,
        updated_at: new Date(),
      }));

      logger.info(`📦 Found ${tariffs.length} tariffs to insert/update`);

      const chunkSize = 100;
      for (let i = 0; i < tariffs.length; i += chunkSize) {
        const chunk = tariffs.slice(i, i + chunkSize);
        await knex("tariffs").insert(chunk).onConflict(["warehouse_name", "date"]).merge();
      }

      logger.info("✅ WB tariffs sync completed");
    } catch (err: any) {
      logger.error({ err }, "❌ Error occurred during WB tariffs sync");
    }
  }
}