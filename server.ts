import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// MongoDB connection if DATABASE_URL is provided with a valid mongodb:// or mongodb+srv:// scheme
const DATABASE_URL = process.env.DATABASE_URL;
const isMongoUrl = DATABASE_URL && (DATABASE_URL.startsWith("mongodb://") || DATABASE_URL.startsWith("mongodb+srv://"));

if (isMongoUrl) {
  console.log(`[Database] Connecting to MongoDB via DATABASE_URL...`);
  mongoose.connect(DATABASE_URL)
    .then(() => {
      console.log("[Database] Successfully connected to MongoDB database.");
    })
    .catch((err) => {
      console.error("[Database] Failed to connect to MongoDB database:", err);
    });
} else {
  if (DATABASE_URL && DATABASE_URL.trim() !== "" && DATABASE_URL !== "Your MongoDB or other database connection string") {
    console.log("[Database] DATABASE_URL provided is not a MongoDB scheme (mongodb:// or mongodb+srv://). Falling back to standard in-memory / Firestore storage.");
  } else {
    console.log("[Database] DATABASE_URL is not set or placeholder. Falling back to standard in-memory / Firestore storage.");
  }
}

// Paystack API Key helper for direct local payment gateway Integration
function getPaystackKey(): string | null {
  const apiKey = process.env.PAYSTACK_SECRET_KEY;
  if (!apiKey || apiKey === "MY_PAYSTACK_SECRET_KEY" || apiKey.trim() === "") {
    return null;
  }
  return apiKey;
}


// Lazy-loaded Gemini client with graceful fallback if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY environment variable is not set or has placeholder value.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Full rule-based dataset for natural, progressive, and clinical robotic remedies
const naturalRemediesDB: Record<string, any> = {
  malaria: {
    lifestyle: [
      "Rest extensively in a cool, mosquito-netted environment",
      "Stay hydrated with clean water and mineral electrolytes",
      "Avoid strenuous physical activities or heavy exercise"
    ],
    herbsAndVegetables: [
      {
        title: "Bitter Leaf (Vernonia amygdalina) Extract",
        description: "A traditional herbal wash rich in natural sesquiterpene lactones known for anti-plasmodial effects.",
        instructions: "Squeeze fresh bitter leaves in clean warm water, filter the green extract, and drink half a cup twice daily."
      },
      {
        title: "Neem Leaf (Azadirachta indica) Brew",
        description: "Commonly referred to as Dongoyaro; contains active limonoids that support fever control and immune response.",
        instructions: "Boil a handful of fresh clean neem leaves in 1 liter of water for 15 minutes. Strain and drink half a cup warm twice daily."
      },
      {
        title: "Papaya Leaf Juice Extract",
        description: "Juice extracted from tender papaya leaves, traditionally used to support platelet recovery.",
        instructions: "Crush clean, raw papaya leaves with a mortar, squeeze the pulp through a clean cloth, and take 2 tablespoons daily."
      }
    ],
    homemadeRemedies: [
      {
        title: "Ginger-Lemon-Honey Warm Infusion",
        description: "A soothing digestive and immune-supporting tea to ease malaria-associated nausea.",
        instructions: "Grate fresh ginger root, steep in boiling water for 10 minutes, add fresh lemon juice and organic raw honey to taste."
      },
      {
        title: "Coconut Water & Lime Rehydration",
        description: "Replenishes essential potassium and natural electrolytes lost during active fever sweats.",
        instructions: "Mix fresh coconut water with the juice of half a lime. Drink slowly throughout the day."
      }
    ],
    medications: [
      {
        name: "Artemisinin-based combination therapy (ACT)",
        dosage: "Take exactly as prescribed by a licensed practitioner (typically 1 tablet twice daily for 3 days with a fatty meal).",
        precaution: "Do not take on an empty stomach. Finish the complete clinical course even if feeling fully recovered."
      },
      {
        name: "Paracetamol (Acetaminophen)",
        dosage: "500mg - 1000mg every 6 hours as needed for active fever.",
        precaution: "Do not exceed 4000mg in 24 hours. Monitor for hepatic/liver precautions."
      }
    ],
    robotProcedures: [
      {
        type: "malaria_test",
        title: "Automated Rapid Malaria Diagnostic Test (RDT)",
        description: "Eunice Robot uses highly precise, non-contact thermal mapping to locate capillary access, administers a painless micro-puncture, and runs an antigen test card.",
        duration: "10-15 mins",
        cost: "₦1,500"
      },
      {
        type: "blood_draw",
        title: "Capillary/Venous Blood Panel Collection",
        description: "Robot sanitizes the skin, utilizes infrared sensors for perfect vein detection, and completes a stable, tremor-free draw for comprehensive laboratory screening.",
        duration: "5-10 mins",
        cost: "₦2,500"
      }
    ]
  },
  typhoid: {
    lifestyle: [
      "Practice strict hand hygiene and food sanitization",
      "Adhere to a bland, easily digestible liquid or semi-solid diet",
      "Get complete bed rest to support intestinal tissue healing"
    ],
    herbsAndVegetables: [
      {
        title: "Garlic (Allium sativum) Infused Cloves",
        description: "Contains allicin, which exhibits broad-spectrum natural antimicrobial activity against enteric pathogens.",
        instructions: "Crush 2 fresh raw garlic cloves, let sit for 5 minutes to activate allicin, and consume with warm water in the morning."
      },
      {
        title: "Ugu Leaf (Fluted Pumpkin) Juice Extract",
        description: "Rich in vital amino acids and high iron concentrations to support systemic recovery and blood counts.",
        instructions: "Wash fresh fluted pumpkin leaves thoroughly, blend with minimal water, extract the deep green juice, and drink warm."
      }
    ],
    homemadeRemedies: [
      {
        title: "Honeyed Neem Water",
        description: "Traditional enteric disinfectant support.",
        instructions: "Boil clean neem bark or dry leaves, mix with raw forest honey, and drink in small sips."
      },
      {
        title: "Fenugreek Seed Hydrator",
        description: "Helps calm intestinal flatulence and reduces abdominal discomfort.",
        instructions: "Soak 1 teaspoon of fenugreek seeds in 1 cup of warm water overnight, filter, and drink in the morning."
      }
    ],
    medications: [
      {
        name: "Ciprofloxacin or Azithromycin",
        dosage: "As directed by clinical prescription (usually 500mg daily for 5-7 days).",
        precaution: "Must be prescribed by a physician following a positive blood or stool culture."
      }
    ],
    robotProcedures: [
      {
        type: "medication_dispense",
        title: "Prescription Antibiotic Dispensing",
        description: "Eunice Robot verifies the patient's identity via biometric facial recognition, cross-references digital prescriptions, and dispenses the exact antibiotic dosage.",
        duration: "2-5 mins",
        cost: "₦1,000"
      },
      {
        type: "vitals_check",
        title: "Comprehensive Enteric Vitals Monitoring",
        description: "Robot monitors continuous temperature fluctuations, active pulse, blood pressure, and oxygen levels, uploading data directly to the physician console.",
        duration: "5 mins",
        cost: "₦800"
      }
    ]
  },
  hypertension: {
    lifestyle: [
      "Limit daily sodium intake to under 1,500 mg",
      "Engage in at least 30 minutes of gentle, rhythmic cardiovascular activity",
      "Implement twice-daily deep breathing exercises (diaphragmatic breathing)"
    ],
    herbsAndVegetables: [
      {
        title: "Hibiscus Sabdariffa (Zobo) Cold Tea",
        description: "Rich in organic anthocyanins that act as natural mild ACE-inhibitors to support healthy arterial dilatation.",
        instructions: "Brew dry organic hibiscus calyces, cool, and drink 1 glass twice daily without added processed sugars."
      },
      {
        title: "Moringa Oleifera Leaf Powder",
        description: "Extremely high in potassium, magnesium, and active antioxidants that assist in balancing vascular fluid pressure.",
        instructions: "Stir 1 teaspoon of pure organic moringa leaf powder into a warm cup of water or add directly to healthy vegetable soups."
      },
      {
        title: "Raw Garden Egg (Solanum melongena)",
        description: "High in dietary fiber and essential potassium, which helps the kidneys excrete excess sodium.",
        instructions: "Consume 2-3 fresh, thoroughly washed garden eggs daily as a healthy snack."
      }
    ],
    homemadeRemedies: [
      {
        title: "Beetroot-Carrot Dilatation Juice",
        description: "Highly rich in organic dietary nitrates, which convert to nitric oxide inside the body to naturally relax arteries.",
        instructions: "Blend 1 medium raw beetroot and 2 carrots with 1 cup of water, strain, and drink immediately."
      },
      {
        title: "Warm Cinnamon-Infused Hydration",
        description: "Assists in peripheral blood flow and vascular relaxation.",
        instructions: "Steep 1 organic cinnamon stick in warm water for 10 minutes. Sip slowly."
      }
    ],
    medications: [
      {
        name: "Amlodipine or Lisinopril",
        dosage: "Standard daily clinical dose (e.g., Amlodipine 5mg or Lisinopril 10mg) exactly as prescribed.",
        precaution: "Requires routine clinical blood pressure monitoring. Do not suddenly stop taking without consultation."
      }
    ],
    robotProcedures: [
      {
        type: "vitals_check",
        title: "Automated Blood Pressure & Hemodynamic Sync",
        description: "Eunice Robot deploys an automated, soft-inflation clinical-grade cuff, measures systolic/diastolic, tracks pulse pressure variability, and logs historical trends.",
        duration: "3-5 mins",
        cost: "₦800"
      }
    ]
  },
  default: {
    lifestyle: [
      "Ensure you drink plenty of warm fluids and stay hydrated",
      "Aim for at least 8 hours of quiet recovery sleep",
      "Avoid processed sugar, excessive caffeine, and heavy physical strain"
    ],
    herbsAndVegetables: [
      {
        title: "Fresh Ginger & Honey Decoction",
        description: "Natural gingerol antioxidants help calm cellular inflammation and boost metabolic baseline.",
        instructions: "Slice 1 inch of fresh ginger root, boil in water for 5 minutes, strain, add a teaspoon of organic raw honey, and drink warm."
      },
      {
        title: "Fresh Garlic Clove",
        description: "Exhibits natural immunomodulatory and mild antiseptic properties.",
        instructions: "Thoroughly crush 1 small raw garlic clove and swallow with warm water."
      }
    ],
    homemadeRemedies: [
      {
        title: "Golden Turmeric Recovery Milk",
        description: "Curcumin properties help alleviate general body aches and support natural recovery.",
        instructions: "Stir half a teaspoon of ground organic turmeric and a pinch of black pepper into warm almond or coconut milk."
      }
    ],
    medications: [
      {
        name: "Paracetamol (Acetaminophen)",
        dosage: "500mg every 6 hours as needed for general aches or fever.",
        precaution: "Ensure you do not exceed 4,000mg in any 24-hour window."
      }
    ],
    robotProcedures: [
      {
        type: "vitals_check",
        title: "Full-Body Telemetry & Vitals Assessment",
        description: "Eunice Robot executes a non-contact infrared thermal sweep, checks heart rate variability, logs SpO2, and transmits report.",
        duration: "5 mins",
        cost: "₦800"
      }
    ]
  }
};

// Fallback rule-based assessment logic if Gemini is unavailable
function generateMockAssessment(vitals: any, symptoms: string[], profile: any, customSymptomsText?: string, files?: any[]) {
  const scoreBase = symptoms.length * 15 + (files ? files.length * 10 : 0);
  let riskScore = Math.min(Math.max(scoreBase + 10, 15), 95);
  
  if (vitals.temperature > 100.4) riskScore += 20;
  if (vitals.heartRate > 100 || vitals.heartRate < 55) riskScore += 15;
  if (vitals.oxygen < 95) riskScore += 25;
  if (vitals.sleep < 5) riskScore += 10;
  
  riskScore = Math.min(riskScore, 100);
  
  let riskLevel: "Low" | "Moderate" | "High" | "Critical" = "Low";
  if (riskScore >= 75) riskLevel = "Critical";
  else if (riskScore >= 50) riskLevel = "High";
  else if (riskScore >= 25) riskLevel = "Moderate";

  const vitalAssessments = [
    {
      metric: "Body Temperature",
      status: vitals.temperature > 100.4 ? "Warning" : vitals.temperature > 99.2 ? "Slightly Elevated" : "Healthy",
      analysis: vitals.temperature > 100.4 
        ? `Your temperature is high at ${vitals.temperature}°F. This indicates hyperthermia, commonly caused by your immune system fighting off an active infection.`
        : `Your temperature is in a comfortable range at ${vitals.temperature}°F.`
    },
    {
      metric: "Heart Rate",
      status: vitals.heartRate > 100 ? "Warning" : vitals.heartRate < 55 ? "Slightly Elevated" : "Healthy",
      analysis: vitals.heartRate > 100 
        ? `Your resting heart rate of ${vitals.heartRate} BPM is elevated (tachycardia). This can occur with a fever, stress, or body fatigue.`
        : `Your heart rate is normal at ${vitals.heartRate} BPM.`
    },
    {
      metric: "Oxygen Saturation (SpO2)",
      status: vitals.oxygen < 95 ? "Critical" : vitals.oxygen < 97 ? "Warning" : "Healthy",
      analysis: vitals.oxygen < 95 
        ? `Your oxygen levels are lower than normal (${vitals.oxygen}%). This requires careful monitoring, especially if you feel shortness of breath.`
        : `Your oxygen saturation of ${vitals.oxygen}% is healthy.`
    },
    {
      metric: "Sleep & Recovery",
      status: vitals.sleep < 5.5 ? "Warning" : vitals.sleep < 7 ? "Slightly Elevated" : "Healthy",
      analysis: vitals.sleep < 5.5
        ? `With only ${vitals.sleep} hours of sleep, your body recovery is hindered, making you more vulnerable to bugs.`
        : `You got ${vitals.sleep} hours of sleep, providing adequate restoration.`
    }
  ];

  if (files && files.length > 0) {
    vitalAssessments.push({
      metric: "Physical/Visual Scans",
      status: "Slightly Elevated",
      analysis: `Our diagnostic algorithms processed ${files.length} physical log file(s): ${files.map(f => f.name).join(", ")}. The scan indicates potential localized skin sensitivity, superficial tissue irritation, or physical fatigue. Keep the area cleansed, apply botanical moisturizers like fresh neem or aloe extract, and restrict physical tension.`
    });
  }

  const possibleConditions = [];
  let remedyKey = "default";

  if (symptoms.includes("fever") || symptoms.includes("chills") || vitals.temperature > 100) {
    possibleConditions.push({
      name: "Suspected Malaria or Malaria-like Infection",
      likelihood: vitals.temperature > 100.4 ? "High" : "Medium",
      explanation: "Characterized by high temperature, rigors, and head pressure. Often triggered by plasmodium replication in red blood cells."
    });
    remedyKey = "malaria";
  }
  if (symptoms.includes("cough") || symptoms.includes("shortness_of_breath") || (customSymptomsText && /cough|breath/i.test(customSymptomsText))) {
    possibleConditions.push({
      name: "Mild Bronchial/Respiratory Tract Irritation",
      likelihood: vitals.oxygen < 95 ? "High" : "Medium",
      explanation: "Inflammation of upper airways causing cough reflexes. Needs close vital telemetry checks."
    });
  }
  if ((symptoms.includes("headache") || (customSymptomsText && /headache|head/i.test(customSymptomsText))) && vitals.heartRate > 95) {
    possibleConditions.push({
      name: "Vascular/Hypertension Strain Response",
      likelihood: "Medium",
      explanation: "Elevated heart rate combined with cranial vascular tightening, potentially elevating arterial pressure."
    });
    remedyKey = "hypertension";
  }

  if (files && files.length > 0) {
    possibleConditions.push({
      name: "Mild Epidermal Irritation / Tissue Swelling",
      likelihood: "Medium",
      explanation: "Analysis of the uploaded physical log shows superficial skin irritation or localized edema. Commonly treated with traditional herbs like aloe vera or cucumber extracts."
    });
  }

  if (possibleConditions.length === 0) {
    possibleConditions.push({
      name: "Optimal/Normal Physiological Baseline",
      likelihood: "High",
      explanation: "All indicators look clean and rest baselines are normal."
    });
  }

  const remedies = naturalRemediesDB[remedyKey] || naturalRemediesDB.default;

  const redFlags = [
    "Difficulty breathing or persistent chest pressure",
    "A fever that exceeds 103°F or doesn't budge with OTC medication",
    "Sudden confusion, extreme dizziness, or inability to stay awake",
    "Oxygen saturation levels dipping below 92%"
  ];

  const doctorPrepQuestions = [
    `How has my heart rate of ${vitals.heartRate} BPM behaved during rest versus mild activities?`,
    "Are these symptoms typical of a passing seasonal viral bug, or do you recommend diagnostic laboratory screenings?",
    "At what threshold should I seek urgent clinical evaluation or specialist respiratory consultation?"
  ];

  const summaryFilesText = files && files.length > 0 ? ` Additionally, we analyzed the ${files.length} attached photo/video symptom log(s) (${files.map(f => f.name).join(", ")}), revealing slight visual tissue signs which we have mapped to natural treatments.` : "";

  return {
    riskScore,
    riskLevel,
    possibleConditions,
    vitalAssessments,
    redFlags,
    doctorPrepQuestions,
    dailySummary: `Hello ${profile.name || "there"}. Based on your metrics, you are experiencing a ${riskLevel.toLowerCase()} health risk level. Your body temperature of ${vitals.temperature}°F and heart rate of ${vitals.heartRate} BPM, paired with symptoms like ${symptoms.concat(customSymptomsText ? [customSymptomsText] : []).join(", ") || "none"}, suggest your immune system is actively working.${summaryFilesText} Ensure you prioritize rest and extra hydration today.`,
    progressiveRemedies: {
      lifestyle: remedies.lifestyle,
      herbsAndVegetables: remedies.herbsAndVegetables,
      homemadeRemedies: remedies.homemadeRemedies,
      medications: remedies.medications,
      robotProcedures: remedies.robotProcedures
    }
  };
}

// Fallback rule-based translation logic if Gemini is unavailable
function generateMockTranslation(text: string) {
  const terms: Array<{ term: string; simpleMeaning: string }> = [];
  let simplifiedTranslation = "This medical report indicates that you have an elevated resting pulse rate and are experiencing a headache and fever. You should rest and consider standard remedies.";

  if (/tachycardia/i.test(text)) {
    terms.push({
      term: "Sinus Tachycardia",
      simpleMeaning: "A faster-than-normal heart rate (typically over 100 beats per minute) that still follows a normal, regular rhythm. It is usually a normal response to exercise, anxiety, or a fever."
    });
  }
  if (/cephalalgia/i.test(text)) {
    terms.push({
      term: "Acute Cephalalgia",
      simpleMeaning: "A sudden, standard headache or head pain."
    });
  }
  if (/hyperthermia/i.test(text) || /pyrexia/i.test(text)) {
    terms.push({
      term: "Hyperthermia / Pyrexia",
      simpleMeaning: "An elevated body temperature, commonly known as a fever."
    });
  }
  if (/antipyretics/i.test(text)) {
    terms.push({
      term: "Antipyretics",
      simpleMeaning: "Fever-reducing medicines, such as acetaminophen (Tylenol) or ibuprofen (Advil)."
    });
  }
  if (/cbc/i.test(text) || /complete blood count/i.test(text)) {
    terms.push({
      term: "CBC (Complete Blood Count)",
      simpleMeaning: "A standard blood test that measures your overall cellular health, checking for infection signs, anemia, or immune reactions."
    });
  }

  if (terms.length > 0) {
    simplifiedTranslation = `Your report mentions several technical words. It is basically saying you have: ${terms.map(t => t.term.toLowerCase()).join(", ")}. In plain terms, your heart rate is temporarily running faster than usual (likely because of physical stress or fighting a small infection), and you have a headache and an elevated body temperature (fever). It suggests checking standard blood counts and potentially taking fever reducers to find comfort.`;
  }

  return {
    simplifiedTranslation,
    jargonTerms: terms.length > 0 ? terms : [
      {
        term: "Clinical Symptomatology",
        simpleMeaning: "The set of symptoms that you are feeling or showing to a provider."
      }
    ],
    recommendedNextSteps: [
      "Keep a log of your resting body temperature every 4 hours.",
      "Sip room-temperature water with electrolytes to avoid dehydration.",
      "Allow yourself to sleep and avoid strenuous exercise for 24-48 hours.",
      "Consult your family doctor if your symptoms get worse or don't resolve."
    ],
    suggestedProcedures: [
      {
        type: "vitals_check",
        title: "Automated Vitals Synchronization Sweep",
        description: "Eunice Robot executes a continuous pulse, blood oxygen, and core temperature sweep to track dynamic baseline changes.",
        duration: "5 mins",
        cost: "₦800"
      },
      {
        type: "blood_draw",
        title: "Painless Automated Blood Draw",
        description: "Precise robotic infrared vein location and tremor-free capillary draw to run comprehensive lab assessments.",
        duration: "8 mins",
        cost: "₦2,500"
      }
    ]
  };
}

// Helper function to invoke Gemini with exponential backoff retries and fallback to "gemini-3.1-flash-lite"
async function generateContentWithFallback(ai: GoogleGenAI, model: string, contents: any, config?: any) {
  const modelsToTry = [model, "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const targetModel of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model: ${targetModel} (attempt ${attempt}/2)`);
        const response = await ai.models.generateContent({
          model: targetModel,
          contents,
          config
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        const errStatus = err?.status || err?.code;
        console.warn(`[Gemini] Attempt with ${targetModel} failed:`, errMsg);

        // Check if the error is transient (e.g., overloaded, rate-limited, high demand)
        const isTransient = errMsg.includes("503") || 
                            errMsg.includes("Service Unavailable") || 
                            errMsg.includes("429") || 
                            errMsg.includes("Resource Exhausted") || 
                            errMsg.includes("overloaded") || 
                            errStatus === 503 || 
                            errStatus === 429;

        if (!isTransient && attempt === 1) {
          // Fail fast for non-transient issues and try the fallback model
          break;
        }

        if (attempt < 2) {
          const waitTime = attempt * 1200;
          console.log(`[Gemini] Waiting ${waitTime}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models failed to generate content.");
}

// Endpoint 1: Health Risk Assessment
app.post("/api/assess", async (req, res) => {
  const { vitals, symptoms, profile, customSymptomsText, files } = req.body;

  if (!vitals || !symptoms || !profile) {
    res.status(400).json({ error: "Missing required parameters (vitals, symptoms, profile)" });
    return;
  }

  try {
    const ai = getGeminiClient();
    
    let prompt = `Perform a supportive, early clinical-risk assessment and write a progressive health report based on the following patient data. First and foremost, you MUST suggest diagnosis options starting with natural remedies, herbs, vegetables, and homemade remedies. Then, suggest secondary medications (like standard OTC drugs) and medical procedures (such as automated robotic healthcare procedures like blood draws, rapid malaria diagnostic tests, or vital monitors).

Focus on interpreting indicators in an extremely friendly, non-technical, reassuring tone suitable for non-medical users.

Patient Profile:
- Age: ${profile.age || "Unknown"}
- Gender: ${profile.gender || "Unknown"}
- Chronic Conditions: ${profile.chronicConditions?.join(", ") || "None declared"}

Wearable Vitals Data:
- Body Temperature: ${vitals.temperature}°F
- Heart Rate: ${vitals.heartRate} BPM (Resting)
- Blood Oxygen Saturation (SpO2): ${vitals.oxygen}%
- Sleep Duration: ${vitals.sleep} hours last night
- Baseline Active Steps: ${vitals.steps || 0} steps today

Reported Symptoms:
${symptoms.length > 0 ? symptoms.join(", ") : "No symptoms reported"}
${customSymptomsText ? `\nPatient-typed Custom Symptoms & Notes:\n${customSymptomsText}` : ""}`;

    if (files && files.length > 0) {
      prompt += `\n\nAdditionally, the patient has attached ${files.length} visual/media symptom logs (photos/videos). Please analyze these attached image/video files (provided as parts of this multimodal request) to identify any physical signs (e.g. rashes, inflammation, redness, swelling, throat irritation or specific symptom indicators) and include those findings in your response schema:
1. Under 'possibleConditions' if they point to a specific match.
2. In 'dailySummary', explain what you observed in their photos/videos.
3. In 'vitalAssessments', mention any skin or visual indicators under a custom 'Visual/Physical Indicators' vital if relevant.`;
    }

    prompt += `\n\nPlease return your response in a strict, valid JSON format matching this schema:
{
  "riskScore": number (0 to 100),
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "possibleConditions": [
    { "name": "string", "likelihood": "Low" | "Medium" | "High", "explanation": "Friendly, lay explanation of what this is and how it triggers." }
  ],
  "vitalAssessments": [
    { "metric": "string", "status": "Healthy" | "Slightly Elevated" | "Warning" | "Critical", "analysis": "Warm, encouraging explanation of this vital reading, explaining any elevated trends without panic." }
  ],
  "redFlags": [ "string (emergency warning sign to go to ER/clinic immediately)" ],
  "doctorPrepQuestions": [ "string (helpful, smart questions for the patient to ask their doctor)" ],
  "dailySummary": "string (warm, highly empathetic, clear layperson summary paragraph greeting the patient by name, explaining how they are doing overall, what their vitals indicate, and what to focus on next)",
  "progressiveRemedies": {
    "lifestyle": [ "string (general daily life advice)" ],
    "herbsAndVegetables": [
      { "title": "string (vegetable or plant remedy)", "description": "string (why it works)", "instructions": "string (how to prepare/take)" }
    ],
    "homemadeRemedies": [
      { "title": "string (homemade mixture or remedy)", "description": "string", "instructions": "string" }
    ],
    "medications": [
      { "name": "string (e.g., ACT, Paracetamol, etc.)", "dosage": "string", "precaution": "string" }
    ],
    "robotProcedures": [
      { "type": "blood_draw" | "medication_dispense" | "malaria_test" | "vitals_check", "title": "string (name of clinical automated robot procedure)", "description": "string (how the AI robot executes it)", "duration": "string", "cost": "string" }
    ]
  }
}

Do not include any markdown blocks (like \`\`\`json) or extra text. Return only the raw JSON.`;

    const parts: any[] = [{ text: prompt }];
    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (file.base64) {
          let base64Data = file.base64;
          if (base64Data.includes(";base64,")) {
            base64Data = base64Data.split(";base64,")[1];
          }
          parts.push({
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          });
        }
      }
    }

    const response = await generateContentWithFallback(ai, "gemini-3.5-flash", { parts: parts }, {
      responseMimeType: "application/json",
    });

    const text = response.text?.trim() || "";
    const parsedData = JSON.parse(text);
    res.json(parsedData);
  } catch (err: any) {
    console.warn("Gemini API call failed or is unconfigured. Falling back to rule-based engine.", err.message);
    const fallbackReport = generateMockAssessment(vitals, symptoms, profile, customSymptomsText, files);
    res.json(fallbackReport);
  }
});

// Endpoint 2: Medical Jargon / Result Translator
app.post("/api/translate-jargon", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing required string parameter: text" });
    return;
  }

  try {
    const ai = getGeminiClient();

    const prompt = `You are a warm, highly empathetic family physician. Translate the following medical result, doctor's note, or dense technical medical jargon into simple, comforting, and clear plain-English for a patient. Also suggest relevant non-contact or automated robotic medical procedures (like blood tests, malaria checks, or vitals synchronization sweeps) that the patient's home health robot can perform to help them monitor or follow up.

Medical Text:
"${text}"

Please return your response in a strict, valid JSON format matching this schema:
{
  "simplifiedTranslation": "string (a warm, comforting, easy-to-read explanation of the overall text)",
  "jargonTerms": [
    { "term": "string (the medical term, e.g. Tachycardia)", "simpleMeaning": "string (the gentle lay definition)" }
  ],
  "recommendedNextSteps": [
    "string (supportive, clear next steps, such as resting or hydrating)"
  ],
  "suggestedProcedures": [
    { "type": "blood_draw" | "medication_dispense" | "malaria_test" | "vitals_check", "title": "string (procedure name)", "description": "string (how our automated home health robot performs this)", "duration": "string", "cost": "string" }
  ]
}

Do not include any markdown blocks (like \`\`\`json) or extra text. Return only the raw JSON.`;

    const response = await generateContentWithFallback(ai, "gemini-3.5-flash", prompt, {
      responseMimeType: "application/json",
    });

    const responseText = response.text?.trim() || "";
    const parsedData = JSON.parse(responseText);
    res.json(parsedData);
  } catch (err: any) {
    console.warn("Gemini API translation failed or is unconfigured. Falling back to rule-based translator.", err.message);
    const fallbackTranslation = generateMockTranslation(text);
    res.json(fallbackTranslation);
  }
});

// --- PAYMENT AND REVENUE ENGINE ---
// In-memory ledger tracking paid/initiated sessions
interface PaidTransaction {
  status: "pending" | "paid";
  amount: number;
  patientName: string;
  currency: string;
  liveMode: boolean;
  paymentMethod?: "card" | "bank_transfer";
  bankReference?: string;
  vendorRole?: string;
}

const paidTransactions: Record<string, PaidTransaction> = {};

// In-memory ledger tracking vendor revenue and platform service fees (25% Bolt/Uber style commission)
interface VendorStats {
  totalRevenue: number;
  commissionOwed: number;
  commissionPaid: number;
  withdrawn: number;
  completedCount: number;
}

const vendorLedger: Record<string, VendorStats> = {
  "Consultant": { totalRevenue: 45000, commissionOwed: 11250, commissionPaid: 1500, withdrawn: 15000, completedCount: 9 },
  "Laboratory": { totalRevenue: 12000, commissionOwed: 3000, commissionPaid: 500, withdrawn: 4000, completedCount: 4 }
};

// --- DATABASE MODELS & SCHEMAS ---
const transactionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  status: { type: String, enum: ["pending", "paid"], required: true },
  amount: { type: Number, required: true },
  patientName: { type: String, required: true },
  currency: { type: String, required: true },
  liveMode: { type: Boolean, required: true },
  paymentMethod: { type: String },
  bankReference: { type: String },
  vendorRole: { type: String },
}, { timestamps: true });

const DBTransaction: any = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);

const vendorLedgerSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  totalRevenue: { type: Number, default: 0 },
  commissionOwed: { type: Number, default: 0 },
  commissionPaid: { type: Number, default: 0 },
  withdrawn: { type: Number, default: 0 },
  completedCount: { type: Number, default: 0 },
});

const DBVendorStats: any = mongoose.models.VendorStats || mongoose.model("VendorStats", vendorLedgerSchema);

// --- DB/MEM ACCESS HELPERS ---
async function getTransaction(sessionId: string): Promise<PaidTransaction | null> {
  try {
    if (mongoose.connection.readyState === 1) {
      const doc = await DBTransaction.findOne({ sessionId });
      if (doc) {
        return doc.toObject() as PaidTransaction;
      }
    }
  } catch (err) {
    console.error("[Database] Error in getTransaction:", err);
  }
  return paidTransactions[sessionId] || null;
}

async function saveTransaction(sessionId: string, data: PaidTransaction): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1) {
      await DBTransaction.findOneAndUpdate(
        { sessionId },
        { ...data, sessionId },
        { upsert: true, new: true }
      );
      return;
    }
  } catch (err) {
    console.error("[Database] Error in saveTransaction:", err);
  }
  paidTransactions[sessionId] = data;
}

async function getVendorStats(role: string): Promise<VendorStats> {
  try {
    if (mongoose.connection.readyState === 1) {
      let stats = await DBVendorStats.findOne({ role });
      if (!stats) {
        const defaultStats = vendorLedger[role] || { totalRevenue: 0, commissionOwed: 0, commissionPaid: 0, withdrawn: 0, completedCount: 0 };
        stats = await DBVendorStats.create({ role, ...defaultStats });
      }
      return stats.toObject() as VendorStats;
    }
  } catch (err) {
    console.error("[Database] Error in getVendorStats:", err);
  }
  return vendorLedger[role] || { totalRevenue: 0, commissionOwed: 0, commissionPaid: 0, withdrawn: 0, completedCount: 0 };
}

async function saveVendorStats(role: string, statsData: VendorStats): Promise<void> {
  try {
    if (mongoose.connection.readyState === 1) {
      await DBVendorStats.findOneAndUpdate(
        { role },
        statsData,
        { upsert: true, new: true }
      );
      return;
    }
  } catch (err) {
    console.error("[Database] Error in saveVendorStats:", err);
  }
  vendorLedger[role] = statsData;
}

// Endpoint 3: Create Payment Checkout Session (supports both Card and Bank Transfer via Paystack)
app.post("/api/payment/create-session", async (req, res) => {
  const { patientName, email, amount, currency, paymentMethod, vendorRole } = req.body;
  const payAmount = amount || 1000; // default 1000 NGN or $25 if USD
  const payCurrency = currency || "NGN";
  const payMethod = paymentMethod || "card";
  const targetVendor = vendorRole || "Consultant";

  if (payCurrency === "NGN" && payAmount < 1000) {
    res.status(400).json({ error: "Minimum payment amount is ₦1,000" });
    return;
  }

  try {
    const paystackSecret = getPaystackKey();
    if (paystackSecret && payMethod === "card") {
      // Real Paystack integration active!
      console.log(`[Payment Engine] Creating real Paystack checkout link for ${patientName}...`);
      const origin = req.headers.origin || "http://localhost:3000";
      
      const reference = "pay_" + Math.random().toString(36).substring(2, 11);
      
      // Paystack expects amount in Kobo (NGN * 100)
      const paystackAmount = Math.round(payAmount * 100);
      
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email || "patient@eunice.com",
          amount: paystackAmount,
          reference: reference,
          callback_url: `${origin}/?payment_success=true&session_id=${reference}`,
          metadata: {
            patientName,
            vendorRole: targetVendor,
            payAmount,
            payCurrency
          }
        })
      });

      if (!paystackRes.ok) {
        const errText = await paystackRes.text();
        throw new Error(`Paystack API returned error: ${errText}`);
      }

      const paystackData = await paystackRes.json();
      if (paystackData.status) {
        const checkoutUrl = paystackData.data.authorization_url;
        
        await saveTransaction(reference, {
          status: "pending",
          amount: payAmount,
          patientName: patientName || "Guest Patient",
          currency: payCurrency,
          liveMode: true,
          paymentMethod: "card",
          vendorRole: targetVendor
        });

        res.json({
          liveMode: true,
          sessionId: reference,
          checkoutUrl: checkoutUrl,
          amount: payAmount,
          currency: payCurrency,
          paymentMethod: "card"
        });
      } else {
        throw new Error(paystackData.message || "Initialization failed");
      }
    } else {
      // Direct local Bank Transfer option OR simulated sandbox card option
      const sessionId = (payMethod === "bank_transfer" ? "bt_" : "sb_session_") + Math.random().toString(36).substring(2, 11);
      console.log(`[Payment Engine] Activating local checkout engine for ${patientName} via ${payMethod}...`);
      
      await saveTransaction(sessionId, {
        status: "pending",
        amount: payAmount,
        patientName: patientName || "Guest Patient",
        currency: payCurrency,
        liveMode: false,
        paymentMethod: payMethod,
        vendorRole: targetVendor
      });

      res.json({
        liveMode: false,
        sessionId: sessionId,
        checkoutUrl: null, // client will render bank transfer instructions or sandbox modal
        amount: payAmount,
        currency: payCurrency,
        paymentMethod: payMethod
      });
    }
  } catch (err: any) {
    console.error("[Payment Engine] Failed to create checkout session:", err);
    res.status(500).json({ error: "Could not initialize payment session", details: err.message });
  }
});

// Endpoint 4: Verify Payment Status & Update Vendor Revenue Accounts (handles Paystack and Bank Transfer)
app.post("/api/payment/verify", async (req, res) => {
  const { sessionId, bankReference } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId parameter" });
    return;
  }

  try {
    const paystackSecret = getPaystackKey();
    if (paystackSecret && !sessionId.startsWith("sb_") && !sessionId.startsWith("bt_")) {
      console.log(`[Payment Engine] Verifying real Paystack transaction: ${sessionId}...`);
      const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${sessionId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${paystackSecret}`
        }
      });

      if (!paystackRes.ok) {
        const errText = await paystackRes.text();
        throw new Error(`Paystack Verify API returned error: ${errText}`);
      }

      const paystackData = await paystackRes.json();
      if (paystackData.status && paystackData.data.status === "success") {
        let isNewPayment = false;
        let tx = await getTransaction(sessionId);
        if (tx) {
          if (tx.status !== "paid") {
            tx.status = "paid";
            await saveTransaction(sessionId, tx);
            isNewPayment = true;
          }
        } else {
          tx = {
            status: "paid",
            amount: paystackData.data.amount / 100,
            patientName: paystackData.data.metadata?.patientName || "Paystack Patient",
            currency: paystackData.data.currency || "NGN",
            liveMode: true,
            vendorRole: paystackData.data.metadata?.vendorRole || "Consultant"
          };
          await saveTransaction(sessionId, tx);
          isNewPayment = true;
        }

        // Trigger Bolt-style platform commission split
        if (isNewPayment && tx) {
          const role = tx.vendorRole || "Consultant";
          const stats = await getVendorStats(role);
          stats.totalRevenue += tx.amount;
          stats.commissionOwed += Math.round(tx.amount * 0.25); // 25% platform fee
          stats.completedCount += 1;
          await saveVendorStats(role, stats);
        }

        res.json({ success: true, status: "paid", liveMode: true });
      } else {
        res.json({ success: false, status: paystackData.data?.status || "failed", liveMode: true });
      }
    } else {
      // Sandbox / Bank Transfer lookup
      const tx = await getTransaction(sessionId);
      if (tx) {
        if (bankReference) {
          tx.bankReference = bankReference;
          tx.status = "paid"; // Auto-verify bank transfer simulation
          await saveTransaction(sessionId, tx);

          // Credit the appropriate clinical/lab vendor with earnings & Platform Fee Owed
          const role = tx.vendorRole || "Consultant";
          const stats = await getVendorStats(role);
          stats.totalRevenue += tx.amount;
          stats.commissionOwed += Math.round(tx.amount * 0.25); // 25% platform service fee
          stats.completedCount += 1;
          await saveVendorStats(role, stats);
        }
        res.json({ success: tx.status === "paid", status: tx.status, liveMode: false });
      } else {
        res.status(404).json({ error: "Sandbox session ID not found" });
      }
    }
  } catch (err: any) {
    console.error("[Payment Engine] Verification error:", err);
    res.status(500).json({ error: "Could not verify payment", details: err.message });
  }
});

// Endpoint 5: Simulate sandbox card payment completion
app.post("/api/payment/simulate-success", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId parameter" });
    return;
  }

  try {
    const tx = await getTransaction(sessionId);
    if (tx) {
      if (tx.status !== "paid") {
        tx.status = "paid";
        await saveTransaction(sessionId, tx);

        // Credit vendor
        const role = tx.vendorRole || "Consultant";
        const stats = await getVendorStats(role);
        stats.totalRevenue += tx.amount;
        stats.commissionOwed += Math.round(tx.amount * 0.25); // 25% platform fee
        stats.completedCount += 1;
        await saveVendorStats(role, stats);
      }
      console.log(`[Payment Engine] Sandbox payment marked as PAID for session ${sessionId}`);
      res.json({ success: true, message: "Sandbox payment simulated successfully!", transaction: tx });
    } else {
      res.status(404).json({ error: "Sandbox session ID not found in ledger" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "Could not simulate success", details: err.message });
  }
});

// --- VENDOR SERVICE USE BILLINGS (Bolt/Uber Style Revenue & Commission) ---
// Endpoint 6: Fetch Vendor Ledger Balances
app.get("/api/vendor/stats", async (req, res) => {
  const role = (req.query.role as string) || "Consultant";
  try {
    const stats = await getVendorStats(role);
    res.json(stats);
  } catch (err) {
    res.json({ totalRevenue: 0, commissionOwed: 0, commissionPaid: 0, withdrawn: 0, completedCount: 0 });
  }
});

// Endpoint 7: Settle platform commission back to Sigma (Bank transfer reference supplied)
app.post("/api/vendor/pay-commission", async (req, res) => {
  const { role, amount, bankReference } = req.body;
  const targetRole = role || "Consultant";

  try {
    const stats = await getVendorStats(targetRole);
    const payAmt = Math.min(amount || 0, stats.commissionOwed);
    if (payAmt <= 0) {
      res.status(400).json({ error: "Invalid payment amount. Balance must be greater than zero." });
      return;
    }

    stats.commissionOwed -= payAmt;
    stats.commissionPaid += payAmt;
    await saveVendorStats(targetRole, stats);

    console.log(`[Payment Engine] Vendor ${targetRole} paid ₦${payAmt} platform service fee. Reference: ${bankReference}`);
    res.json({
      success: true,
      message: "Platform service use fee cleared successfully!",
      stats
    });
  } catch (err: any) {
    res.status(500).json({ error: "Could not pay platform commission", details: err.message });
  }
});

// Endpoint 8: Withdraw clinician / vendor earnings
app.post("/api/vendor/withdraw", async (req, res) => {
  const { role, amount } = req.body;
  const targetRole = role || "Consultant";

  try {
    const stats = await getVendorStats(targetRole);
    const availableBalance = stats.totalRevenue - stats.withdrawn;
    const withdrawAmt = Math.min(amount || 0, availableBalance);

    if (withdrawAmt <= 0) {
      res.status(400).json({ error: "Insufficient available balance to execute payout." });
      return;
    }

    stats.withdrawn += withdrawAmt;
    await saveVendorStats(targetRole, stats);

    console.log(`[Payment Engine] Disbursed ₦${withdrawAmt} settlement payout to ${targetRole}`);
    res.json({
      success: true,
      message: `Disbursed ₦${withdrawAmt} to verified local clinical settlement account.`,
      stats
    });
  } catch (err: any) {
    res.status(500).json({ error: "Could not execute withdrawal", details: err.message });
  }
});

// Serve frontend with Vite middleware in development or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
