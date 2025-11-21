# Marathon Fuel Master

A smart marathon nutrition planner that helps runners calculate carbohydrate, sodium, and potassium intake per hour using common race fuels and AI-powered custom food lookups.

## Features

- **Smart Fueling Calculator**: Plan your nutrition hour-by-hour to hit specific carbohydrate targets.
- **Electrolyte Tracking**: Monitor Sodium and Potassium intake alongside carbs to prevent cramping and dehydration.
- **Extensive Database**: Built-in presets for popular brands like Maurten, GU, Tailwind, Clif, and generic foods like bananas, dates, or pretzels.
- **AI-Powered Search**: Use Google Gemini to find nutritional info for any custom food or snack not in the database.
- **Visual Insights**: Real-time charts and progress bars to visualize your fueling strategy against your goals.
- **AI Analysis**: Get personalized coaching tips and analysis on your race plan.

## Technologies

- **Frontend**: React, Tailwind CSS
- **Visualization**: Recharts
- **Icons**: Lucide React
- **AI Integration**: Google Gemini API (`@google/genai`)

## Usage

1. **Set Goals**: Configure your target marathon time and desired hourly intake for Carbs, Sodium, and Potassium.
2. **Build Plan**: Add hours to your race duration.
3. **Add Fuel**: Click on an hour to open the fuel picker. Select from presets or search for custom items (e.g., "Uncrustables").
4. **Analyze**: Switch to the Analyze tab to see a chart of your fuel intake and get AI feedback.
