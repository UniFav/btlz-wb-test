import cron from "node-cron";
import { WBTariffsSync } from "#services/WBTariffsSync.js";
import { TariffSheetSyncService } from "#services/GoogleTablesSync.js";
import { google } from "googleapis";
import env from "#config/env/env.js";
import { logger } from "#logger.js";

export async function startCron() {
    const wbTariffSync = new WBTariffsSync();

    const auth = new google.auth.GoogleAuth({
        keyFilename: env.GOOGLE_API_CREDENTIALS_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheetsClient = google.sheets({ version: "v4", auth });

    const spreadsheetIds = env.GOOGLE_SHEETS_IDS;

    cron.schedule("0 * * * *", async () => {
        logger.info("Running hourly job: WB Tariff Sync and Google Sheets update");

        try {
            await wbTariffSync.sync();
            logger.info("✔️ Tariffs fetched and saved to DB");

            for (const spreadsheetId of spreadsheetIds) {
                const sheetSync = new TariffSheetSyncService({
                    sheetsClient,
                    spreadsheetId,
                });

                await sheetSync.sync();
            }
        } catch (error) {
            logger.error("❌ Cron job error:", error);
        }
    });

    logger.info("✅ Cron job scheduled to run every hour");
}
