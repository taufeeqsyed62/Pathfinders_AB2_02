require("dotenv").config();
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";
import cors from "cors";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const app = express();
app.use(cors());
app.use(express.json());

app.post("/template", async (req, res) => {
    const prompt = req.body.prompt;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
    
    const fullPrompt = "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra\n\n" + prompt;

    try {
        const result = await model.generateContent(fullPrompt);
        const answer = (await result.response).text().trim().toLowerCase();

        if (answer === "react") {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
            return;
        }

        if (answer === "node") {
            res.json({
                prompts: [`Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
            return;
        }

        res.status(403).json({ message: "Invalid response from AI" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error processing request" });
    }
});

app.post("/chat", async (req, res) => {
    try {
        const messages = req.body.messages;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
        const systemPrompt = getSystemPrompt();

        // Prepare chat history
        const history = [
            {
                role: "user",
                parts: [{ text: systemPrompt }]
            }
        ];

        // Convert client messages to Gemini format
        for (const msg of messages.slice(0, -1)) {
            history.push({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }]
            });
        }

        // Get last message content
        const lastMessage = messages[messages.length - 1].content;

        // Start chat and send message
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        const text = response.text();

        res.json({
            response: text
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error processing chat request" });
    }
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});