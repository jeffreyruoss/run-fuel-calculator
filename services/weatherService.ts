
export interface WeatherData {
    temperatureF: number;
    humidity: number;
}

export const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("Geolocation is not supported by your browser"));
        } else {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        }
    });
};

export const fetchLocalWeather = async (): Promise<WeatherData> => {
    try {
        const position = await getCurrentPosition();
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        // Open-Meteo API (Free, no key required for non-commercial use)
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit`
        );

        if (!response.ok) {
            throw new Error("Failed to fetch weather data");
        }

        const data = await response.json();
        
        return {
            temperatureF: Math.round(data.current.temperature_2m),
            humidity: Math.round(data.current.relative_humidity_2m)
        };
    } catch (error) {
        console.error("Weather Service Error:", error);
        throw error;
    }
};
