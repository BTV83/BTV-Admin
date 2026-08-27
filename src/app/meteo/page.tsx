TypeScript
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialisation de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function MeteoPage() {
    const [resultat, setResultat] = useState("Sélectionnez une ville pour voir la météo.");
    const [villes, setVilles] = useState<any[]>([]);
    const [villeSelectionnee, setVilleSelectionnee] = useState<any>(null);

    // Charger la liste des villes depuis la table 'cities' de Supabase au chargement de la page
    useEffect(() => {
        async function chargerVilles() {
            try {
                const { data, error } = await supabase.from('cities').select('*');
                
                if (error) {
                    console.error("Erreur Supabase:", error);
                } else if (data) {
                    setVilles(data);
                    if (data.length > 0) {
                        setVilleSelectionnee(data[0]); // Sélectionne la première ville par défaut
                    }
                }
            } catch (err) {
                console.error("Erreur de chargement des villes", err);
            }
        }

        chargerVilles();
    }, []);

    async function recupererMeteo() {
        if (!villeSelectionnee) {
            setResultat("Aucune ville sélectionnée.");
            return;
        }

        setResultat(`Chargement de la météo pour ${villeSelectionnee.name || villeSelectionnee.nom || 'la ville'}...`);

        // Récupération des coordonnées de la ville sélectionnée
        const latitude = villeSelectionnee.latitude;
        const longitude = villeSelectionnee.longitude;

        try {
            const reponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await reponse.json();
            
            if (data && data.current_weather) {
                const temperature = data.current_weather.temperature;
                const vent = data.current_weather.windspeed;
                const nomVille = villeSelectionnee.name || villeSelectionnee.nom || 'Ville';
                setResultat(`Météo à ${nomVille} : ${temperature}°C (Vent : ${vent} km/h)`);
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
            <h1>Application Météo BTV (Connectée à Supabase)</h1>

            {/* Menu déroulant pour choisir une ville de la base de données */}
            <div style={{ margin: '20px 0' }}>
                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Choisissez une ville :</label>
                <select 
                    style={{ padding: '8px', fontSize: '16px' }}
                    onChange={(e) => {
                        const villeTrouvee = villes.find(v => v.id == e.target.value);
                        setVilleSelectionnee(villeTrouvee);
                    }}
                >
                    {villes.map((ville) => (
                        <option key={ville.id} value={ville.id}>
                            {ville.name || ville.nom || `Ville ${ville.id}`}
                        </option>
                    ))}
                </select>
            </div>

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
