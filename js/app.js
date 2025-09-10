

  // ====================== //
 //    Initialisierung     //
// ====================== //


// Hilfsfunktionen für DOM-Manipulation
const el = css => document.querySelector(css); // Holt ein Element aus dem DOM
const group = css => document.querySelectorAll(css); // Holt mehrere Elemente aus dem DOM
const create = html => document.createElement(html); // Erstellt ein neues DOM-Element

// Canvas und Kontext initialisieren
const co = el("#canvas"); // Canvas-Element
const ctx = co.getContext("2d"); // 2D-Rendering-Kontext

// DOM-Elemente für die Benutzeroberfläche
const startScreen = el("#start-screen"); // Startbildschirm
const gameScreen = el("#game-screen"); // Spielbildschirm
const startGameButton = el("#start-game"); // Start-Button im Startbildschirm
const startSongButton = el("#start-song"); // Start-Button im Spielbildschirm
const stopSongButton = el("#stop-song"); // Stop-Button im Spielbildschirm
const backHomeButton = el("#back-home"); // Zurück-Button im Spielbildschirm
const songTitle = el("#songtitle"); // Anzeige des Songtitels
const scoreDisplay = el("#score"); // Anzeige des Scores
const timeDisplay = el("#time"); // Anzeige der Zeit (optional)
const songSelect = el("#song-select"); // Dropdown-Menü für Songauswahl
const difficultySelect = el("#difficulty"); // Dropdown-Menü für Schwierigkeitsgrad
const volumeControl = el("#volumeControl"); // Lautstärle Regler
const switchImage = el("#switch-image"); // On-Off Bild 

// Globale Variablen
let notes = []; // Array für die Noten, die gerade im Spiel sind
let activeTimers = []; // Array zur Speicherung der Timer-IDs
let isPlaying = false; // Spielstatus (läuft oder nicht)
let score = 0; // Aktueller Score
let startTime = null; // Startzeit des Spiels
let gameStartTime = Date.now(); // Startzeit des Spiels (für Timing)
let audio, delayAudio, selectedSong, selectedDifficulty; // Audio und Spielvariablen

// Globale Konstanten
const NOTE_TARGET_Y = 600; // Y-Position, bei der Noten getroffen werden -> Konstante = Großbuchstaben
const HIT_THRESHOLD = 30; // Schwellenwert für die Treffererkennung -> Konstante = Großbuchstabe


  // ============================ //
 //   Benutzeroberfläche (GUI)   //
// ============================ //


// von StartScreen zu GameScreen wechseln
function startGameScreen() {
    
    // Audio-Element erstellen und konfigurieren
    const startScreenAudio = new Audio("music/guitar_start.mp3");
    startScreenAudio.volume = 0.5; // Lautstärke auf 50%
    startScreenAudio.play(); // Audio abspielen

    // Bild vom On/Off Switch wechseln
    switchImage.src = "img/on_switch.png";
    switchImage.alt = "On Switch";

    // Start Button Übergang
    startGameButton.style.opacity = "1";
    startGameButton.style.transition = "opacity 1s ease-in-out";
    setTimeout(() => {
        startGameButton.style.opacity = "0";
    }, 500); // Wartezeit der Transition (0.5s)
 
    // Startbildschirm ausblenden mit Übergang
    startScreen.style.transition = "opacity 0.5s ease-in-out";
    startScreen.style.opacity = "0";
 
    // Warte, bis der Übergang abgeschlossen ist
    setTimeout(() => {
        startScreen.style.display = "none";
        // Spielbildschirm anzeigen mit Übergang
        gameScreen.style.display = "block";
        gameScreen.style.opacity = "0";
        gameScreen.style.transition = "opacity 1s ease-in-out";
        // Kurze Verzögerung, damit der Browser die Änderung registriert
        setTimeout(() => {
            gameScreen.style.opacity = "1"; // Langsam einblenden
        }, 10); // 10 ms Verzögerung
    }, 3200); // Wartezeit der Transition (3.2s)
}

// von GameScreen zu StartScreen und Zurücksetzen Variablen
function backToStartScreen() {
    isPlaying = false; // Spielstatus zurücksetzen
    startScreen.style.opacity = "1"; // Startbildschirm wieder sichtbar
    startGameButton.style.opacity = "1"; // Button wieder sichtbar
    switchImage.src = "img/off_switch.png"; // On/Off Switch Bild wieder austauschen
    gameScreen.style.display = "none"; // Spielbildschirm ausblenden
    startScreen.style.display = "block"; // Startbildschirm anzeigen
    stopGame(); // Spiel stoppen

    // Timer zurücksetzen
    clearAllTimers();

    // Zurücksetzen aller Variablen
    selectedSong = null;
    selectedDifficulty = null;
    audio = null;
    bpm = null;
    notes = [];
    filteredIntroRiff = null;
    filteredVerseRiff = null;
    filteredBridgeRiff = null;
    filteredChorusRiff = null;
    filteredSoloRiff = null;

    // Canvas leeren
    ctx.clearRect(0, 0, co.width, co.height);
}

// Noten-Farben und Bilder
const noteColors = {
    "A": "red",
    "S": "blue",
    "D": "green",
    "F": "yellow",
    "G": "pink"
};

// Bilder für die Umkreisungen und Kreise im Zielbereich
const noteImages = {
    "A": new Image(),
    "S": new Image(),
    "D": new Image(),
    "F": new Image(),
    "G": new Image()
};
noteImages["A"].src = "img/red_circle.png";
noteImages["S"].src = "img/blue_circle.png";
noteImages["D"].src = "img/green_circle.png";
noteImages["F"].src = "img/gold_circle.png";
noteImages["G"].src = "img/purple_circle.png";

// Effekte für Tastenanschläge
let keyEffects = {
    "A": { size: 50 },
    "S": { size: 50 },
    "D": { size: 50 },
    "F": { size: 50 },
    "G": { size: 50 }
};

// Flammen-Effekt bei getroffenen Noten
const flameImage = new Image();
flameImage.src = "img/flame.png";
let flames = []; // Array für Flammen-Effekte


  // ===================== //
 //     Spielmechanik     //
// ===================== //


// X-Positionen des Zielbereichs für getroffene Noten
function getLanePosition(key) {
    const lanes = { "A": 150, "S": 225, "D": 300, "F": 375, "G": 450 };
    return lanes[key] || 250; // Gibt die X-Position der Notenbahn zurück
}

// "Fall"-Zeit der gespawnten Noten berechnen
function calcFallDuration(bpm, beatsToFall) {
    let beatDuration = 60000 / bpm; // Dauer eines Beats in Millisekunden
    return beatDuration * beatsToFall; // Gesamte Fallzeit
}

// Noten spawnen
function spawnNote(note, song, delay) {
    let spawnTime = startTime + note.time + delay;
    let fallDuration = calcFallDuration(song.bpm, 4.5); 

    // zum Array notes hinzufügen
    notes.push({
        x: getLanePosition(note.key),
        y: 0,
        key: note.key,
        color: noteColors[note.key],
        spawnTime: spawnTime,
        fallDuration: fallDuration,
        delay: delay,
    });
}

// Songdaten auslesen aus Dropdown-Menü
function getSelectedSongData() {
    const selectedOption = songSelect.options[songSelect.selectedIndex].text; // Holt den sichtbaren Text
    const [artist, song] = selectedOption.split(" - "); // Trennt Künstler & Song
    return { artist: artist.trim(), song: song.trim() }; // Entfernt mögliche Leerzeichen
}

// Audiodatei zu dem ausgewählten Song aus songs.js laden
function setAudioForSelectedSong() {
    const { artist, song } = getSelectedSongData(); // Künstler & Song holen

    if (!songs[artist] || !songs[artist][song]) {   // Überprüfung ob Song gefunden wird -> nur vorhandene Songs werden geladen
        console.error("Song nicht gefunden in songs.js!"); 
        return;
    }

    const songData = songs[artist][song]; // Holt die Song-Daten
    audio = new Audio(songData.audioPath); // Setzt den Audio-Pfad
    delayAudio = songData.delayAudio; // Setzt das Delay für den Start
}

// abspielen der geladenen Audio-Datei
function startAudio() {
    if (!audio) {
        setAudioForSelectedSong(); // Audio und Delay setzen, wenn noch nicht geschehen
    }

    // Warte, bis das Audio geladen ist
    if (audio.readyState < 2) { // ausreichend Daten geladen -> klappt leider nicht (noch problematisch -> zeitlich keine Lösung gefunden -> beim zweiten Laden ist die Audio immer ready)
        audio.addEventListener("loadeddata", () => {
            setTimeout(() => {
                audio.currentTime = 0; // Setzt die Zeit des Audio zurück
                audio.play(); // Spielt das Audio ab
            }, delayAudio); // Verzögerung nach dem aus songs.js geladenen Wert
        });
    } else {
        setTimeout(() => {
            audio.currentTime = 0; // Setzt die Zeit des Audio zurück
            audio.play(); // Spielt das Audio ab
        }, delayAudio); // Verzögerung nach dem aus songs.js geladenen Wert
    }
}

// eigentliches GameLoop zur Abfrage des Rendern
function gameLoop() {
    if (!isPlaying) return; // Stoppt die Game-Loop, wenn das Spiel nicht läuft

    render(); // Rendert das Spiel
    requestAnimationFrame(gameLoop); // Ruft die Game-Loop erneut auf
}

// Verarbeitet Tastendrücke, überprüft Treffer und aktualisiert den Score
function handleKeyPress(key) {
    let hit = false;

    notes.forEach((note, index) => {
        if (note.key === key && Math.abs(note.y - NOTE_TARGET_Y) < HIT_THRESHOLD) { // wenn richtige Taste zum Zeitpunkt wo sich Note im Zielbereich befindet gedrückt wird
            hit = true;
            let noteScore = calcScore(note.y);
            score += noteScore;
            scoreDisplay.textContent = `Score: ${score}`;

            flames.push({ x: note.x, y: note.y, time: Date.now() });

            notes.splice(index, 1); // Entfernt die Note nach Treffer
        }
    });

    if (!hit) {
        // Optional: wenn man nicht trifft -> leider zeitlich nicht dazu gekommen - wollte eigtl Effekt, dass die Note wackelt
    }
}

// Berechnet die Punkte basierend auf der Genauigkeit des Treffers.
function calcScore(noteY) {
    let diff = Math.abs(noteY - NOTE_TARGET_Y); // Differenz von Zielbereich und Y-Position der Note

    if (diff < 10) return 100; // Perfekt getroffen
    if (diff < 20) return 50; // Gut getroffen
    return 10; // Schlecht getroffen -> wenn nicht getroffen 0 Punkte
}

// Gibt den ausgewählten Schwierigkeitsgrad zurück
function getSelectedDifficulty() {
    const selectedOption = difficultySelect.querySelector('option:checked');
    return selectedOption ? selectedOption.value : 'easy'; // Standardmäßig "easy", wenn nichts ausgewählt ist
}

// Filtert Noten eines Riffs basierend auf dem Schwierigkeitsgrad.
function filterNotesByDifficulty(riff) {
    const difficulty = getSelectedDifficulty();

    // Filtert die Noten nach dem Schwierigkeitsgrad
    return riff.filter(note => note.difficulty === difficulty || 
        (difficulty === 'medium' && (note.difficulty === 'easy' || note.difficulty === 'medium')) || // wenn Schwierigkeit "medium" sollen alle Noten "easy" und "medium" geladen werden
        (difficulty === 'hard' && (note.difficulty === 'easy' || note.difficulty === 'medium' || note.difficulty === 'hard'))); // wenn Schwierigkeit "hard" sollen alle Noten geladen werden
}

// Spielt ein Riff ab, indem Noten nach einer Verzögerung gespawnt werden.
function playRiff(riff, song, delay) {
    riff.forEach(note => {
        const timerId = setTimeout(() => {
            spawnNote(note, song, delay);
        }, startTime + note.time + delay - Date.now()); // Timingberechnung

        activeTimers.push(timerId); // Timer-ID speichern
    });
}

// Startet das Spiel, initialisiert Variablen und beginnt die Notenwiedergabe.
function startGame() {
    if (isPlaying) return;
    isPlaying = true;
    score = 0;
    startTime = Date.now();
    notes = [];
    scoreDisplay.textContent = `Score: ${score}`;

    let selectedSongTitle = songSelect.options[songSelect.selectedIndex].text; // Holt den Text des ausgewählten Songs
    let selectedArtist = selectedSongTitle.split(" - ")[0]; // "Nirvana"
    let selectedSongName = selectedSongTitle.split(" - ")[1]; // "Come As You Are"

    // Song aus songs.js holen
    let song = songs[selectedArtist][selectedSongName];

    songTitle.textContent = `Now Playing: ${selectedArtist} - ${selectedSongName}`; 

    // Noten nach Schwierigkeit filtern
    let filteredIntroRiff = filterNotesByDifficulty(song.introRiff);
    let filteredVerseRiff = filterNotesByDifficulty(song.verseRiff);
    let filteredBridgeRiff = filterNotesByDifficulty(song.bridgeRiff);
    let filteredChorusRiff = filterNotesByDifficulty(song.chorusRiff);
    let filteredSoloRiff = filterNotesByDifficulty(song.soloRiff);
    let filteredSoloRiffHigh = filterNotesByDifficulty(song.soloRiffHigh);
    let filteredEndChorusRiff = filterNotesByDifficulty(song.endChorusRiff);
    let filteredOutroRiff = filterNotesByDifficulty(song.outroRiff);

    // Durch die sequence iterieren und die Riffs mit der Verzögerung abspielen
    song.sequence.forEach(({ riff, delay }) => {
        let riffArray;
        const riffMapping = {
            introRiff: filteredIntroRiff,
            verseRiff: filteredVerseRiff,
            bridgeRiff: filteredBridgeRiff,
            chorusRiff: filteredChorusRiff,
            soloRiff: filteredSoloRiff,
            soloRiffHigh: filteredSoloRiffHigh,
            endChorusRiff: filteredEndChorusRiff,
            outroRiff: filteredOutroRiff
        };
        riffArray = riffMapping[riff]; // Holt direkt das passende Array

        playRiff(riffArray, song, delay); // Spielt das jeweilige Riff zum richtigen Zeitpunkt
    });

    gameLoop();
    startAudio();   
}

// Stoppt das Spiel, pausiert das Audio und setzt Variablen zurück.
function stopGame() {
    isPlaying = false;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    clearAllTimers(); // Timer zurücksetzen
    notes = []; // Noten-Array leeren
    songTitle.textContent = `Now Playing:`;
    ctx.clearRect(0, 0, co.width, co.height); // Canvas leeren
}

// Stoppt alle aktiven Timer und leert das Timer-Array.
function clearAllTimers() {
    activeTimers.forEach(timerId => clearTimeout(timerId)); // Alle Timer stoppen
    activeTimers = []; // Timer-Array leeren
}


  // ================== //
 //     Rendering     //  
// ================ //


function render() {
    if (!startTime) return; // Verhindert Rendering, bevor das Spiel gestartet wurde
    const currentTime = Date.now(); // Aktuelle Zeit im Moment der Berechnung
    ctx.clearRect(0, 0, co.width, co.height); // Canvas leeren

    drawPerspectiveLines(); // Perspektivische Linien zeichnen
    renderNotes(currentTime); // Noten rendern
    renderFlames(); // Flammen-Effekte rendern
    
    // Zeichnet die Tasten-Effekte
    Object.keys(keyEffects).forEach(key => {
        let posX = getLanePosition(key);
        let size = keyEffects[key].size; // Dynamische Größe

        ctx.drawImage(noteImages[key], posX - size / 2, NOTE_TARGET_Y - size / 2, size, size);
    });
}

// Zeichnet perspektivische Linien auf dem Canvas (Für den Fake 3D-Effekt)
function drawPerspectiveLines() {
    ctx.strokeStyle = "white"; // Farbe der Linien
    ctx.lineWidth = 2; // Dicke der Linien

    const middleY = 370; // Startpunkt oben (schmal)
    const bottomY = 700; // Zielbereich (breiter)

    const topSpacing = 10; // Abstand oben (enger)
    const bottomSpacing = 100; // Abstand unten (breiter)

    for (let i = -2; i <= 2; i++) {
        let middleX = 300 + i * topSpacing; // Mittig starten
        let bottomX = 300 + i * bottomSpacing; // Nach außen skalieren

        ctx.beginPath();
        ctx.moveTo(middleX, middleY); // Startpunkt der Linie
        ctx.lineTo(bottomX, bottomY); // Linie läuft nach unten auseinander
        ctx.stroke();
    }
}

// Rendert die Noten auf dem Canvas
function renderNotes(currentTime){
    notes = notes.filter(note => {
        let noteElapsedTime = currentTime - note.spawnTime; // Zeit seit der Note gespawnt wurde

        let progress = noteElapsedTime / note.fallDuration;
        note.y = 350 + progress * 250;

        let scale = 0.4 + progress * 0.5;
        let size = 50 * scale;
        let circleSize = 10 * scale;

        // Perspektivische X-Position: Start in der Mitte, dann nach außen
        let endX = getLanePosition(note.key); // Zielposition der Notenbahn
        let startOffset = (endX - 300) * 0.1; // Halb so weit von der Mitte entfernt
        let startX = 300 + startOffset; // Startpunkt leicht versetzt

        note.x = startX + (endX - startX) * progress; // Bewegt sich von Mitte nach außen

        if (circleSize > 4.5) {
            ctx.fillStyle = note.color;
            ctx.beginPath();
            ctx.arc(note.x, note.y, circleSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.drawImage(noteImages[note.key], note.x - size / 2, note.y - size / 2, size, size);
        }

        return note.y <= co.height; // Entfernt Noten, die den Bildschirm verlassen
    });
}

// Rendert die Flammen-Effekte auf dem Canvas
function renderFlames(){
    flames = flames.filter(flame => {
        let elapsed = Date.now() - flame.time;
        if (elapsed > 200) return false; // Flamme nach 200ms entfernen

        ctx.drawImage(flameImage, flame.x - 25, flame.y - 25, 50, 50);
        return true;
    });
}


  // ================== //
 //   Event-Listener   //
// ================== //


// Initialisiert alle Event-Listener
function initEventListeners() {
    startGameButton.addEventListener("click", startGameScreen);
    startSongButton.addEventListener("click", startGame);
    stopSongButton.addEventListener("click", stopGame);
    backHomeButton.addEventListener("click", backToStartScreen);
    volumeControl.addEventListener("input", () => {
        audio.volume = volumeControl.value / 100;
    });
}

// Verarbeitet Tastendruck-Events
document.addEventListener("keydown", (event) => {
    let key = event.key.toUpperCase();
    if (keyEffects[key]) {
        keyEffects[key].size = 60; // Kreis wächst wenn man Taste betätigt
    }
    handleKeyPress(key);
});

// Verarbeitet Tastenloslass-Events
document.addEventListener("keyup", (event) => {
    let key = event.key.toUpperCase();
    if (keyEffects[key]) {
        keyEffects[key].size = 50; // Kreis wieder normal wenn man Taste loslässt
    }
});

// Event-Listener initialisieren
initEventListeners();


  // ================= //
 //       ENDE        //
// ================= //

