// Arduino Nano code

#include <ctype.h>

const int ledPins[] = {13, 3, 4, 5, 6, 7, 8, 9, 10};
const int numLEDs = sizeof(ledPins) / sizeof(ledPins[0]);

const int BUFFER_SIZE = 200;
char inputBuffer[BUFFER_SIZE];
int bufferIndex = 0;

void setup() {
    // Initialize serial communication at 115200 baud
    Serial.begin(115200);

    // Set LED pins as OUTPUT
    for (int i = 0; i < numLEDs; i++) {
        pinMode(ledPins[i], OUTPUT);
        digitalWrite(ledPins[i], LOW); // Turn off LEDs initially
    }

    // Send READY message
    Serial.println("READY");
}

void loop() {
    while (Serial.available() > 0) {
        char inChar = Serial.read();
        if (inChar == '\n') {
            inputBuffer[bufferIndex] = '\0'; // Null-terminate the string
            processCommand(inputBuffer);
            bufferIndex = 0; // Reset buffer index
        } else {
            if (bufferIndex < BUFFER_SIZE - 1) {
                inputBuffer[bufferIndex++] = inChar;
            }
        }
    }
}

void processCommand(char *cmd) {
    // Remove leading and trailing whitespace
    trimWhitespace(cmd);

    if (strcmp(cmd, "HELLO") == 0) {
        // Send number of LEDs available
        Serial.print("LEDCOUNT");
        Serial.println(numLEDs);
        return;
    }

    char *token = strtok(cmd, ",");
    while (token != NULL) {
        executeCommand(token);
        token = strtok(NULL, ",");
    }
}

void executeCommand(char *cmd) {
    // Remove leading and trailing whitespace
    trimWhitespace(cmd);

    if (strcmp(cmd, "STOP") == 0) {
        // End of command sequence
        return;
    } else if (strncmp(cmd, "LED", 3) == 0) {
        // Parse LED command
        int ledNumber = 0;
        char action[4]; // To hold "ON" or "OFF"
        int matches = sscanf(cmd, "LED%d%3s", &ledNumber, action);
        if (matches == 2) {
            if (ledNumber >= 1 && ledNumber <= numLEDs) {
                int pin = ledPins[ledNumber - 1];

                // Debugging: print the action and pin
                // Serial.print("Action: ");
                // Serial.println(action);
                // Serial.print("Pin: ");
                // Serial.println(pin);

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
    // Trim leading whitespace
    while (isspace((unsigned char)*str)) str++;

    // Trim trailing whitespace
    char *end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;

    // Write new null terminator
    *(end + 1) = '\0';
}
