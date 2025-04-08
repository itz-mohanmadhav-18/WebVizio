import rateUI from "./analyser.js";
import cloneRepo from "./cloneRepo.js";
import startServerAndCapture from "./takeScreenShots.js";
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        // Step 1: Clone the repository
        await cloneRepo();

        // Step 2: Start server and capture screenshots
        await startServerAndCapture();

        // Step 3: Rate the UI
        const result = await rateUI(path.join(__dirname, './screenshots/about_page3_full.png'));



        if (result) {
            console.log("Analysis completed successfully");
            process.exit();
        }

    } catch (error) {
        console.error("Error running the script:", error);
        process.exit();
    }
}

run();
