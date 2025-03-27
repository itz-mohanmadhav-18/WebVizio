const simpleGit = require("simple-git");
const { exec } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const puppeteer = require("puppeteer");

const BASE_DIR = path.join(__dirname, "projects"); // Store cloned projects
const SCREENSHOT_DIR = path.join(__dirname, "screenshots"); // Store all screenshots

async function cloneRepo(repoUrl, folderName) {
    const projectPath = path.join(BASE_DIR, folderName);

    if (fs.existsSync(projectPath)) {
        console.log(`🗑️ Removing existing folder: ${folderName}`);
        fs.removeSync(projectPath);
    }

    console.log(`🔄 Cloning ${repoUrl} into ${folderName}...`);
    await simpleGit().clone(repoUrl, projectPath);
    return projectPath;
}

function detectProjectType(projectPath) {
    if (fs.existsSync(path.join(projectPath, "package.json"))) {
        const packageJson = require(path.join(projectPath, "package.json"));
        if (packageJson.dependencies?.react) return "react";
        if (packageJson.dependencies?.express) return "ejs";
        return "node";
    }
    return "static"; // HTML, CSS, JS only
}

function installDependencies(projectPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(path.join(projectPath, "package.json"))) {
            return resolve(); // No dependencies needed
        }

        console.log(`📦 Installing dependencies in ${projectPath}...`);
        exec("npm install", { cwd: projectPath }, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error installing dependencies: ${stderr}`);
                reject(error);
            } else {
                console.log(`✅ Dependencies installed!`);
                resolve();
            }
        });
    });
}

function startServer(projectPath, projectType, port) {
    return new Promise((resolve, reject) => {
        let command = "";

        switch (projectType) {
            case "react":
                command = `npx vite --port=${port}`;
                break;
            case "ejs":
                command = `node index.js`;
                break;
            case "node":
                command = `npm start`;
                break;
            case "static":
                console.log(`🛠️ Static site detected. Starting live-server...`);
                command = `npx live-server --port=${port} --quiet --no-browser`;
                break;
        }

        console.log(`🚀 Starting ${projectType} project on port ${port}...`);
        const process = exec(command, { cwd: projectPath });

        process.stdout.on("data", (data) => console.log(data));
        process.stderr.on("data", (data) => console.error(data));

        setTimeout(() => {
            console.log(`✅ Server should be running on port ${port}`);
            resolve();
        }, 5000); // Give time for the server to start
    });
}

async function getAllRoutes(projectPath, projectType) {
    let routes = ["/"]; // Default home page

    if (projectType === "react") {
        const appJsxPath = path.join(projectPath, "src", "App.jsx");
        if (fs.existsSync(appJsxPath)) {
            const appJsxContent = fs.readFileSync(appJsxPath, "utf8");
            const routeMatches = appJsxContent.match(/path=["'](\/[^"']*)["']/g);
            if (routeMatches) {
                routes = routeMatches.map(route => route.match(/path=["'](\/[^"']*)["']/)[1]);
            }
        }
    } else {
        const indexHtmlPath = path.join(projectPath, "index.html");
        if (fs.existsSync(indexHtmlPath)) {
            const indexHtmlContent = fs.readFileSync(indexHtmlPath, "utf8");
            const linkMatches = indexHtmlContent.match(/href=["'](\/[^"']*)["']/g);
            if (linkMatches) {
                routes = [...routes, ...linkMatches.map(link => link.match(/href=["'](\/[^"']*)["']/)[1])];
            }
        }
    }

    console.log(`🛤️ Found routes:`, routes);
    return routes;
}

async function captureScreenshots(url, projectPath, projectType, role) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const screenshotFolder = path.join(SCREENSHOT_DIR, `${role}_screenshots`);
    
    fs.ensureDirSync(screenshotFolder); // Ensure directory exists

    try {
        await page.goto(url, { waitUntil: "networkidle2" });

        const routes = await getAllRoutes(projectPath, projectType);
        for (let route of routes) {
            const fullUrl = `${url}${route}`;
            console.log(`📸 Capturing screenshot for ${fullUrl}`);
            await page.goto(fullUrl, { waitUntil: "networkidle2" });
            await page.screenshot({ path: path.join(screenshotFolder, `screenshot${route.replace(/\//g, "_")}.png`) });
        }
    } catch (error) {
        console.error(`❌ Error capturing screenshots:`, error);
    } finally {
        await browser.close();
    }
}


async function deploy(studentRepo, teacherRepo) {
    try {
        // Clone repositories
        const studentPath = await cloneRepo(studentRepo, "student_project");
        const teacherPath = await cloneRepo(teacherRepo, "teacher_project");

        // Detect project types
        const studentType = detectProjectType(studentPath);
        const teacherType = detectProjectType(teacherPath);

        console.log(`🎓 Student project type: ${studentType}`);
        console.log(`👨‍🏫 Teacher project type: ${teacherType}`);

        // Install dependencies
        if (studentType !== "static") await installDependencies(studentPath);
        if (teacherType !== "static") await installDependencies(teacherPath);

        // Start servers (use different ports)
        await startServer(studentPath, studentType, 5173);
        await startServer(teacherPath, teacherType, 5174);

        console.log(`✅ Both projects are deployed!`);

        // Capture Screenshots
        await captureScreenshots("http://localhost:5173", studentPath, studentType, "student");
        await captureScreenshots("http://localhost:5174", teacherPath, teacherType, "teacher");

        console.log(`📸 Screenshots taken for both projects.`);
    } catch (error) {
        console.error("❌ Error in deployment:", error);
    }
}

// Example usage (Replace with actual GitHub repo URLs)
const studentRepoURL = "https://github.com/HaR-S-H/spotify-clone.git";
const teacherRepoURL = "https://github.com/HaR-S-H/spotify-clone.git";

deploy(studentRepoURL, teacherRepoURL);
