// Codice per Arduino Nano

#include <ctype.h>

const int ledPins[] = {13, 3, 4, 5, 6, 7, 8, 9, 10}; // Pin collegati ai LED
const int NUM_LEDS = sizeof(ledPins) / sizeof(ledPins[0]);

const int buttonPins[] = {A0, A1, A2, A3, A4}; // Pin collegati ai bottoni
const int NUM_BUTTONS = sizeof(buttonPins) / sizeof(buttonPins[0]);

const int NUM_ANIMATIONS = 4;     // Numero totale di animazioni
const int ANIMATION_LENGTH = 16;  // Ogni animazione ha 16 beat

// Definizione delle animazioni come costanti, usando solo 0 (spento) e 1 (acceso)
const int animations[NUM_ANIMATIONS][NUM_LEDS][ANIMATION_LENGTH] = {
    // Animazione 1
    {
        {0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,1}, // LED 1
        {0,0,0,1,1,0,0,0,0,0,1,0,1,0,1,1}, // LED 2
        {0,0,1,0,1,0,0,1,0,1,0,0,0,1,0,1}, // LED 3
        {0,0,1,0,1,0,0,1,0,1,0,0,0,1,0,1}, // LED 4
        {0,0,0,1,1,0,0,0,0,0,1,0,1,0,1,1}, // LED 5
        {0,0,0,0,1,0,0,1,0,0,0,1,0,0,0,1}, // LED 6
        {0,1,1,1,1,1,1,0,0,1,1,1,1,1,1,0}, // Ultravioletta (LED 7)
        {0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,1}, // Occhi (LED 8)
        {0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0}  // Free (LED 9)
    },
    // Animazione 2
    {
        {0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0}, // LED 1
        {0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0}, // LED 2
        {0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0}, // LED 3
        {0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0}, // LED 4
        {0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0}, // LED 5
        {1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0}, // LED 6
        {0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0}, // Ultravioletta (LED 7)
        {1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0}, // Occhi (LED 8)
        {0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0}  // Free (LED 9)
    },
    // Animazione 3
    {
        {0,0,0,0,1,0,0,0,0,1,0,1,0,0,0,1}, // LED 1
        {0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,1}, // LED 2
        {0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0}, // LED 3
        {0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0}, // LED 4
        {0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0}, // LED 5
        {1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0}, // LED 6
        {0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0}, // Ultravioletta (LED 7)
        {1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0}, // Occhi (LED 8)
        {0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0}  // Free (LED 9)
    },
    // Animazione 4
    {
        {1,0,0,0,1,0,0,0,0,1,0,1,0,0,0,1}, // LED 1
        {0,1,0,1,0,1,0,1,0,0,0,0,1,0,0,1}, // LED 2
        {0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1}, // LED 3
        {0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1}, // LED 4
        {0,1,0,1,0,1,0,0,0,1,0,0,1,0,0,1}, // LED 5
        {1,0,0,0,1,0,0,0,0,1,0,1,0,0,0,1}, // LED 6
        {0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,0}, // Ultravioletta (LED 7)
        {1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0}, // Occhi (LED 8)
        {0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0}  // Free (LED 9)
    }
};

// Variabili per la riproduzione delle animazioni
int currentAnimation = 0;
int currentBeat = 0;
unsigned long lastBeatTime = 0;
float bpm = 128.0;            // BPM di default
unsigned long beatInterval = 0; // Intervallo tra i beat in ms

// Variabili per la gestione dei bottoni
bool buttonStates[NUM_BUTTONS] = {LOW, LOW, LOW, LOW, LOW};
bool lastButtonStates[NUM_BUTTONS] = {LOW, LOW, LOW, LOW, LOW};
unsigned long lastDebounceTime[NUM_BUTTONS] = {0, 0, 0, 0, 0};
const unsigned long debounceDelay = 50; // Debounce di 50 ms

// Enumerazione delle modalità operative
enum Mode {
    MODE_ANIMATION,
    MODE_BUTTON2_SEQUENCE,
    MODE_FADE_RANDOM
    // La modalità strobo viene gestita separatamente
};

Mode mode = MODE_ANIMATION;
Mode previousMode = MODE_ANIMATION; // Per memorizzare la modalità precedente quando si attiva lo strobo

int button2SequenceState = -1; // Stato iniziale per la sequenza del bottone 2

// Variabili per il tap tempo (bottone 3)
unsigned long tapTimes[4] = {0, 0, 0, 0};
int tapIndex = 0;

// Variabili per la modalità fade random (bottone 4)
unsigned long lastFadeTime = 0;
unsigned long fadeInterval = 1000; // 1 secondo
int fadeLEDs[3]; // LED attualmente in fade

// Variabili per la modalità strobo (bottone 5)
unsigned long lastStrobeTime = 0;
unsigned long strobeInterval = 50; // 50 ms
bool strobeState = false;

// Flag per la modalità live
bool liveMode = false;

// Buffer di input seriale
const int BUFFER_SIZE = 200;
char inputBuffer[BUFFER_SIZE];
int bufferIndex = 0;

void setup() {
    // Inizializza la comunicazione seriale a 115200 baud
    Serial.begin(115200);

    // Inizializza i pin dei LED come OUTPUT
    for (int i = 0; i < NUM_LEDS; i++) {
        pinMode(ledPins[i], OUTPUT);
        digitalWrite(ledPins[i], LOW); // Spegni inizialmente i LED
    }

    // Inizializza i pin dei bottoni come INPUT_PULLDOWN
    for (int i = 0; i < NUM_BUTTONS; i++) {
        pinMode(buttonPins[i], INPUT_PULLDOWN);
    }

    // Calcola l'intervallo tra i beat
    beatInterval = (unsigned long)(60000.0 / (bpm * 2)); // Ogni beat è un 1/8

    // Invia il messaggio READY
    Serial.println("READY");

    // Avvia con la prima animazione
    currentAnimation = 0;
    currentBeat = 0;
    lastBeatTime = millis();
}

void loop() {
    // Controlla i dati seriali
    if (Serial.available() > 0) {
        readSerialData();
    }

    if (liveMode) {
        // Processa i comandi seriali
        processSerialCommands();
    } else {
        // Non in modalità live
        // Gestisci i bottoni
        handleButtons();

        // Aggiorna i LED in base alla modalità
        switch (mode) {
            case MODE_ANIMATION:
                updateAnimation();
                break;
            case MODE_BUTTON2_SEQUENCE:
                // I LED sono controllati dalla sequenza del bottone 2
                break;
            case MODE_FADE_RANDOM:
                updateFadeRandom();
                break;
            // Nessun caso di default necessario
        }

        // Gestisci lo strobo se il bottone 5 è premuto
        if (buttonStates[4] == HIGH) {
            updateStrobe();
        } else if (strobeState) {
            // Bottone strobo rilasciato, ritorna alla modalità precedente
            strobeState = false;
            // I LED verranno aggiornati dalla modalità corrente
        }
    }
}

// Funzione per leggere i dati seriali
void readSerialData() {
    while (Serial.available() > 0) {
        char inChar = Serial.read();
        if (inChar == '\n') {
            inputBuffer[bufferIndex] = '\0'; // Termina la stringa
            processCommand(inputBuffer);
            bufferIndex = 0; // Resetta l'indice del buffer
        } else {
            if (bufferIndex < BUFFER_SIZE - 1) {
                inputBuffer[bufferIndex++] = inChar;
            }
        }
    }
}

// Funzione per processare i comandi seriali
void processSerialCommands() {
    liveMode = true;
    // Mantieni la logica esistente per il controllo seriale
    // Ignora i bottoni e le modalità quando in live mode
    processCommand(inputBuffer);
}

// Funzione per gestire i bottoni
void handleButtons() {
    for (int i = 0; i < NUM_BUTTONS; i++) {
        int reading = digitalRead(buttonPins[i]);

        if (reading != lastButtonStates[i]) {
            // Resetta il timer di debounce
            lastDebounceTime[i] = millis();
        }

        if ((millis() - lastDebounceTime[i]) > debounceDelay) {
            if (reading != buttonStates[i]) {
                buttonStates[i] = reading;

                if (buttonStates[i] == HIGH) {
                    // Bottone premuto
                    onButtonPressed(i);
                } else {
                    // Bottone rilasciato
                    onButtonReleased(i);
                }
            }
        }

        lastButtonStates[i] = reading;
    }
}

// Funzione per le azioni quando un bottone viene premuto
void onButtonPressed(int buttonIndex) {
    if (liveMode) return; // Ignora i bottoni in modalità live

    switch (buttonIndex) {
        case 0:
            // Bottone 1 (A0)
            if (mode == MODE_ANIMATION) {
                // Passa all'animazione successiva
                currentAnimation = (currentAnimation + 1) % NUM_ANIMATIONS;
                currentBeat = 0;
                lastBeatTime = millis();
            } else {
                // Se non in modalità animazione, avvia l'animazione 1
                mode = MODE_ANIMATION;
                currentAnimation = 0;
                currentBeat = 0;
                lastBeatTime = millis();
            }
            break;
        case 1:
            // Bottone 2 (A1)
            // Interrompe l'animazione
            mode = MODE_BUTTON2_SEQUENCE;
            // Gestisce la sequenza di pressioni
            button2SequenceState = (button2SequenceState + 1) % 3;
            if (button2SequenceState == 0) {
                // Prima pressione: tutti i LED su HIGH
                for (int i = 0; i < NUM_LEDS; i++) {
                    digitalWrite(ledPins[i], HIGH);
                }
            } else if (button2SequenceState == 1) {
                // Seconda pressione: tutti i LED su LOW tranne il pin 8 (Ultravioletta)
                for (int i = 0; i < NUM_LEDS; i++) {
                    if (ledPins[i] == 8) {
                        digitalWrite(ledPins[i], HIGH);
                    } else {
                        digitalWrite(ledPins[i], LOW);
                    }
                }
            } else if (button2SequenceState == 2) {
                // Terza pressione: tutti i LED su LOW
                for (int i = 0; i < NUM_LEDS; i++) {
                    digitalWrite(ledPins[i], LOW);
                }
            }
            break;
        case 2:
            // Bottone 3 (A2)
            if (mode == MODE_ANIMATION) {
                // Tap tempo
                unsigned long currentTime = millis();
                tapTimes[tapIndex % 4] = currentTime;
                tapIndex++;

                if (tapIndex >= 4) {
                    // Calcola il BPM
                    unsigned long interval1 = tapTimes[(tapIndex - 1) % 4] - tapTimes[(tapIndex - 2) % 4];
                    unsigned long interval2 = tapTimes[(tapIndex - 2) % 4] - tapTimes[(tapIndex - 3) % 4];
                    unsigned long interval3 = tapTimes[(tapIndex - 3) % 4] - tapTimes[(tapIndex - 4) % 4];

                    unsigned long avgInterval = (interval1 + interval2 + interval3) / 3;

                    bpm = 60000.0 / avgInterval;

                    // Ricalcola l'intervallo dei beat
                    beatInterval = (unsigned long)(60000.0 / (bpm * 2));

                    // Riavvia l'animazione
                    currentBeat = 0;
                    lastBeatTime = millis();
                }
            }
            break;
        case 3:
            // Bottone 4 (A3)
            // Avvia la modalità fade random
            mode = MODE_FADE_RANDOM;
            lastFadeTime = millis();
            // Accende la luce ultravioletta (pin 8)
            for (int i = 0; i < NUM_LEDS; i++) {
                if (ledPins[i] == 8) {
                    digitalWrite(ledPins[i], HIGH);
                } else {
                    analogWrite(ledPins[i], 0); // Inizia con i LED spenti
                }
            }
            break;
        case 4:
            // Bottone 5 (A4)
            // Avvia la modalità strobo
            previousMode = mode; // Salva la modalità corrente
            strobeState = false;
            lastStrobeTime = millis();
            // Lo strobo verrà gestito in updateStrobe() mentre il bottone è premuto
            break;
    }
}

// Funzione per le azioni quando un bottone viene rilasciato
void onButtonReleased(int buttonIndex) {
    if (liveMode) return; // Ignora i bottoni in modalità live

    if (buttonIndex == 4) {
        // Bottone 5 (A4) rilasciato, esci dalla modalità strobo
        strobeState = false;
        // Ritorna alla modalità precedente
        mode = previousMode;
        // Assicura che i LED vengano aggiornati secondo la modalità corrente
        currentBeat = 0; // Resetta il beat per sincronizzare le animazioni
        lastBeatTime = millis();
    }
}

// Funzione per aggiornare la modalità animazione
void updateAnimation() {
    unsigned long currentTime = millis();
    if (currentTime - lastBeatTime >= beatInterval) {
        // Passa al beat successivo
        lastBeatTime += beatInterval;
        // Aggiorna i LED
        for (int i = 0; i < NUM_LEDS; i++) {
            int state = animations[currentAnimation][i][currentBeat];
            if (state == 1) {
                digitalWrite(ledPins[i], HIGH);
            } else {
                digitalWrite(ledPins[i], LOW);
            }
        }
        // Passa al beat successivo
        currentBeat = (currentBeat + 1) % ANIMATION_LENGTH;
    }
}

// Funzione per aggiornare la modalità fade random
void updateFadeRandom() {
    unsigned long currentTime = millis();
    if (currentTime - lastFadeTime >= fadeInterval) {
        lastFadeTime += fadeInterval;
        // Scegli 3 LED casuali (escludendo il pin 8)
        for (int i = 0; i < 3; i++) {
            int ledIndex;
            do {
                ledIndex = random(NUM_LEDS);
            } while (ledPins[ledIndex] == 8 || isInFadeLEDs(ledIndex)); // Escludi il pin 8 e duplicati
            fadeLEDs[i] = ledIndex;
        }
    }

    // Logica per il fade
    int fadeValue = ((currentTime - lastFadeTime) * 255) / fadeInterval;
    if (fadeValue > 255) fadeValue = 255;

    for (int i = 0; i < NUM_LEDS; i++) {
        if (ledPins[i] == 8) {
            digitalWrite(ledPins[i], HIGH); // Ultravioletta rimane accesa
        } else {
            if (isInFadeLEDs(i)) {
                analogWrite(ledPins[i], fadeValue);
            } else {
                analogWrite(ledPins[i], 255 - fadeValue);
            }
        }
    }
}

// Funzione di supporto per verificare se un LED è nei fadeLEDs
bool isInFadeLEDs(int ledIndex) {
    for (int i = 0; i < 3; i++) {
        if (fadeLEDs[i] == ledIndex) return true;
    }
    return false;
}

// Funzione per aggiornare la modalità strobo
void updateStrobe() {
    unsigned long currentTime = millis();
    if (currentTime - lastStrobeTime >= strobeInterval) {
        lastStrobeTime += strobeInterval;
        strobeState = !strobeState;
        // Aggiorna i LED
        for (int i = 0; i < NUM_LEDS; i++) {
            digitalWrite(ledPins[i], strobeState ? HIGH : LOW);
        }
    }
}

// Funzioni esistenti per il controllo seriale
void processCommand(char *cmd) {
    // Rimuove spazi bianchi iniziali e finali
    trimWhitespace(cmd);

    if (strcmp(cmd, "HELLO") == 0) {
        // Invia il numero di LED disponibili
        Serial.print("LEDCOUNT");
        Serial.println(NUM_LEDS);
        return;
    }

    char *token = strtok(cmd, ",");
    while (token != NULL) {
        executeCommand(token);
        token = strtok(NULL, ",");
    }
}

void executeCommand(char *cmd) {
    // Rimuove spazi bianchi iniziali e finali
    trimWhitespace(cmd);

    if (strcmp(cmd, "STOP") == 0) {
        // Fine della sequenza di comandi
        return;
    } else if (strncmp(cmd, "LED", 3) == 0) {
        // Parsea il comando LED
        int ledNumber = 0;
        char action[4]; // Per contenere "ON" o "OFF"
        int matches = sscanf(cmd, "LED%d%3s", &ledNumber, action);
        if (matches == 2) {
            if (ledNumber >= 1 && ledNumber <= NUM_LEDS) {
                int pin = ledPins[ledNumber - 1];

                if (strcmp(action, "ON") == 0) {
                    digitalWrite(pin, HIGH);
                } else if (strcmp(action, "OFF") == 0) {
                    digitalWrite(pin, LOW);
                }
            }
        }
    }
}

void trimWhitespace(char *str) {
    // Rimuove spazi bianchi iniziali
    while (isspace((unsigned char)*str)) str++;

    // Rimuove spazi bianchi finali
    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;

    // Scrive il nuovo terminatore
    *(end + 1) = '\0';
}
