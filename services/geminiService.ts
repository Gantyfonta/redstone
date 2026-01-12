
import { GoogleGenAI } from "@google/genai";
import { GridData } from "../types";

export const analyzeCircuit = async (grid: GridData): Promise<string> => {
  // Use gemini-3-pro-preview for complex reasoning tasks like redstone logic analysis as per guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Convert grid to a readable summary for the AI
  const gridSummary = Object.entries(grid)
    .filter(([_, tile]) => tile.type !== 'AIR')
    .map(([coord, tile]) => `${tile.type} at ${coord} (dir: ${tile.direction}, active: ${tile.active})`)
    .join('\n');

  if (!gridSummary) return "The lab is empty. Place some redstone components to begin!";

  const prompt = `
    Analyze this 2D Minecraft Redstone circuit and explain what it likely does.
    Components list:
    ${gridSummary}
    
    Provide a brief, technical but fun summary as if you are a master Redstone Engineer.
    If you see common patterns (like an AND gate, clock, or T-Flip-Flop), mention them.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Minecraft Redstone Engineer. You analyze circuits and explain logic gates.",
        temperature: 0.7,
      }
    });
    // Property access on .text directly from the response object
    return response.text || "I'm stumped! That's quite a complex contraption.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The Redstone signal to the AI was interrupted. Try again later!";
  }
};
