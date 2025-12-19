const { tryApiCall } = require("./dist/utils.js");

// Simulate gemini-3 404 by using invalid model
const apiKey = process.env.GEMINI_API_KEY;
const v1beta = "https://generativelanguage.googleapis.com/v1beta/models";
const v1 = "https://generativelanguage.googleapis.com/v1/models";

async function test() {
  console.log("Testing fallback logic...");
  
  // Try fake model (should 404)
  const fake = await fetch(
    `${v1beta}/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
    }
  );
  
  console.log("gemini-3-flash-preview status:", fake.status);
  if (!fake.ok) {
    console.log("Error:", await fake.text());
  }
  
  // Try fallback model
  const fallback = await fetch(
    `${v1}/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "respond with just: fallback works" }] }] })
    }
  );
  
  console.log("\ngemini-2.5-flash status:", fallback.status);
  if (fallback.ok) {
    const data = await fallback.json();
    console.log("Response:", data.candidates[0].content.parts[0].text);
  }
}

test();
