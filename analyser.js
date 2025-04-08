import fs from 'fs';
import path from 'path';
import axios from "axios";
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Get __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function rateUI(imagePath, retries = 10) {
    const imageData = fs.readFileSync(imagePath).toString('base64');

    const payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: `Analyze this webpage screenshot and rate it out of 100 based on the following criteria:
Design: Assess the overall aesthetic, symmetry, and balance of the page, including elements like navigation bars, footer, body content, and images.
Usability: Evaluate the clarity of navigation, ease of access to important sections, and intuitive design of interactive elements.
Accessibility: Rate the color contrast for readability, proper use of accessible fonts, and the presence of design elements that support all users, including those with disabilities.
Ensure that the webpage includes all necessary elements like navigation bars, a footer, and a well-structured body layout. The color contrast should be good, with clear boundaries and symmetrical edges. Provide a score out of 100 for each category and summarize the strengths and weaknesses in the design, usability, and accessibility of the webpage.
give me marks only no explanation needed average too `
                    },
                    {
                        inline_data: {
                            mime_type: "image/png",
                            data: imageData
                        }
                    }
                ]
            }
        ]
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`Attempt ${attempt} to send request...`);
            const response = await axios.post(MODEL_URL, payload, {
                headers: { "Content-Type": "application/json" }
            });

            // Access the actual content from the response
            const analysis = response.data.candidates[0].content.parts[0].text;
            console.log("UI Analysis:", analysis);
            return analysis;
        } catch (error) {
            if (error.response && error.response.status === 503) {
                console.log(`Model overloaded, retrying in ${attempt * 2} seconds...`);
                await new Promise(resolve => setTimeout(resolve, attempt * 2000));
            } else {
                console.error("Error:", error.response ? error.response.data : error.message);
                break;
            }
        }
    }
    console.error("All retries failed. Try again later.");
}

// Run analysis
// rateUI(path.join(__dirname, './screenshots/about_page3_full.png'))
//     .then(result => {
//         if (result) console.log("Analysis completed successfully");
//     })
//     .catch(error => console.error("Error running analysis:", error));

export default rateUI;