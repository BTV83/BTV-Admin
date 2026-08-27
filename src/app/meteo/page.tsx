TypeScript
'use client';

import React, { useState } from 'react';

export default function MeteoPage() {
    const [resultat, setResultat] = useState("Cliquez sur le bouton pour voir la météo.");

    async function recupererMeteo() {
        setResultat("Chargement de la météo...");

        // Coordonnées de Salernes par défaut
        const latitude = 43.5658;
        const longitude = 6.2239;

        try {
            const reponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await reponse.json();
            
            if (data && data.current_weather) {
                const temperature = data.current_weather.temperature;
                const vent = data.current_weather.windspeed;
                setResultat(`Température actuelle : ${temperature}°C (Vent : ${vent} km/h)`);
            } else {
                setResultat("Impossible de récupérer la météo.");
            }
        } catch (erreur) {
            setResultat("Erreur de connexion au service météo.");
            console.error(erreur);
        }
    }

    return (
        <main style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h1>Application Météo BTV (Admin)</h1>

            <button 
                onClick={recupererMeteo} 
                style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer', marginTop: '10px' }}
            >
                Voir la météo
            </button>
            
            <div style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '18px' }}>
                {resultat}
            </div>
        </main>
    );
}
