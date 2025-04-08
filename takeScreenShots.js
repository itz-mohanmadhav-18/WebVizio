import path from "path";
import fs from "fs";
import puppeteer from "puppeteer";
import { exec } from "child_process";
import chalk from "chalk";

const screenshotsDir = path.join(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
}

async function captureSegmentedScreenshot(page, baseFilename, index) {
    const viewportHeight = page.viewport().height;
    const viewportWidth = page.viewport().width;

    const totalHeight = await page.evaluate(() => {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );
    });

    const totalWidth = await page.evaluate(() => {
        return Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth
        );
    });

    let segmentIndex = 1;

    for (let y = 0; y < totalHeight; y += viewportHeight) {
        for (let x = 0; x < totalWidth; x += viewportWidth) {
            await page.evaluate((x, y) => {
                window.scrollTo(x, y);
            }, x, y);

            await new Promise(resolve => setTimeout(resolve, 500));

            const filename = `${baseFilename}_page${index}_segment${segmentIndex}.png`;
            await page.screenshot({
                path: path.join(screenshotsDir, filename),
                clip: {
                    x: x,
                    y: y,
                    width: Math.min(viewportWidth, totalWidth - x),
                    height: Math.min(viewportHeight, totalHeight - y)
                }
            });

            console.log(chalk.green(`✓ Captured segment ${segmentIndex} of page ${index}`));
            segmentIndex++;
        }
    }

    const fullPageFilename = `${baseFilename}_page${index}_full.png`;
    await page.screenshot({
        path: path.join(screenshotsDir, fullPageFilename),
        fullPage: true
    });
}

async function captureScreenshots(url) {
    console.log(chalk.blue('Launching browser...'));
    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1920, height: 1080 }
    });
    const page = await browser.newPage();

    try {
        console.log(chalk.blue(`Navigating to ${url}...`));
        await page.goto(url, { waitUntil: 'networkidle0' });

        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href^="#"]'))
                .map(link => link.getAttribute('href'))
                .filter(href => href && href !== '#');
        });

        const uniqueLinks = [...new Set(links)].map(hash => `${url}${hash}`);

        if (uniqueLinks.length > 0) {
            console.log(chalk.green(`Found ${uniqueLinks.length} unique pages to screenshot`));
            for (let i = 0; i < uniqueLinks.length; i++) {
                const link = uniqueLinks[i];
                try {
                    console.log(chalk.blue(`Processing page ${i + 1}/${uniqueLinks.length}: ${link}`));
                    await page.goto(link, { waitUntil: 'networkidle0', timeout: 30000 });
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));

                    const hash = new URL(link).hash.replace('#', '') || 'home';
                    const baseFilename = hash.replace(/\W+/g, '_');

                    await captureSegmentedScreenshot(page, baseFilename, i + 1);
                    console.log(chalk.green(`✓ Completed page ${i + 1}`));
                } catch (error) {
                    console.error(chalk.red(`Failed to capture ${link}: ${error.message}`));
                }
            }
        } else {
            console.log(chalk.green('Single page website detected, capturing segmented screenshots...'));
            await captureSegmentedScreenshot(page, 'single_page', 1);
        }
    } catch (error) {
        console.error(chalk.red(`Error during screenshot capture: ${error.message}`));
    } finally {
        await browser.close();
    }
}

function startServerAndCapture() {
    return new Promise((resolve, reject) => {
        const server = exec('http-server repo', async (error, stdout, stderr) => {
            if (error) {
                console.error(chalk.red(`Server Error: ${error.message}`));
                reject(error);
                return;
            }
        });

        setTimeout(async () => {
            try {
                await captureScreenshots('http://localhost:8080');
                console.log(chalk.green('Screenshot capture complete!'));
                server.kill();
                resolve();
            } catch (error) {
                console.error(chalk.red(`Fatal error: ${error.message}`));
                server.kill();
                reject(error);
            }
        }, 1000);
    });
}

export default startServerAndCapture;
