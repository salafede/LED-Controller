let port;
let reader;
let inputDone;
let outputDone;
let inputStream;
let outputStream;
let keepReading = true;

const connectButton = document.getElementById("connect-btn");
const sendButton = document.getElementById("send-btn");
const serialLog = document.getElementById("serial-log");
const serialInput = document.getElementById("serial-input");
const baudRateInput = document.getElementById("baud-rate");

connectButton.addEventListener("click", connectSerial);
sendButton.addEventListener("click", sendSerialData);

async function connectSerial() {
    if ("serial" in navigator) {
        try {
            // Richiedi accesso alla porta seriale
            port = await navigator.serial.requestPort();
            const baudRate = parseInt(baudRateInput.value) || 9600;
            await port.open({ baudRate: baudRate });

            connectButton.disabled = true;
            baudRateInput.disabled = true;
            serialInput.disabled = false;
            sendButton.disabled = false;

            readSerialData();
        } catch (error) {
            console.error("Errore durante la connessione:", error);
        }
    } else {
        alert("Il tuo browser non supporta il Web Serial API.");
    }
}

async function readSerialData() {
    try {
        const decoder = new TextDecoderStream();
        inputDone = port.readable.pipeTo(decoder.writable);
        inputStream = decoder.readable;

        reader = inputStream.getReader();

        while (keepReading) {
            const { value, done } = await reader.read();
            if (done) {
                // Permetti alla porta seriale di essere chiusa successivamente.
                reader.releaseLock();
                break;
            }
            if (value) {
                // Aggiungi i dati ricevuti al log
                serialLog.textContent += value;
                serialLog.scrollTop = serialLog.scrollHeight;
            }
        }
    } catch (error) {
        console.error("Errore durante la lettura dei dati seriali:", error);
    }
}

async function sendSerialData() {
    const data = serialInput.value;
    if (data && port && port.writable) {
        const encoder = new TextEncoder();
        const writer = port.writable.getWriter();
        await writer.write(encoder.encode(data + "\n"));
        writer.releaseLock();
        serialInput.value = "";
    }
}

window.addEventListener("beforeunload", async () => {
    keepReading = false;
    if (reader) {
        await reader.cancel();
        await inputDone.catch(() => {});
        reader = null;
        inputDone = null;
    }
    if (port) {
        await port.close();
    }
});
